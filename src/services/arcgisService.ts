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
  calculatePolygonCenter,
} from '../utils/coordinateConversion';
// NOTE: convertArcGISRingsToWGS84 is intentionally NOT imported.
// The new Nigeria_Building_Footprints layer stores rings in WGS84 (EPSG:4326) natively.
// Applying the Web Mercator conversion would corrupt coordinates.

// ─── Endpoint constants ───────────────────────────────────────────────────────

/** Building polygon layer (parent) — Nigeria_Building_Footprints (WGS84 native, replaced 2026-04-07) */
const ARCGIS_POLYGON_URL =
  'https://services3.arcgis.com/VYBpf26AGQNwssLH/arcgis/rest/services/Nigeria_Building_Footprints/FeatureServer/0';

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

// ─── Customer Layer read (v1.59.0) ──────────────────────────────────────────────

/**
 * A single customer point record from the ArcGIS Customer Layer.
 * Used to enrich building polygon labels with live customer data.
 */
export interface CustomerPoint {
  buildingId: string;
  unitCode?: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  phone?: string;
  email?: string;
  customerType?: string;
  address?: string;
  lat?: number;
  lon?: number;
}

/**
 * Fetch all customer points within a bounding box from the Customer Layer.
 * Returns a map keyed by building_id for O(1) lookup when enriching polygons.
 *
 * Only fetches the label-relevant fields (building_id, first_name, last_name,
 * business_name) to keep the payload small. Uses POST to avoid URL truncation.
 *
 * IMPORTANT: The Customer Layer geometry is stored in Web Mercator (EPSG:3857)
 * but the app works in WGS84. We must pass inSR=4326 so ArcGIS correctly
 * interprets the bounding box coordinates as WGS84 degrees.
 *
 * Returns an empty map on any error (non-throwing for resilience).
 */
export async function fetchCustomerPointsInBounds(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<Map<string, CustomerPoint>> {
  const result = new Map<string, CustomerPoint>();
  try {
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
      inSR: '4326',
      outFields: 'building_id,first_name,last_name,business_name,cust_phone,customer_email,customer_type,address,flat_no,Lat,Long',
      returnGeometry: 'false',
      resultRecordCount: '4000',
      f: 'json',
      token: ARCGIS_API_KEY,
    };

    const body = new URLSearchParams(params);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(`${ARCGIS_CUSTOMER_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const features: any[] = data.features ?? [];
    console.log(`[CustomerLayer] Fetched ${features.length} customer points in viewport`);

    for (const f of features) {
      const a = f.attributes;
      const buildingId: string = a.building_id ?? '';
      if (!buildingId) continue;
      // Prefer the most informative record if multiple units exist for same building
      if (!result.has(buildingId)) {
        result.set(buildingId, {
          buildingId,
          unitCode: a.flat_no ?? undefined,
          firstName: a.first_name ?? undefined,
          lastName: a.last_name ?? undefined,
          businessName: a.business_name ?? undefined,
          phone: a.cust_phone ?? undefined,
          email: a.customer_email ?? undefined,
          customerType: a.customer_type ?? undefined,
          address: a.address ?? undefined,
          lat: a.Lat ?? undefined,
          lon: a.Long ?? undefined,
        });
      }
    }
  } catch (error) {
    console.warn('[CustomerLayer] fetchCustomerPointsInBounds failed (non-critical):', error);
  }
  return result;
}

/**
 * Fetch all customer points for a specific lot by matching the building_id
 * suffix pattern (e.g. all building_ids ending in 'LASKSE05 242').
 *
 * This is the fallback for lots where customer points have null Lat/Long
 * coordinates (e.g. LOT-242 Anthony, Kosofe) and cannot be found via
 * spatial queries. Uses the building_id field directly.
 *
 * Returns a map keyed by building_id for O(1) lookup.
 * Returns an empty map on any error (non-throwing for resilience).
 */
export async function fetchCustomerPointsForLot(
  lotBuildingIdSuffix: string
): Promise<Map<string, CustomerPoint>> {
  const result = new Map<string, CustomerPoint>();
  if (!lotBuildingIdSuffix) return result;

  try {
    const escaped = lotBuildingIdSuffix.replace(/'/g, "''");
    const params: Record<string, string> = {
      where: `building_id LIKE '%${escaped}'`,
      outFields: 'building_id,first_name,last_name,business_name,cust_phone,customer_email,customer_type,address,flat_no,Lat,Long',
      returnGeometry: 'false',
      resultRecordCount: '10000',
      f: 'json',
      token: ARCGIS_API_KEY,
    };

    const body = new URLSearchParams(params);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${ARCGIS_CUSTOMER_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const features: any[] = data.features ?? [];
    console.log(`[CustomerLayer] fetchCustomerPointsForLot('${lotBuildingIdSuffix}'): ${features.length} records`);

    for (const f of features) {
      const a = f.attributes;
      const buildingId: string = a.building_id ?? '';
      if (!buildingId) continue;
      // Keep the most informative record per building (prefer records with a name)
      const existing = result.get(buildingId);
      const hasName = !!(a.business_name || a.first_name || a.last_name);
      if (!existing || hasName) {
        result.set(buildingId, {
          buildingId,
          unitCode: a.flat_no ?? undefined,
          firstName: a.first_name ?? undefined,
          lastName: a.last_name ?? undefined,
          businessName: a.business_name ?? undefined,
          phone: a.cust_phone ?? undefined,
          email: a.customer_email ?? undefined,
          customerType: a.customer_type ?? undefined,
          address: a.address ?? undefined,
          lat: a.Lat ?? undefined,
          lon: a.Long ?? undefined,
        });
      }
    }
  } catch (error) {
    console.warn(`[CustomerLayer] fetchCustomerPointsForLot failed (non-critical):`, error);
  }
  return result;
}

// ─── Two-phase progressive loader (v1.59.2) ─────────────────────────────────

/**
 * Convert a MongoDB lotCode (e.g. "LOT-242", "MOT-027") to the ArcGIS Lot_ID
 * string (e.g. "242", "027") used in the Footprint layer.
 *
 * Rules:
 *   1. Strip any alphabetic prefix up to and including the first hyphen.
 *   2. The remaining numeric string is the Lot_ID (ArcGIS stores it as a
 *      zero-padded 3-digit string, e.g. "006", "027", "242").
 *   3. If the input already looks like a bare number, use it as-is.
 */
export function lotCodeToArcGISLotId(lotCode: string): string | null {
  if (!lotCode) return null;
  // Strip prefix like "LOT-", "MOT-", "ADK-", "AFT-", etc.
  const match = lotCode.match(/(?:^[A-Z]+-)(\d+)$/);
  if (match) return match[1]; // e.g. "242", "027"
  // Already numeric
  if (/^\d+$/.test(lotCode)) return lotCode;
  return null;
}

/**
 * Fetch a single batch of building polygons by OBJECTID list.
 * Used internally by fetchPolygonsForLotProgressive.
 */
async function fetchPolygonsByObjectIds(
  objectIds: number[]
): Promise<BuildingPolygon[]> {
  if (objectIds.length === 0) return [];
  const params: Record<string, string> = {
    objectIds: objectIds.join(','),
    outFields:
      'building_id,address,Zone,socio_economic_groups,Validation,Validated_By,lga_name,lga_code,state_code,ward_name,ward_code,latitude,longitude,house_name,flat_no,Description,Enlistment',
    returnGeometry: 'true',
    f: 'json',
    token: ARCGIS_API_KEY,
  };
  const body = new URLSearchParams(params);
  const response = await fetch(`${ARCGIS_BASE_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return (data.features ?? []).map((f: ArcGISFeature) =>
    convertArcGISFeatureToBuildingPolygon(f)
  );
}

/**
 * Progressive two-phase polygon loader.
 *
 * Phase 1 (~2.5s): Fetch all OBJECTIDs for the lot using a lightweight
 *   attribute-only query filtered by Lot_ID. No geometry, no spatial index.
 *
 * Phase 2 (~2s per 400): Stream geometry in parallel batches of BATCH_SIZE.
 *   The first INITIAL_BATCHES batches are awaited before returning so the
 *   map gets its first polygons quickly. Remaining batches are dispatched
 *   in the background and delivered via the onBatch callback.
 *
 * Falls back to the legacy spatial query if lotCode cannot be mapped.
 *
 * @param lotCode    MongoDB lotCode (e.g. "LOT-242")
 * @param onBatch    Called with each subsequent batch of polygons after the
 *                   initial set has been returned. Use this to merge into
 *                   the map's polygon state progressively.
 * @returns          First INITIAL_BATCHES × BATCH_SIZE polygons (or all if
 *                   the lot is small), ready to render immediately.
 */
export async function fetchPolygonsForLotProgressive(
  lotCode: string,
  onBatch: (polygons: BuildingPolygon[]) => void
): Promise<BuildingPolygon[]> {
  const BATCH_SIZE = 100;
  const PARALLEL_WORKERS = 4;
  const INITIAL_BATCHES = 4; // First 400 polygons returned synchronously

  const lotId = lotCodeToArcGISLotId(lotCode);
  if (!lotId) {
    console.warn(`[Progressive] Cannot map lotCode '${lotCode}' to ArcGIS Lot_ID — falling back to legacy loader`);
    return [];
  }

  console.log(`[Progressive] Phase 1: fetching OBJECTIDs for Lot_ID='${lotId}'`);
  const t0 = Date.now();

  // Phase 1: Get all OBJECTIDs (fast — attribute-only, no geometry)
  const body1 = new URLSearchParams({
    where: `Lot_ID='${lotId}'`,
    returnIdsOnly: 'true',
    f: 'json',
    token: ARCGIS_API_KEY,
  });
  const res1 = await fetch(`${ARCGIS_BASE_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body1.toString(),
  });
  if (!res1.ok) throw new Error(`Phase 1 HTTP ${res1.status}`);
  const data1 = await res1.json();
  if (data1.error) throw new Error(data1.error.message);

  const allIds: number[] = data1.objectIds ?? [];
  console.log(`[Progressive] Phase 1 done: ${allIds.length} OBJECTIDs in ${Date.now() - t0}ms`);

  if (allIds.length === 0) return [];

  // Split into batches of BATCH_SIZE
  const batches: number[][] = [];
  for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
    batches.push(allIds.slice(i, i + BATCH_SIZE));
  }

  // Phase 2a: Fetch first INITIAL_BATCHES × PARALLEL_WORKERS batches in parallel (synchronous return)
  const initialBatchCount = Math.min(INITIAL_BATCHES, batches.length);
  const initialBatches = batches.slice(0, initialBatchCount);
  const remainingBatches = batches.slice(initialBatchCount);

  console.log(`[Progressive] Phase 2a: fetching first ${initialBatchCount} batches (${initialBatchCount * BATCH_SIZE} polygons) in parallel`);
  const t1 = Date.now();

  // Run initial batches in parallel groups of PARALLEL_WORKERS
  const initialPolygons: BuildingPolygon[] = [];
  for (let i = 0; i < initialBatches.length; i += PARALLEL_WORKERS) {
    const group = initialBatches.slice(i, i + PARALLEL_WORKERS);
    const results = await Promise.all(group.map(fetchPolygonsByObjectIds));
    results.forEach(r => initialPolygons.push(...r));
  }
  console.log(`[Progressive] Phase 2a done: ${initialPolygons.length} polygons in ${Date.now() - t1}ms`);

  // Phase 2b: Stream remaining batches in the background
  if (remainingBatches.length > 0) {
    console.log(`[Progressive] Phase 2b: streaming ${remainingBatches.length} remaining batches in background`);
    (async () => {
      for (let i = 0; i < remainingBatches.length; i += PARALLEL_WORKERS) {
        const group = remainingBatches.slice(i, i + PARALLEL_WORKERS);
        try {
          const results = await Promise.all(group.map(fetchPolygonsByObjectIds));
          const batch: BuildingPolygon[] = [];
          results.forEach(r => batch.push(...r));
          if (batch.length > 0) onBatch(batch);
        } catch (e) {
          console.warn('[Progressive] Background batch failed:', e);
        }
      }
      console.log('[Progressive] Phase 2b complete — all batches delivered');
    })();
  }

  return initialPolygons;
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
        'building_id,address,Zone,socio_economic_groups,Validation,Validated_By,lga_name,lga_code,state_code,ward_name,ward_code,latitude,longitude,house_name,flat_no,Description,Enlistment',
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
        'building_id,address,Zone,socio_economic_groups,Validation,Validated_By,lga_name,lga_code,state_code,ward_name,ward_code,latitude,longitude,house_name,flat_no,Description,Enlistment',
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
        'building_id,address,Zone,socio_economic_groups,Validation,Validated_By,lga_name,lga_code,state_code,ward_name,ward_code,latitude,longitude,house_name,flat_no,Description,Enlistment',
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

  // Nigeria_Building_Footprints layer stores rings in WGS84 (EPSG:4326) natively.
  // NO coordinate conversion needed — use rings directly as GeoJSON [lon, lat] pairs.
  const wgs84Rings = geometry.rings;

  // Calculate center point from WGS84 rings
  const { centerLat, centerLon } = calculatePolygonCenter(wgs84Rings);

  // Create GeoJSON polygon
  const geoJsonPolygon: GeoJSON.Polygon = {
    type: 'Polygon',
    coordinates: wgs84Rings,
  };

  return {
    buildingId: attributes.building_id || '',
    // Customer data lives exclusively in the Customer Point layer.
    // These fields are intentionally NOT read from the polygon layer.
    businessName: undefined,
    firstName: undefined,
    lastName: undefined,
    custPhone: undefined,
    customerEmail: undefined,
    address: attributes.address,
    zone: attributes.Zone,
    socioEconomicGroups: attributes.socio_economic_groups,
    // Enumeration status fields (written back after registration)
    validation: attributes.Validation,
    validatedBy: attributes.Validated_By,
    flatNo: attributes.flat_no,
    description: attributes.Description,
    enlistment: attributes.Enlistment,
    // Administrative geo fields from footprint layer
    lgaName: attributes.lga_name,
    lgaCode: attributes.lga_code,
    stateCode: attributes.state_code,
    wardName: attributes.ward_name,
    wardCode: attributes.ward_code,
    footprintLat: attributes.latitude,
    footprintLon: attributes.longitude,
    geometry: geoJsonPolygon,
    centerLat,
    centerLon,
    lastUpdated: new Date(),
  };
}
