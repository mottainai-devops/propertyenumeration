/**
 * ArcGIS Service
 * Fetches building polygons from ArcGIS Feature Service with error handling
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

// ArcGIS API Key
const ARCGIS_API_KEY =
  'AAPTxy8BH1VEsoebNVZXo8HurDkT4HeplNOm_pLCsV2-wHXD7esJFqWCGo3oDxTaOVO68fIzhjQ4gSKqccl-uynuHunhlN5t3E_x5N010mOKYQRyFm3vYXqvila3dJ3Ax81DMK2WyxFt6mqhwzxdkdhmm7USv7-cQi07L_22-MTRC95Rns1BHueP3kR_yXyAyh1WEFAm9Q7KFELPkRpT_5cjWvbDo2rWZhtHOb5xFr_7bOA.AT1_n5wNkDcc';

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 15000;

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

    // Build query parameters
    const params = new URLSearchParams({
      where: '1=1', // Get all features within geometry
      geometry: JSON.stringify({
        x: lon,
        y: lat,
        spatialReference: { wkid: 4326 }, // WGS84
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
    });

    const url = `${ARCGIS_BASE_URL}/query?${params.toString()}`;
    console.log('[ArcGIS] Fetching polygons near:', { lat, lon, radiusKm });

    // Create abort controller for timeout
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

      console.log(`[ArcGIS] Fetched ${data.features.length} polygons`);

      // Convert ArcGIS features to BuildingPolygon objects
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
