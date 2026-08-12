/**
 * ArcGIS Service
 * Fetches building polygons from ArcGIS Feature Service with error handling
 *
 * NOTE: All spatial queries use HTTP POST with application/x-www-form-urlencoded
 * body instead of GET with URL query parameters. The GET URLs exceed ~600 chars
 * and are silently dropped by the network path in the field (HTTP 000 / empty
 * response on long GET, HTTP 200 with full results on POST).
 * Ref: Fix Specification — arcgis_service.dart (Backend Team, 2026-03-10)
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

// ArcGIS Feature Service endpoint
const ARCGIS_BASE_URL =
  'https://services3.arcgis.com/VYBpf26AGQNwssLH/arcgis/rest/services/New_Footprints_gdb_b1422/FeatureServer/0';

// This Feature Service is publicly readable. Do not attach an ArcGIS token here:
// the previous static token had become invalid and caused ArcGIS error 498.

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 15000;

/**
 * Internal helper: POST a query to the ArcGIS Feature Service.
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

/**
 * Fetch building polygons within a bounding box (viewport)
 * @param bounds - Map bounds { north, south, east, west }
 * @returns Array of BuildingPolygon objects or empty array on error
 */
export async function fetchPolygonsInBounds(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<BuildingPolygon[]> {
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
      outFields:
        'building_id,business_name,cust_phone,customer_email,address,Zone,socio_economic_groups',
      returnGeometry: 'true',
      f: 'json',
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

    // ✅ Use POST with form-encoded body to avoid long-URL truncation
    //    (GET URLs exceed ~600 chars and are silently dropped in the field).
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
    // Short metadata URL — GET is fine here. The layer is publicly readable.
    const url = `${ARCGIS_BASE_URL}?f=json`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) return false;
      const data: ArcGISQueryResponse = await response.json();
      return !data.error;
    } catch {
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
