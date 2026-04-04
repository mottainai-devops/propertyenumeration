/**
 * Building Polygon Models
 * TypeScript interfaces for ArcGIS building footprint data
 */

/**
 * Building polygon — shape and status only.
 * Customer data (businessName, firstName, lastName, etc.) lives exclusively
 * in the Customer Point layer and must NOT be read from this model.
 */
export interface BuildingPolygon {
  buildingId: string;
  /** @deprecated Customer data lives in Customer Point layer, not on polygons */
  businessName?: string;
  /** @deprecated Customer data lives in Customer Point layer, not on polygons */
  firstName?: string;
  /** @deprecated Customer data lives in Customer Point layer, not on polygons */
  lastName?: string;
  /** @deprecated Customer data lives in Customer Point layer, not on polygons */
  custPhone?: string;
  /** @deprecated Customer data lives in Customer Point layer, not on polygons */
  customerEmail?: string;
  address?: string;
  zone?: string;
  socioEconomicGroups?: string;
  /** Enumeration status: 'Enumerated' | undefined */
  validation?: string;
  /** Name of enumerator who validated this building */
  validatedBy?: string;
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
    address?: string;
    Zone?: string;
    socio_economic_groups?: string;
    Validation?: string;
    Validated_By?: string;
    // Legacy fields — present on older polygon records but should be migrated to Customer Point layer
    business_name?: string;
    first_name?: string;
    last_name?: string;
    cust_phone?: string;
    customer_email?: string;
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
