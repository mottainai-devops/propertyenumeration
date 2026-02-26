/**
 * Coordinate Conversion Utilities
 * Convert between Web Mercator (EPSG:3857) and WGS84 (EPSG:4326)
 */

const EARTH_RADIUS = 6378137.0; // Earth's radius in meters

/**
 * Convert Web Mercator coordinates to WGS84 (lat/lon)
 * @param x - Web Mercator X coordinate
 * @param y - Web Mercator Y coordinate
 * @returns Object with lat and lon in WGS84
 */
export function webMercatorToWGS84(x: number, y: number): { lat: number; lon: number } {
  const lon = (x / EARTH_RADIUS) * (180 / Math.PI);
  const lat =
    (Math.PI / 2 - 2 * Math.atan(Math.exp(-y / EARTH_RADIUS))) * (180 / Math.PI);

  return { lat, lon };
}

/**
 * Convert WGS84 (lat/lon) to Web Mercator coordinates
 * @param lat - Latitude in WGS84
 * @param lon - Longitude in WGS84
 * @returns Object with x and y in Web Mercator
 */
export function wgs84ToWebMercator(lat: number, lon: number): { x: number; y: number } {
  const x = lon * (Math.PI / 180) * EARTH_RADIUS;
  const y =
    Math.log(Math.tan((Math.PI / 4) + (lat * (Math.PI / 180)) / 2)) * EARTH_RADIUS;

  return { x, y };
}

/**
 * Convert ArcGIS polygon rings from Web Mercator to WGS84
 * @param rings - Array of polygon rings in Web Mercator
 * @returns Array of polygon rings in WGS84 (GeoJSON format: [lon, lat])
 */
export function convertArcGISRingsToWGS84(rings: number[][][]): number[][][] {
  return rings.map((ring) =>
    ring.map(([x, y]) => {
      const { lat, lon } = webMercatorToWGS84(x, y);
      return [lon, lat]; // GeoJSON format: [longitude, latitude]
    })
  );
}

/**
 * Calculate center point of a polygon
 * @param coordinates - GeoJSON polygon coordinates
 * @returns Object with centerLat and centerLon
 */
export function calculatePolygonCenter(coordinates: number[][][]): {
  centerLat: number;
  centerLon: number;
} {
  if (!coordinates || coordinates.length === 0 || coordinates[0].length === 0) {
    return { centerLat: 0, centerLon: 0 };
  }

  const ring = coordinates[0]; // Use first ring (exterior boundary)
  let sumLat = 0;
  let sumLon = 0;

  for (const [lon, lat] of ring) {
    sumLat += lat;
    sumLon += lon;
  }

  return {
    centerLat: sumLat / ring.length,
    centerLon: sumLon / ring.length,
  };
}
