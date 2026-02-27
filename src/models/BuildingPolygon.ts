/**
 * Building Polygon Models
 * TypeScript interfaces for ArcGIS building footprint data
 */

/**
 * Building polygon with geometry and metadata
 */
export interface BuildingPolygon {
  buildingId: string;
  businessName?: string;
  custPhone?: string;
  customerEmail?: string;
  address?: string;
  zone?: string;
  socioEconomicGroups?: string;
  geometry: GeoJSON.Polygon;
  centerLat: number;
  centerLon: number;
  lastUpdated: Date;
}

/**
 * ArcGIS Feature Service response
 */
export interface ArcGISQueryResponse {
  features: ArcGISFeature[];
  error?: {
    code: number;
    message: string;
  };
}

/**
 * ArcGIS feature from Feature Service
 */
export interface ArcGISFeature {
  attributes: {
    building_id: string;
    business_name?: string;
    cust_phone?: string;
    customer_email?: string;
    address?: string;
    Zone?: string;
    socio_economic_groups?: string;
  };
  geometry: {
    rings: number[][][]; // Web Mercator coordinates
  };
}

/**
 * Cache statistics
 */
export interface CacheStats {
  polygonCount: number;
  lastUpdated: Date | null;
  cacheSize?: number; // in bytes (optional)
  location?: { lat: number; lon: number } | null; // cached location
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  message: string;
  polygonsFetched?: number;
  polygonsCached?: number;
}

/**
 * Polygon sync result (for cache service)
 */
export interface PolygonSyncResult {
  success: boolean;
  message: string;
  polygonCount: number;
}
