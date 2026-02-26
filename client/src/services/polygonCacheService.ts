/**
 * Polygon Cache Service
 * Caches building polygons in IndexedDB for offline access
 */

import localforage from 'localforage';
import type { BuildingPolygon, CacheStats, PolygonSyncResult } from '../models/BuildingPolygon';
import { fetchPolygonsNearLocation } from './arcgisService';

// Configure localforage for polygon caching
const polygonCache = localforage.createInstance({
  name: 'propertyEnumeration',
  storeName: 'polygons',
  description: 'Building polygon cache for offline access',
});

interface CachedPolygonData {
  polygons: BuildingPolygon[];
  timestamp: number;
  location: {
    lat: number;
    lon: number;
  };
  radiusKm: number;
}

const CACHE_KEY = 'cachedPolygons';
const CACHE_EXPIRY_DAYS = 7;

/**
 * Sync polygons for current location (fetch from ArcGIS and cache)
 * @param lat - Center latitude
 * @param lon - Center longitude
 * @param radiusKm - Search radius in kilometers
 * @returns PolygonSyncResult with success status and message
 */
export async function syncPolygonsForLocation(
  lat: number,
  lon: number,
  radiusKm: number = 5
): Promise<PolygonSyncResult> {
  try {
    console.log('[PolygonCache] Syncing polygons from ArcGIS...');

    // Fetch polygons from ArcGIS
    const polygons = await fetchPolygonsNearLocation(lat, lon, radiusKm);

    if (polygons.length === 0) {
      return {
        success: true,
        message: 'No polygons found in this area',
        polygonCount: 0,
      };
    }

    // Cache polygons
    const cacheData: CachedPolygonData = {
      polygons,
      timestamp: Date.now(),
      location: { lat, lon },
      radiusKm,
    };

    await polygonCache.setItem(CACHE_KEY, cacheData);

    console.log(`[PolygonCache] Cached ${polygons.length} polygons`);

    return {
      success: true,
      message: `Successfully synced ${polygons.length} building polygons`,
      polygonCount: polygons.length,
    };
  } catch (error) {
    console.error('[PolygonCache] Sync failed:', error);
    return {
      success: false,
      message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      polygonCount: 0,
    };
  }
}

/**
 * Get cached polygons near location (offline-capable)
 * @param lat - Center latitude
 * @param lon - Center longitude
 * @param radiusKm - Search radius in kilometers
 * @returns Array of BuildingPolygon objects
 */
export async function getCachedPolygonsNearLocation(
  lat: number,
  lon: number,
  radiusKm: number = 5
): Promise<BuildingPolygon[]> {
  try {
    const cacheData = await polygonCache.getItem<CachedPolygonData>(CACHE_KEY);

    if (!cacheData) {
      console.log('[PolygonCache] No cached data found');
      return [];
    }

    // Check if cached location is within reasonable distance
    const distance = calculateDistance(
      lat,
      lon,
      cacheData.location.lat,
      cacheData.location.lon
    );

    // If user moved more than 2km from cached location, return empty
    if (distance > 2) {
      console.log('[PolygonCache] User moved too far from cached location');
      return [];
    }

    console.log(`[PolygonCache] Loaded ${cacheData.polygons.length} cached polygons`);
    return cacheData.polygons;
  } catch (error) {
    console.error('[PolygonCache] Error loading cached polygons:', error);
    return [];
  }
}

/**
 * Get polygon by building ID from cache
 * @param buildingId - Building ID to find
 * @returns BuildingPolygon or null if not found
 */
export async function getPolygonByBuildingId(
  buildingId: string
): Promise<BuildingPolygon | null> {
  try {
    const cacheData = await polygonCache.getItem<CachedPolygonData>(CACHE_KEY);

    if (!cacheData) {
      return null;
    }

    const polygon = cacheData.polygons.find((p) => p.buildingId === buildingId);
    return polygon || null;
  } catch (error) {
    console.error('[PolygonCache] Error getting polygon by ID:', error);
    return null;
  }
}

/**
 * Get cache statistics
 * @returns CacheStats object
 */
export async function getCacheStats(): Promise<CacheStats> {
  try {
    const cacheData = await polygonCache.getItem<CachedPolygonData>(CACHE_KEY);

    if (!cacheData) {
      return {
        polygonCount: 0,
        lastUpdated: null,
        location: null,
      };
    }

    return {
      polygonCount: cacheData.polygons.length,
      lastUpdated: new Date(cacheData.timestamp),
      location: cacheData.location,
    };
  } catch (error) {
    console.error('[PolygonCache] Error getting cache stats:', error);
    return {
      polygonCount: 0,
      lastUpdated: null,
      location: null,
    };
  }
}

/**
 * Check if cache needs refresh (older than 7 days)
 * @returns true if cache needs refresh, false otherwise
 */
export async function needsRefresh(): Promise<boolean> {
  try {
    const cacheData = await polygonCache.getItem<CachedPolygonData>(CACHE_KEY);

    if (!cacheData) {
      return true;
    }

    const age = Date.now() - cacheData.timestamp;
    const maxAge = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    return age > maxAge;
  } catch (error) {
    return true;
  }
}

/**
 * Clear all cached polygons
 * @returns true if successful, false otherwise
 */
export async function clearCache(): Promise<boolean> {
  try {
    await polygonCache.removeItem(CACHE_KEY);
    console.log('[PolygonCache] Cache cleared');
    return true;
  } catch (error) {
    console.error('[PolygonCache] Error clearing cache:', error);
    return false;
  }
}

/**
 * Format cache age for display
 * @param lastUpdated - Last update date
 * @returns Formatted string like "2 hours ago"
 */
export function formatCacheAge(lastUpdated: Date | null): string {
  if (!lastUpdated) {
    return 'Never';
  }

  const now = new Date();
  const diffMs = now.getTime() - lastUpdated.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffHours < 1) {
    return `${diffMinutes} min ago`;
  } else if (diffDays < 1) {
    return `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return lastUpdated.toLocaleDateString();
  }
}

/**
 * Calculate distance between two points (Haversine formula)
 * @param lat1 - Latitude of point 1
 * @param lon1 - Longitude of point 1
 * @param lat2 - Latitude of point 2
 * @param lon2 - Longitude of point 2
 * @returns Distance in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
