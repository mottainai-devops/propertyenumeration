/**
 * Enhanced Location Map Component
 * Interactive map with building polygons, labels, and GPS location
 */

import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { BuildingPolygon } from '../models/BuildingPolygon';
import {
  getCachedPolygonsNearLocation,
  syncPolygonsForLocation,
  getCacheStats,
  needsRefresh,
  formatCacheAge,
} from '../services/polygonCacheService';
import { findPolygonAtPoint } from '../utils/pointInPolygon';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface EnhancedLocationMapProps {
  onLocationSelected: (lat: number, lon: number) => void;
  onBuildingSelected?: (polygon: BuildingPolygon) => void;
  initialLat?: number;
  initialLon?: number;
}

// Color palette for polygons (15 distinct colors)
const POLYGON_COLORS = [
  '#E91E63', // Pink
  '#9C27B0', // Purple
  '#673AB7', // Deep Purple
  '#3F51B5', // Indigo
  '#2196F3', // Blue
  '#00BCD4', // Cyan
  '#009688', // Teal
  '#4CAF50', // Green
  '#8BC34A', // Light Green
  '#CDDC39', // Lime
  '#FFEB3B', // Yellow
  '#FFC107', // Amber
  '#FF9800', // Orange
  '#FF5722', // Deep Orange
  '#F44336', // Red
];

/**
 * Get consistent color for a building based on its ID
 */
function getPolygonColor(buildingId: string): string {
  const hash = buildingId.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  return POLYGON_COLORS[Math.abs(hash) % POLYGON_COLORS.length];
}

/**
 * Map event handler component
 */
function MapEventHandler({
  onMapClick,
  onLocationUpdate,
}: {
  onMapClick: (lat: number, lon: number) => void;
  onLocationUpdate: (lat: number, lon: number) => void;
}) {
  const map = useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
    locationfound: (e) => {
      onLocationUpdate(e.latlng.lat, e.latlng.lng);
      map.flyTo(e.latlng, 18);
    },
  });

  return null;
}

/**
 * Component to move map to location
 */
function MapMover({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);

  return null;
}

export default function EnhancedLocationMap({
  onLocationSelected,
  onBuildingSelected,
  initialLat,
  initialLon,
}: EnhancedLocationMapProps) {
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null);
  const [polygons, setPolygons] = useState<BuildingPolygon[]>([]);
  const [selectedPolygon, setSelectedPolygon] = useState<BuildingPolygon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPolygons, setIsLoadingPolygons] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<string>('');
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const mapRef = useRef<L.Map | null>(null);

  // Initialize location on mount
  useEffect(() => {
    initializeLocation();
  }, []);

  /**
   * Initialize GPS location
   */
  async function initializeLocation() {
    try {
      setIsLoading(true);
      setError(null);

      // Get current location
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const acc = position.coords.accuracy;

            setCurrentLocation([lat, lon]);
            setAccuracy(acc);

            // Use initial location if provided, otherwise use current location
            if (initialLat && initialLon) {
              setSelectedLocation([initialLat, initialLon]);
            } else {
              setSelectedLocation([lat, lon]);
              onLocationSelected(lat, lon);
            }

            setIsLoading(false);

            // Load polygons for current location
            await loadPolygonsForCurrentLocation(lat, lon);
          },
          (error) => {
            console.error('Geolocation error:', error);
            setError(`Failed to get location: ${error.message}`);
            setIsLoading(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      } else {
        setError('Geolocation is not supported by your device');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error initializing location:', error);
      setError('Failed to initialize location');
      setIsLoading(false);
    }
  }

  /**
   * Load polygons for current location
   */
  async function loadPolygonsForCurrentLocation(lat: number, lon: number) {
    setIsLoadingPolygons(true);

    try {
      // First, try to load from cache
      const cachedPolygons = await getCachedPolygonsNearLocation(lat, lon, 5.0);
      setPolygons(cachedPolygons);

      console.log(`Loaded ${cachedPolygons.length} cached polygons`);

      // Get cache stats
      const stats = await getCacheStats();
      const cacheText = `${stats.polygonCount} buildings cached • ${formatCacheAge(stats.lastUpdated)}`;
      setCacheInfo(cacheText);

      // If cache is empty or needs refresh, sync from ArcGIS
      if (cachedPolygons.length === 0 || (await needsRefresh())) {
        await syncPolygons(lat, lon);
      } else {
        setIsLoadingPolygons(false);
      }
    } catch (error) {
      console.error('Error loading polygons:', error);
      setIsLoadingPolygons(false);
    }
  }

  /**
   * Sync polygons from ArcGIS
   */
  async function syncPolygons(lat: number, lon: number) {
    setIsLoadingPolygons(true);

    try {
      const result = await syncPolygonsForLocation(lat, lon, 5.0);

      if (result.success) {
        // Reload polygons from cache
        const cachedPolygons = await getCachedPolygonsNearLocation(lat, lon, 5.0);
        setPolygons(cachedPolygons);

        // Update cache info
        const stats = await getCacheStats();
        const cacheText = `${stats.polygonCount} buildings cached • ${formatCacheAge(stats.lastUpdated)}`;
        setCacheInfo(cacheText);

        console.log(result.message);
      } else {
        console.error(result.message);
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsLoadingPolygons(false);
    }
  }

  /**
   * Handle map click
   */
  function handleMapClick(lat: number, lon: number) {
    // Check if click is on a polygon
    const tappedPolygon = findPolygonAtPoint({ lat, lon }, polygons);

    if (tappedPolygon) {
      // Polygon tapped - select it
      setSelectedPolygon(tappedPolygon);
      setSelectedLocation([tappedPolygon.centerLat, tappedPolygon.centerLon]);
      onLocationSelected(tappedPolygon.centerLat, tappedPolygon.centerLon);
      onBuildingSelected?.(tappedPolygon);
    } else {
      // Regular location selection
      setSelectedPolygon(null);
      setSelectedLocation([lat, lon]);
      onLocationSelected(lat, lon);
    }
  }

  /**
   * Recenter map to current location
   */
  function recenterMap() {
    if (currentLocation) {
      setSelectedLocation(currentLocation);
      onLocationSelected(currentLocation[0], currentLocation[1]);
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-[400px] border border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Getting your location...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-[400px] border border-red-300 rounded-lg flex items-center justify-center bg-red-50">
        <div className="text-center p-4">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={initializeLocation}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const center: [number, number] = selectedLocation || currentLocation || [6.5795, 3.3549];

  return (
    <div className="space-y-2">
      {/* GPS Accuracy Warning */}
      {accuracy && accuracy > 50 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 flex items-start gap-2">
          <span className="text-yellow-600 text-xl">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800">Low GPS Accuracy</p>
            <p className="text-xs text-yellow-700">
              Current accuracy: {accuracy.toFixed(1)}m. Please wait for better signal or move to an open area.
            </p>
          </div>
        </div>
      )}

      {/* Cache Info */}
      {cacheInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-center justify-between">
          <p className="text-xs text-blue-700">{cacheInfo}</p>
          {isLoadingPolygons && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          )}
        </div>
      )}

      {/* Map Container */}
      <div className="h-[400px] border border-gray-300 rounded-lg overflow-hidden relative">
        <MapContainer
          center={center}
          zoom={18}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          {/* ArcGIS Satellite Imagery */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Esri"
            maxZoom={19}
          />

          {/* ArcGIS Labels Overlay */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            attribution="Esri"
            maxZoom={19}
          />

          {/* Building Polygons */}
          {polygons.map((polygon) => {
            const isSelected = selectedPolygon?.buildingId === polygon.buildingId;
            const color = getPolygonColor(polygon.buildingId);

            // Convert GeoJSON coordinates to Leaflet format
            const positions: [number, number][] = polygon.geometry.coordinates[0].map(
              ([lon, lat]) => [lat, lon] as [number, number]
            );

            return (
              <Polygon
                key={polygon.buildingId}
                positions={positions}
                pathOptions={{
                  color: isSelected ? '#2196F3' : color,
                  fillColor: isSelected ? '#2196F3' : color,
                  fillOpacity: isSelected ? 0.4 : 0.3,
                  weight: isSelected ? 4 : 2.5,
                }}
                eventHandlers={{
                  click: () => {
                    setSelectedPolygon(polygon);
                    setSelectedLocation([polygon.centerLat, polygon.centerLon]);
                    onLocationSelected(polygon.centerLat, polygon.centerLon);
                    onBuildingSelected?.(polygon);
                  },
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold">{polygon.businessName || polygon.buildingId}</p>
                    {polygon.address && <p className="text-gray-600">{polygon.address}</p>}
                    {polygon.zone && <p className="text-gray-500 text-xs">Zone: {polygon.zone}</p>}
                  </div>
                </Popup>
              </Polygon>
            );
          })}

          {/* Selected Location Marker */}
          {selectedLocation && !selectedPolygon && (
            <Marker position={selectedLocation}>
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">Selected Location</p>
                  <p className="text-gray-600">
                    {selectedLocation[0].toFixed(6)}, {selectedLocation[1].toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Current Location Marker */}
          {currentLocation && (
            <Marker
              position={currentLocation}
              icon={L.divIcon({
                className: 'current-location-marker',
                html: '<div style="width: 20px; height: 20px; background: #2196F3; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              })}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">Your Location</p>
                  {accuracy && <p className="text-gray-600">Accuracy: {accuracy.toFixed(1)}m</p>}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Map Event Handler */}
          <MapEventHandler onMapClick={handleMapClick} onLocationUpdate={() => {}} />

          {/* Map Mover */}
          <MapMover center={center} zoom={18} />
        </MapContainer>

        {/* Recenter Button */}
        <button
          onClick={recenterMap}
          className="absolute bottom-4 right-4 bg-white shadow-lg rounded-full p-3 hover:bg-gray-100 z-[1000]"
          title="Recenter to current location"
        >
          <svg
            className="w-6 h-6 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>

      {/* Selected Building Info */}
      {selectedPolygon && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-3">
          <p className="text-sm font-bold text-green-800">
            {selectedPolygon.businessName || selectedPolygon.buildingId}
          </p>
          {selectedPolygon.address && (
            <p className="text-xs text-green-700">{selectedPolygon.address}</p>
          )}
          {selectedPolygon.zone && (
            <p className="text-xs text-green-600">Zone: {selectedPolygon.zone}</p>
          )}
        </div>
      )}
    </div>
  );
}
