import type { BuildingPolygon } from '../models/BuildingPolygon';

/**
 * Mock building polygon data for Lagos area (around Ikeja)
 * Used for testing polygon rendering when ArcGIS API is unavailable
 */
const now = new Date();

export const MOCK_POLYGONS: BuildingPolygon[] = [
  {
    buildingId: 'BLD-001',
    address: '1 Obafemi Awolowo Way, Ikeja',
    businessName: 'Sample Building 1',
    zone: 'Ikeja GRA',
    centerLat: 6.5944,
    centerLon: 3.3406,
    lastUpdated: now,
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [3.3405, 6.5945],
        [3.3407, 6.5945],
        [3.3407, 6.5943],
        [3.3405, 6.5943],
        [3.3405, 6.5945],
      ]],
    },
  },
  {
    buildingId: 'BLD-002',
    address: '2 Obafemi Awolowo Way, Ikeja',
    businessName: 'Sample Building 2',
    zone: 'Ikeja GRA',
    centerLat: 6.5946,
    centerLon: 3.3408,
    lastUpdated: now,
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [3.3407, 6.5947],
        [3.3409, 6.5947],
        [3.3409, 6.5945],
        [3.3407, 6.5945],
        [3.3407, 6.5947],
      ]],
    },
  },
  {
    buildingId: 'BLD-003',
    address: '3 Oba Akran Avenue, Ikeja',
    businessName: 'Sample Building 3',
    zone: 'Ikeja',
    centerLat: 6.5948,
    centerLon: 3.3410,
    lastUpdated: now,
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [3.3409, 6.5949],
        [3.3411, 6.5949],
        [3.3411, 6.5947],
        [3.3409, 6.5947],
        [3.3409, 6.5949],
      ]],
    },
  },
  {
    buildingId: 'BLD-004',
    address: '4 Allen Avenue, Ikeja',
    businessName: 'Sample Building 4',
    zone: 'Ikeja',
    centerLat: 6.5950,
    centerLon: 3.3412,
    lastUpdated: now,
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [3.3411, 6.5951],
        [3.3413, 6.5951],
        [3.3413, 6.5949],
        [3.3411, 6.5949],
        [3.3411, 6.5951],
      ]],
    },
  },
  {
    buildingId: 'BLD-005',
    address: '5 Toyin Street, Ikeja',
    businessName: 'Sample Building 5',
    zone: 'Ikeja',
    centerLat: 6.5952,
    centerLon: 3.3414,
    lastUpdated: now,
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [3.3413, 6.5953],
        [3.3415, 6.5953],
        [3.3415, 6.5951],
        [3.3413, 6.5951],
        [3.3413, 6.5953],
      ]],
    },
  },
];

/**
 * Get mock polygons for testing
 */
export function getMockPolygons(): BuildingPolygon[] {
  console.log('[MockData] Returning 5 mock polygons for testing');
  return MOCK_POLYGONS;
}
