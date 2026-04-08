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
  /** Unit code (R1, R2, C1, C2) — written back on registration */
  flatNo?: string;
  /** Enumeration description — written back on registration */
  description?: string;
  /** Enlistment status — written back on registration */
  enlistment?: string;
  /** LGA name from footprint layer */
  lgaName?: string;
  /** LGA code from footprint layer */
  lgaCode?: string;
  /** State code from footprint layer */
  stateCode?: string;
  /** Ward name from footprint layer */
  wardName?: string;
  /** Ward code from footprint layer */
  wardCode?: string;
  /** Building centroid latitude from footprint layer */
  footprintLat?: number;
  /** Building centroid longitude from footprint layer */
  footprintLon?: number;
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
    // New Nigeria_Building_Footprints layer field names (Zone and socio_economic_groups removed)
    Verification?: string;   // replaces old Validation field
    Source?: string;         // replaces old Validated_By field
    flat_no?: string;
    Description?: string;
    Enlistment?: string;
    lga_name?: string;
    lga_code?: string;
    state_code?: string;
    ward_name?: string;
    ward_code?: string;
    latitude?: number;
    longitude?: number;
    house_name?: string;
    // Legacy fields — present on older polygon records but should be migrated to Customer Point layer
    business_name?: string;
    first_name?: string;
    last_name?: string;
    cust_phone?: string;
    customer_email?: string;
  };
  geometry: {
    rings: number[][][]; // WGS84 coordinates (EPSG:4326) — new Nigeria_Building_Footprints layer
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
