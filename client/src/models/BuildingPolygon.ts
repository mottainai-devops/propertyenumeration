/**
 * Building Polygon Model
 * Represents a building footprint from ArcGIS Feature Service
 */

export interface BuildingPolygon {
  buildingId: string;
  businessName?: string;
  custPhone?: string;
  customerEmail?: string;
  address?: string;
  zone?: string;
  socioEconomicGroups?: string;
  geometry: GeoJSON.Polygon; // WGS84 coordinates
  centerLat: number;
  centerLon: number;
  lastUpdated: Date;
  customerLabels?: string; // e.g., "R1,R2,B1"
}

/**
 * ArcGIS Feature Response
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
    spatialReference: {
      wkid: number;
    };
  };
}

/**
 * ArcGIS Query Response
 */
export interface ArcGISQueryResponse {
  features: ArcGISFeature[];
  error?: {
    message: string;
    code: number;
  };
}

/**
 * Cache Statistics
 */
export interface CacheStats {
  polygonCount: number;
  lastUpdated: Date | null;
  location: {
    lat: number;
    lon: number;
  } | null;
}

/**
 * Polygon Sync Result
 */
export interface PolygonSyncResult {
  success: boolean;
  message: string;
  polygonCount: number;
}
