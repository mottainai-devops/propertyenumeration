/**
 * Simple Polygon Cache Service
 * Simplified caching using localStorage (no IndexedDB dependencies)
 */

import type { BuildingPolygon } from '../models/BuildingPolygon';

const CACHE_KEY = 'building_polygons_cache';
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheData {
  polygons: BuildingPolygon[];
  timestamp: number;
  location: { lat: number; lon: number };
}

/**
 * Save polygons to cache
 */
export function savePolygonsToCache(polygons: BuildingPolygon[], lat: number, lon: number): void {
  try {
    const cacheData: CacheData = {
      polygons,
      timestamp: Date.now(),
      location: { lat, lon },
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    console.log(`[SimpleCache] Cached ${polygons.length} polygons`);
  } catch (error) {
    console.error('[SimpleCache] Error saving to cache:', error);
  }
}

/**
 * Get cached polygons near location
 */
export function getCachedPolygonsNearLocation(lat: number, lon: number, radiusKm: number = 5): BuildingPolygon[] {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      return [];
    }

    const cacheData: CacheData = JSON.parse(cached);

    // Check if cache is expired
    if (Date.now() - cacheData.timestamp > CACHE_EXPIRY_MS) {
      console.log('[SimpleCache] Cache expired');
      return [];
    }

    // Check if location is within radius
    const distance = calculateDistance(lat, lon, cacheData.location.lat, cacheData.location.lon);
    if (distance > radiusKm) {
      console.log('[SimpleCache] Location too far from cache');
      return [];
    }

    console.log(`[SimpleCache] Loaded ${cacheData.polygons.length} cached polygons`);
    return cacheData.polygons;
  } catch (error) {
    console.error('[SimpleCache] Error loading from cache:', error);
    return [];
  }
}

/**
 * Clear cache
 */
export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Calculate distance between two points (Haversine formula)
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
