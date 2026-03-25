/**
 * ArcGIS Service
 * Fetches building polygons from ArcGIS Feature Service with error handling
 * and writes back enumeration status + customer points.
 *
 * NOTE: All spatial queries use HTTP POST with application/x-www-form-urlencoded
 * body instead of GET with URL query parameters. The GET URLs exceed ~600 chars
 * and are silently dropped by the network path in the field (HTTP 000 / empty
 * response on long GET, HTTP 200 with full results on POST).
 * Ref: Fix Specification — arcgis_service.dart (Backend Team, 2026-03-10)
 *
 * v1.58.3 — Added write-back:
 *   updatePolygonAfterRegistration()  — marks polygon as Enumerated on unit save
 *   upsertCustomerPoint()             — creates/updates a point per unit in Customer Layer
 */

import type {
  BuildingPolygon,
  ArcGISQueryResponse,
  ArcGISFeature,
} from '../models/BuildingPolygon';
import {
  convertArcGISRingsToWGS84,
  calculatePolygonCenter,
} from '../utils/coordinateConversion';

// ─── Endpoint constants ───────────────────────────────────────────────────────

/** Building polygon layer (parent) */
const ARCGIS_POLYGON_URL =
  'https://services3.arcgis.com/VYBpf26AGQNwssLH/arcgis/rest/services/New_Footprints_gdb_b1422/FeatureServer/0';

/** Customer point layer (child) */
const ARCGIS_CUSTOMER_URL =
  'https://services3.arcgis.com/VYBpf26AGQNwssLH/arcgis/rest/services/Customer_Layer_gdb/FeatureServer/0';

// Keep the legacy alias so existing read-only callers are unaffected
const ARCGIS_BASE_URL = ARCGIS_POLYGON_URL;

// ArcGIS API Key
const ARCGIS_API_KEY =
  'AAPTxy8BH1VEsoebNVZXo8HurDkT4HeplNOm_pLCsV2-wHXD7esJFqWCGo3oDxTaOVO68fIzhjQ4gSKqccl-uynuHunhlN5t3E_x5N010mOKYQRyFm3vYXqvila3dJ3Ax81DMK2WyxFt6mqhwzxdkdhmm7USv7-cQi07L_22-MTRC95Rns1BHueP3kR_yXyAyh1WEFAm9Q7KFELPkRpT_5cjWvbDo2rWZhtHOb5xFr_7bOA.AT1_n5wNkDcc';

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 15000;

// ─── Write-back types ─────────────────────────────────────────────────────────

/**
 * Parameters for updating a building polygon after a unit is registered.
 * Only aggregate/status fields are written — no individual customer PII.
 */
export interface PolygonUpdateParams {
  /** ArcGIS building_id of the parent polygon (arcgisBuildingId in MongoDB) */
  arcgisBuildingId: string;
  /** Full name of the enumerator who registered the unit */
  validatedBy: string;
  /** ISO date string of the registration (defaults to now) */
  validationDate?: string;
  /** Unit code registered e.g. R1, R2, C1, C2 — stored in flat_no */
  unitCode?: string;
  /** Building type / property type — stored in house_name */
  buildingType?: string;
}

/**
 * Parameters for creating / updating a customer point in the Customer Layer.
 * One point per unit (identified by arcgisBuildingId + unitCode combination).
 */
export interface CustomerPointParams {
  /** ArcGIS building_id of the parent polygon */
  arcgisBuildingId: string;
  /** Unit code e.g. R1, R2, C1, C2 — stored in flat_no */
  unitCode: string;
  /** GPS latitude of the unit (building centroid or surveyor GPS) */
  lat: number;
  /** GPS longitude of the unit */
  lon: number;
  /** Customer first name */
  firstName?: string;
  /** Customer last name */
  lastName?: string;
  /** Business / organisation name */
  businessName?: string;
  /** Customer phone number */
  phone?: string;
  /** Customer email */
  email?: string;
  /** Customer type: Residential | Commercial | Industrial | Mixed-Use */
  customerType?: string;
  /** Street address */
  address?: string;
  /** Enumerator full name (stored in Source field) */
  enumeratorName?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * POST a query or edit to any ArcGIS FeatureServer endpoint.
 * Uses application/x-www-form-urlencoded to avoid long-URL truncation.
 */
async function postArcGIS(
  url: string,
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<any> {
  const body = new URLSearchParams({ ...params, token: ARCGIS_API_KEY, f: 'json' });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal,
  });

  if (!response.ok) {
    throw new Error(`ArcGIS HTTP ${response.status} for ${url}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`ArcGIS API error: ${data.error.message} (code ${data.error.code})`);
  }

  return data;
}

/**
 * Internal helper: POST a spatial query to the ArcGIS Feature Service.
 * Uses application/x-www-form-urlencoded body to avoid long-URL truncation.
 */
async function postArcGISQuery(
  params: Record<string, string>,
  signal: AbortSignal
): Promise<ArcGISQueryResponse> {
  const body = new URLSearchParams(params);
  const response = await fetch(`${ARCGIS_BASE_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal,
  });

  if (!response.ok) {
    throw new Error(`ArcGIS API request failed: ${response.status}`);
  }

  const data: ArcGISQueryResponse = await response.json();

  if (data.error) {
    throw new Error(`ArcGIS API Error: ${data.error.message}`);
  }

  return data;
}

// ─── Write-back: Polygon update ───────────────────────────────────────────────

/**
 * Update the parent building polygon in ArcGIS after a unit is registered.
 *
 * Sets aggregate / status fields only — no individual customer PII is stored
 * on the polygon. The polygon represents the building, not the customer.
 *
 * Fields written:
 *   Validation   → "Enumerated"
 *   Validated_By → enumerator full name
 *   V_Date       → registration timestamp (epoch ms)
 *   flat_no      → unit code (R1 / R2 / C1 / C2)
 *   house_name   → building type (Residential / Commercial / etc.)
 *   Description  → "Validated"
 *
 * Returns true on success, false on failure (non-throwing for resilience).
 */
export async function updatePolygonAfterRegistration(
  params: PolygonUpdateParams
): Promise<boolean> {
  const { arcgisBuildingId, validatedBy, validationDate, unitCode, buildingType } = params;

  if (!arcgisBuildingId) {
    console.warn('[ArcGIS] updatePolygonAfterRegistration: no arcgisBuildingId — skipping');
    return false;
  }

  try {
    // Step 1: find the OBJECTID of the polygon
    const queryData = await postArcGIS(`${ARCGIS_POLYGON_URL}/query`, {
      where: `building_id='${arcgisBuildingId.replace(/'/g, "''")}'`,
      outFields: 'OBJECTID',
      returnGeometry: 'false',
      resultRecordCount: '1',
    });

    const features: any[] = queryData.features ?? [];
    if (features.length === 0) {
      console.warn(`[ArcGIS] updatePolygonAfterRegistration: polygon not found for building_id='${arcgisBuildingId}'`);
      return false;
    }

    const objectId = features[0].attributes.OBJECTID;

    // Step 2: build the update attributes
    const validationEpoch = validationDate
      ? new Date(validationDate).getTime()
      : Date.now();

    const updateAttributes: Record<string, any> = {
      OBJECTID: objectId,
      Validation: 'Enumerated',
      Validated_By: validatedBy || 'Property Enumeration App',
      V_Date: validationEpoch,
      Description: 'Validated',
    };

    if (unitCode) updateAttributes.flat_no = unitCode;
    if (buildingType) updateAttributes.house_name = buildingType;

    const updateFeature = { attributes: updateAttributes };

    // Step 3: applyEdits / updateFeatures
    const updateData = await postArcGIS(`${ARCGIS_POLYGON_URL}/updateFeatures`, {
      features: JSON.stringify([updateFeature]),
      rollbackOnFailure: 'true',
    });

    const updateResults: any[] = updateData.updateResults ?? [];
    const success = updateResults.length > 0 && (updateResults[0].success === true);

    if (success) {
      console.log(`[ArcGIS] Polygon updated for building_id='${arcgisBuildingId}' (OBJECTID=${objectId})`);
    } else {
      const err = updateResults[0]?.error;
      console.error(`[ArcGIS] Polygon update failed for '${arcgisBuildingId}':`, err);
    }

    return success;
  } catch (error) {
    console.error('[ArcGIS] updatePolygonAfterRegistration error:', error);
    return false;
  }
}

// ─── Write-back: Customer point upsert ───────────────────────────────────────

/**
 * Create or update a customer point in the ArcGIS Customer Layer.
 *
 * Each point represents one unit (R1, R2, C1, C2) within a building polygon.
 * The lookup key is building_id + flat_no (unit code) — if a record already
 * exists for that combination it is updated in-place; otherwise a new point
 * is added.
 *
 * This ensures one point per unit, not one point per polygon or per customer.
 *
 * Returns true on success, false on failure (non-throwing for resilience).
 */
export async function upsertCustomerPoint(
  params: CustomerPointParams
): Promise<boolean> {
  const {
    arcgisBuildingId,
    unitCode,
    lat,
    lon,
    firstName,
    lastName,
    businessName,
    phone,
    email,
    customerType,
    address,
    enumeratorName,
  } = params;

  if (!arcgisBuildingId || !unitCode) {
    console.warn('[ArcGIS] upsertCustomerPoint: missing arcgisBuildingId or unitCode — skipping');
    return false;
  }

  const escapedBuildingId = arcgisBuildingId.replace(/'/g, "''");
  const escapedUnitCode = unitCode.replace(/'/g, "''");

  const geometry = {
    x: lon,
    y: lat,
    spatialReference: { wkid: 4326 },
  };

  const attributes: Record<string, any> = {
    building_id: arcgisBuildingId,
    flat_no: unitCode,
    Lat: lat,
    Long: lon,
  };

  if (firstName) attributes.first_name = firstName;
  if (lastName) attributes.last_name = lastName;
  if (businessName) attributes.business_name = businessName;
  if (phone) attributes.cust_phone = phone;
  if (email) attributes.customer_email = email;
  if (customerType) attributes.customer_type = customerType;
  if (address) attributes.address = address;
  if (enumeratorName) attributes.Source = enumeratorName;

  try {
    // Step 1: check for an existing record with this building_id + flat_no
    const queryData = await postArcGIS(`${ARCGIS_CUSTOMER_URL}/query`, {
      where: `building_id='${escapedBuildingId}' AND flat_no='${escapedUnitCode}'`,
      outFields: 'OBJECTID',
      returnGeometry: 'false',
      resultRecordCount: '1',
    });

    const features: any[] = queryData.features ?? [];

    if (features.length > 0) {
      // Step 2a: UPDATE existing record
      const objectId = features[0].attributes.OBJECTID;
      const updateFeature = {
        geometry,
        attributes: { OBJECTID: objectId, ...attributes },
      };

      const updateData = await postArcGIS(`${ARCGIS_CUSTOMER_URL}/updateFeatures`, {
        features: JSON.stringify([updateFeature]),
        rollbackOnFailure: 'true',
      });

      const updateResults: any[] = updateData.updateResults ?? [];
      const success = updateResults.length > 0 && (updateResults[0].success === true);

      if (success) {
        console.log(`[ArcGIS] Customer point updated for building_id='${arcgisBuildingId}' unit='${unitCode}' (OBJECTID=${objectId})`);
      } else {
        const err = updateResults[0]?.error;
        console.error(`[ArcGIS] Customer point update failed for '${arcgisBuildingId}' unit='${unitCode}':`, err);
      }

      return success;
    } else {
      // Step 2b: INSERT new record
      const addFeature = { geometry, attributes };

      const addData = await postArcGIS(`${ARCGIS_CUSTOMER_URL}/addFeatures`, {
        features: JSON.stringify([addFeature]),
        rollbackOnFailure: 'true',
      });

      const addResults: any[] = addData.addResults ?? [];
      const success = addResults.length > 0 && (addResults[0].success === true);

      if (success) {
        console.log(`[ArcGIS] Customer point added for building_id='${arcgisBuildingId}' unit='${unitCode}' (OBJECTID=${addResults[0].objectId})`);
      } else {
        const err = addResults[0]?.error;
        console.error(`[ArcGIS] Customer point add failed for '${arcgisBuildingId}' unit='${unitCode}':`, err);
      }

      return success;
    }
  } catch (error) {
    console.error('[ArcGIS] upsertCustomerPoint error:', error);
    return false;
  }
}

// ─── Read-only queries (unchanged from v1.58.2) ───────────────────────────────

/**
 * Fetch building polygons within a bounding box (viewport)
 * @param bounds - Map bounds { north, south, east, west }
 * @returns Array of BuildingPolygon objects or empty array on error
 */
export async function fetchPolygonsInBounds(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<BuildingPolygon[]> {
  try {
    // ✅ POST with form body — avoids long-URL truncation in the field
    const params: Record<string, string> = {
      where: '1=1',
      geometry: JSON.stringify({
        xmin: bounds.west,
        ymin: bounds.south,
        xmax: bounds.east,
        ymax: bounds.north,
        spatialReference: { wkid: 4326 },
      }),
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects',
      outFields:
        'building_id,business_name,cust_phone,customer_email,address,Zone,socio_economic_groups',
      returnGeometry: 'true',
      f: 'json',
      token: ARCGIS_API_KEY,
    };

    console.log('[ArcGIS] Fetching polygons in bounds (POST):', bounds);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const data = await postArcGISQuery(params, controller.signal);
      clearTimeout(timeoutId);

      console.log(`[ArcGIS] Fetched ${data.features.length} polygons in viewport`);
      return data.features.map((feature) => convertArcGISFeatureToBuildingPolygon(feature));
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('[ArcGIS] Request timeout after', REQUEST_TIMEOUT, 'ms');
        throw new Error('Request timeout - ArcGIS service is slow or unavailable');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[ArcGIS] Error fetching polygons in bounds:', error);
    // Return empty array instead of throwing to allow graceful degradation
    return [];
  }
}

/**
 * Fetch building polygons within radius from a center point
 * @param lat - Center latitude (WGS84)
 * @param lon - Center longitude (WGS84)
 * @param radiusKm - Search radius in kilometers (default 5km)
 * @returns Array of BuildingPolygon objects or empty array on error
 */
export async function fetchPolygonsNearLocation(
  lat: number,
  lon: number,
  radiusKm: number = 5
): Promise<BuildingPolygon[]> {
  try {
    const radiusMeters = radiusKm * 1000;

    // ✅ POST with form body — avoids long-URL truncation in the field
    const params: Record<string, string> = {
      where: '1=1',
      geometry: JSON.stringify({
        x: lon,
        y: lat,
        spatialReference: { wkid: 4326 },
      }),
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      distance: radiusMeters.toString(),
      units: 'esriSRUnit_Meter',
      outFields:
        'building_id,business_name,cust_phone,customer_email,address,Zone,socio_economic_groups',
      returnGeometry: 'true',
      f: 'json',
      token: ARCGIS_API_KEY,
    };

    console.log('[ArcGIS] Fetching polygons near (POST):', { lat, lon, radiusKm });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const data = await postArcGISQuery(params, controller.signal);
      clearTimeout(timeoutId);

      // Comprehensive logging for debugging
      console.log('[ArcGIS] Features count:', data.features?.length || 0);

      if (!data.features || data.features.length === 0) {
        console.warn('[ArcGIS] No features returned from API');
        return [];
      }

      console.log(`[ArcGIS] Fetched ${data.features.length} polygons`);
      console.log('[ArcGIS] First feature sample:', JSON.stringify(data.features[0], null, 2));

      // Convert ArcGIS features to BuildingPolygon objects
      const polygons = data.features.map((feature) => {
        const converted = convertArcGISFeatureToBuildingPolygon(feature);
        console.log('[ArcGIS] Converted polygon:', {
          buildingId: converted.buildingId,
          center: [converted.centerLat, converted.centerLon],
          geometryType: converted.geometry.type,
          coordinatesLength: converted.geometry.coordinates.length,
        });
        return converted;
      });

      return polygons;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('[ArcGIS] Request timeout after', REQUEST_TIMEOUT, 'ms');
        throw new Error('Request timeout - ArcGIS service is slow or unavailable');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[ArcGIS] Error fetching polygons:', error);
    // Return empty array instead of throwing to allow graceful degradation
    return [];
  }
}

/**
 * Fetch a single building polygon by building ID
 * @param buildingId - Building ID to fetch
 * @returns BuildingPolygon or null if not found
 */
export async function fetchPolygonByBuildingId(
  buildingId: string
): Promise<BuildingPolygon | null> {
  try {
    // Short URL — GET is fine here (building ID string is not long)
    const params = new URLSearchParams({
      where: `building_id='${buildingId}'`,
      outFields:
        'building_id,business_name,cust_phone,customer_email,address,Zone,socio_economic_groups',
      returnGeometry: 'true',
      f: 'json',
      token: ARCGIS_API_KEY,
    });

    const url = `${ARCGIS_BASE_URL}/query?${params.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ArcGIS API request failed: ${response.status}`);
      }

      const data: ArcGISQueryResponse = await response.json();

      if (data.error) {
        throw new Error(`ArcGIS API Error: ${data.error.message}`);
      }

      if (data.features.length === 0) {
        return null;
      }

      return convertArcGISFeatureToBuildingPolygon(data.features[0]);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error('[ArcGIS] Error fetching polygon by ID:', error);
    return null;
  }
}

/**
 * Test connection to ArcGIS service
 * @returns true if connection successful, false otherwise
 */
export async function testArcGISConnection(): Promise<boolean> {
  try {
    // Short metadata URL — GET is fine here
    const url = `${ARCGIS_BASE_URL}?f=json&token=${ARCGIS_API_KEY}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      return false;
    }
  } catch (error) {
    console.error('[ArcGIS] Connection test failed:', error);
    return false;
  }
}

/**
 * Convert ArcGIS feature to BuildingPolygon
 * @param feature - ArcGIS feature
 * @returns BuildingPolygon object
 */
function convertArcGISFeatureToBuildingPolygon(feature: ArcGISFeature): BuildingPolygon {
  const { attributes, geometry } = feature;

  // Convert Web Mercator rings to WGS84
  const wgs84Rings = convertArcGISRingsToWGS84(geometry.rings);

  // Calculate center point
  const { centerLat, centerLon } = calculatePolygonCenter(wgs84Rings);

  // Create GeoJSON polygon
  const geoJsonPolygon: GeoJSON.Polygon = {
    type: 'Polygon',
    coordinates: wgs84Rings,
  };

  return {
    buildingId: attributes.building_id || '',
    businessName: attributes.business_name,
    custPhone: attributes.cust_phone,
    customerEmail: attributes.customer_email,
    address: attributes.address,
    zone: attributes.Zone,
    socioEconomicGroups: attributes.socio_economic_groups,
    geometry: geoJsonPolygon,
    centerLat,
    centerLon,
    lastUpdated: new Date(),
  };
}
