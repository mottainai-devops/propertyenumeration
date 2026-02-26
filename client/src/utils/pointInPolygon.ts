/**
 * Point-in-Polygon Detection
 * Uses ray casting algorithm to determine if a point is inside a polygon
 */

import type { BuildingPolygon } from '../models/BuildingPolygon';

/**
 * Check if a point is inside a polygon using ray casting algorithm
 * @param point - Point with lat and lon
 * @param polygon - Building polygon
 * @returns true if point is inside polygon, false otherwise
 */
export function isPointInPolygon(
  point: { lat: number; lon: number },
  polygon: BuildingPolygon
): boolean {
  try {
    const coordinates = polygon.geometry.coordinates;

    if (!coordinates || coordinates.length === 0) {
      return false;
    }

    // Use first ring (exterior boundary)
    const ring = coordinates[0];

    // Ray casting algorithm
    let inside = false;
    let j = ring.length - 1;

    for (let i = 0; i < ring.length; i++) {
      const [xi, yi] = ring[i]; // [lon, lat] in GeoJSON format
      const [xj, yj] = ring[j];

      const intersect =
        yi > point.lat !== yj > point.lat &&
        point.lon < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;

      if (intersect) {
        inside = !inside;
      }

      j = i;
    }

    return inside;
  } catch (error) {
    console.error('Error checking point in polygon:', error);
    return false;
  }
}

/**
 * Find polygon at a given point
 * @param point - Point with lat and lon
 * @param polygons - Array of building polygons
 * @returns BuildingPolygon if found, null otherwise
 */
export function findPolygonAtPoint(
  point: { lat: number; lon: number },
  polygons: BuildingPolygon[]
): BuildingPolygon | null {
  for (const polygon of polygons) {
    if (isPointInPolygon(point, polygon)) {
      return polygon;
    }
  }
  return null;
}
