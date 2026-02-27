import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { BuildingPolygon } from '../models/BuildingPolygon';
import { fetchPolygonsNearLocation } from '../services/arcgisService';
import { getCachedPolygonsNearLocation, savePolygonsToCache } from '../services/simplePolygonCache';
import { getMockPolygons } from '../services/mockPolygonData';

// Enable mock data for testing polygon rendering
const USE_MOCK_DATA = false; // Disabled to test ArcGIS integration

// Fix Leaflet default marker icon issue - use local bundled icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet-icons/marker-icon-2x.png',
  iconUrl: '/leaflet-icons/marker-icon.png',
  shadowUrl: '/leaflet-icons/marker-shadow.png',
});

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

interface EnhancedLocationMapWithPolygonsProps {
  latitude: number;
  longitude: number;
  onLocationChange: (lat: number, lng: number) => void;
  onBuildingSelected?: (polygon: BuildingPolygon) => void;
}

/**
 * Map center updater - only updates center, does NOT auto-fit bounds
 */
function MapCenterUpdater({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);

  return null;
}

/**
 * Map ref capture component - exposes map instance to parent
 */
function MapRefCapture({ onMapReady }: { onMapReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);
  return null;
}

/**
 * Zoom-dependent label component - shows business name (if available) or building ID
 */
function ZoomDependentLabel({ polygon, minZoom = 18 }: { polygon: BuildingPolygon; minZoom?: number }) {
  const map = useMap();
  const [showLabel, setShowLabel] = useState(false);

  useEffect(() => {
    const updateLabelVisibility = () => {
      setShowLabel(map.getZoom() >= minZoom);
    };

    updateLabelVisibility();
    map.on('zoomend', updateLabelVisibility);

    return () => {
      map.off('zoomend', updateLabelVisibility);
    };
  }, [map, minZoom]);

  if (!showLabel) return null;

  // Prefer business name over building ID; filter out 'None' values
  const rawName = polygon.businessName;
  const hasValidBusiness = rawName && rawName !== 'None' && rawName !== 'none' && rawName.trim() !== '';
  const labelText = hasValidBusiness ? rawName! : polygon.buildingId;

  // Truncate long names to keep labels compact
  const maxChars = 18;
  const displayText = labelText.length > maxChars ? labelText.slice(0, maxChars - 1) + '…' : labelText;

  // Create custom text marker - small, non-interactive, white shadow for legibility
  const labelIcon = L.divIcon({
    className: 'building-label',
    html: `<div style="font-size: 8px; color: #1a1a1a; text-shadow: 0 0 3px white, 0 0 3px white; font-weight: 700; white-space: nowrap; pointer-events: none; line-height: 1.2; text-align: center;">${displayText}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

  return (
    <Marker
      position={[polygon.centerLat, polygon.centerLon]}
      icon={labelIcon}
      interactive={false}
    />
  );
}

export function EnhancedLocationMapWithPolygons({
  latitude,
  longitude,
  onLocationChange,
  onBuildingSelected,
}: EnhancedLocationMapWithPolygonsProps) {
  const [position, setPosition] = useState<[number, number]>([latitude, longitude]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [polygons, setPolygons] = useState<BuildingPolygon[]>([]);
  const [selectedPolygon, setSelectedPolygon] = useState<BuildingPolygon | null>(null);
  const [isLoadingPolygons, setIsLoadingPolygons] = useState(false);
  const [polygonError, setPolygonError] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    setPosition([latitude, longitude]);
  }, [latitude, longitude]);

  // Auto-load polygons on mount - triggered once when component mounts
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    // Delay loading slightly to ensure map is rendered
    const timer = setTimeout(() => {
      console.log('[EnhancedLocationMap] Auto-loading polygons for position:', latitude, longitude);
      loadPolygons(latitude, longitude);
    }, 800);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Load polygons from cache or ArcGIS
   */
  async function loadPolygons(lat: number, lon: number) {
    setIsLoadingPolygons(true);
    setPolygonError(null);

    try {
      // Use mock data for testing if enabled
      if (USE_MOCK_DATA) {
        console.log('[MockData] Using mock polygons for testing');
        const mockPolygons = getMockPolygons();
        setPolygons(mockPolygons);
        setIsLoadingPolygons(false);
        return;
      }

      // Try cache first
      const cachedPolygons = getCachedPolygonsNearLocation(lat, lon, 5.0);

      if (cachedPolygons.length > 0) {
        setPolygons(cachedPolygons);
        console.log(`Loaded ${cachedPolygons.length} cached polygons`);
      }

      // Fetch fresh data from ArcGIS in background
      const freshPolygons = await fetchPolygonsNearLocation(lat, lon, 5.0);

      if (freshPolygons.length > 0) {
        console.log(`[ArcGIS] Fetched ${freshPolygons.length} polygons, setting state...`);
        setPolygons(freshPolygons);
        // Update cache
        savePolygonsToCache(freshPolygons, lat, lon);
        console.log(`[ArcGIS] Polygons set in state, cache updated`);

        // Check which polygon contains the current GPS location
        const containingPolygon = findPolygonAtPointLocal({ lat, lon }, freshPolygons);
        if (containingPolygon) {
          console.log(`[GPS] Current location (${lat}, ${lon}) is inside polygon:`, containingPolygon.buildingId);
          console.log('[GPS] Polygon details:', {
            buildingId: containingPolygon.buildingId,
            address: containingPolygon.address,
            businessName: containingPolygon.businessName,
            center: [containingPolygon.centerLat, containingPolygon.centerLon],
          });
        } else {
          console.log(`[GPS] Current location (${lat}, ${lon}) is NOT inside any polygon`);
          console.log('[GPS] Nearest polygons by center distance:');
          const nearest = freshPolygons
            .map(p => ({
              id: p.buildingId,
              distance: Math.sqrt(
                Math.pow(p.centerLat - lat, 2) + Math.pow(p.centerLon - lon, 2)
              ),
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5);
          nearest.forEach(n => console.log(`  - ${n.id}: ${(n.distance * 111000).toFixed(1)}m away`));
        }
      } else if (cachedPolygons.length === 0) {
        // No polygons found in cache or from ArcGIS
        setPolygonError('No building data available for this area');
      }
    } catch (error) {
      console.error('Error loading polygons:', error);
      setPolygonError('Failed to load building data');
      // Keep any cached polygons that were loaded
    } finally {
      setIsLoadingPolygons(false);
    }
  }

  /**
   * Local point-in-polygon check (ray casting)
   */
  function findPolygonAtPointLocal(
    point: { lat: number; lon: number },
    polys: BuildingPolygon[]
  ): BuildingPolygon | null {
    for (const poly of polys) {
      try {
        const ring = poly.geometry.coordinates[0];
        if (!ring) continue;
        let inside = false;
        let j = ring.length - 1;
        for (let i = 0; i < ring.length; i++) {
          const [xi, yi] = ring[i];
          const [xj, yj] = ring[j];
          const intersect =
            yi > point.lat !== yj > point.lat &&
            point.lon < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
          if (intersect) inside = !inside;
          j = i;
        }
        if (inside) return poly;
      } catch {
        continue;
      }
    }
    return null;
  }

  const handleMarkerDragEnd = (event: L.DragEndEvent) => {
    const marker = event.target;
    const newPos = marker.getLatLng();
    setPosition([newPos.lat, newPos.lng]);
    onLocationChange(newPos.lat, newPos.lng);
  };

  /**
   * Direct polygon click handler - called when a polygon is tapped
   * This is the primary click handler; no MapClickHandler needed
   */
  const handlePolygonClick = (polygon: BuildingPolygon, e: L.LeafletMouseEvent) => {
    // Stop propagation so the map click doesn't fire
    L.DomEvent.stopPropagation(e as unknown as Event);

    console.log('[Polygon] Tapped polygon:', polygon.buildingId);
    console.log('[Polygon] Building details:', {
      buildingId: polygon.buildingId,
      address: polygon.address,
      businessName: polygon.businessName,
      zone: polygon.zone,
    });

    setSelectedPolygon(polygon);
    setPosition([polygon.centerLat, polygon.centerLon]);
    onLocationChange(polygon.centerLat, polygon.centerLon);

    if (onBuildingSelected) {
      console.log('[Polygon] Calling onBuildingSelected callback');
      onBuildingSelected(polygon);
    } else {
      console.warn('[Polygon] onBuildingSelected callback is NOT set!');
    }
  };

  /**
   * Handle location button click - center map on GPS
   */
  const handleLocateMe = () => {
    console.log('[Location] Getting current GPS position...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newLat = pos.coords.latitude;
          const newLon = pos.coords.longitude;
          console.log(`[Location] GPS position: ${newLat}, ${newLon}`);
          setPosition([newLat, newLon]);
          onLocationChange(newLat, newLon);
          // Pan map to new location
          if (mapRef.current) {
            mapRef.current.setView([newLat, newLon], mapRef.current.getZoom());
          }
        },
        (error) => {
          console.error('[Location] Error getting GPS:', error);
          alert('Unable to get GPS location. Please enable location services.');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } else {
      alert('Geolocation is not supported by this device.');
    }
  };

  /**
   * Handle refresh button click - reload polygons
   */
  const handleRefresh = () => {
    console.log('[Refresh] Reloading polygons for position:', position);
    loadPolygons(position[0], position[1]);
  };

  if (mapError) {
    return (
      <div className="w-full h-64 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 font-semibold">Map failed to load</p>
          <p className="text-sm text-red-500 mt-2">{mapError}</p>
        </div>
      </div>
    );
  }

  try {
    return (
      <div className="w-full h-96 rounded-lg overflow-hidden border border-gray-200 relative">
        <MapContainer
          center={position}
          zoom={18}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapCenterUpdater center={position} />
          <MapRefCapture onMapReady={(map) => { mapRef.current = map; }} />

          <Marker
            position={position}
            draggable={true}
            eventHandlers={{
              dragend: handleMarkerDragEnd,
            }}
          />

          {/* Render building polygons */}
          {polygons.map((polygon) => {
            const color = getPolygonColor(polygon.buildingId);
            const isSelected = selectedPolygon?.buildingId === polygon.buildingId;

            // Convert GeoJSON coordinates to Leaflet format
            if (!polygon.geometry || !polygon.geometry.coordinates || !polygon.geometry.coordinates[0]) {
              return null;
            }

            const coordinates = polygon.geometry.coordinates[0].map(
              ([lng, lat]) => [lat, lng] as [number, number]
            );

            return (
              <React.Fragment key={polygon.buildingId}>
                <Polygon
                  positions={coordinates}
                  pathOptions={{
                    color: isSelected ? '#1a56db' : color,
                    fillColor: isSelected ? '#1a56db' : color,
                    fillOpacity: isSelected ? 0.5 : 0.35,
                    weight: isSelected ? 4 : 2,
                  }}
                  eventHandlers={{
                    click: (e) => handlePolygonClick(polygon, e),
                  }}
                />
                <ZoomDependentLabel polygon={polygon} minZoom={18} />
              </React.Fragment>
            );
          })}
        </MapContainer>

        {/* Loading indicator */}
        {isLoadingPolygons && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-md text-sm text-gray-700 z-[1001] flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading buildings...
          </div>
        )}

        {/* Polygon error indicator */}
        {polygonError && !isLoadingPolygons && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-yellow-50 px-4 py-2 rounded-full shadow-md text-sm text-yellow-700 z-[1001]">
            {polygonError}
          </div>
        )}

        {/* Refresh button - large touch target, bottom-left */}
        <button
          onClick={handleRefresh}
          disabled={isLoadingPolygons}
          className="absolute bottom-14 left-3 bg-white rounded-xl shadow-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed z-[1001] flex items-center justify-center"
          style={{ width: '52px', height: '52px' }}
          title="Refresh building data"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* Location widget - large touch target, bottom-right */}
        <button
          onClick={handleLocateMe}
          className="absolute bottom-14 right-3 bg-white rounded-xl shadow-lg text-gray-700 hover:bg-gray-50 z-[1001] flex items-center justify-center"
          style={{ width: '52px', height: '52px' }}
          title="Center on my location"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Polygon count indicator */}
        {polygons.length > 0 && !isLoadingPolygons && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-md text-xs text-gray-600 z-[1001]">
            {polygons.length} buildings loaded
          </div>
        )}
      </div>
    );
  } catch (error) {
    setMapError(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
