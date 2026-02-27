import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { BuildingPolygon } from '../models/BuildingPolygon';
import { fetchPolygonsNearLocation, fetchPolygonsInBounds } from '../services/arcgisService';
import { getCachedPolygonsNearLocation, savePolygonsToCache } from '../services/simplePolygonCache';
import { findPolygonAtPoint } from '../utils/pointInPolygon';

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
 * Map event handler component for click events
 */
function MapClickHandler({
  onMapClick,
  polygons,
}: {
  onMapClick: (lat: number, lng: number, polygon?: BuildingPolygon) => void;
  polygons: BuildingPolygon[];
})
{
  const handleClick = (e: L.LeafletMouseEvent) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    // Check if click is on a polygon
    const tappedPolygon = findPolygonAtPoint({ lat, lon: lng }, polygons) || undefined;
    onMapClick(lat, lng, tappedPolygon);
  };
  
  useMapEvents({
    click: handleClick,
  });
  return null;
}



/**
 * Map updater component with viewport loading and auto-fit
 */
function MapUpdater({ 
  center, 
  polygons,
  onViewportChange 
}: { 
  center: [number, number];
  polygons: BuildingPolygon[];
  onViewportChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
}) {
  const map = useMap();
  const [hasAutoFitted, setHasAutoFitted] = useState(false);
  
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);

  // Auto-fit map to show all polygons when they first load
  useEffect(() => {
    if (polygons.length > 0 && !hasAutoFitted) {
      console.log(`[MapUpdater] Auto-fitting map to ${polygons.length} polygons`);
      try {
        const bounds = L.latLngBounds(
          polygons.map(p => [p.centerLat, p.centerLon] as [number, number])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        setHasAutoFitted(true);
      } catch (error) {
        console.error('[MapUpdater] Error fitting bounds:', error);
      }
    }
  }, [polygons, hasAutoFitted, map]);

  // Listen for moveend event to detect viewport changes
  useMapEvents({
    moveend: () => {
      if (onViewportChange) {
        const bounds = map.getBounds();
        onViewportChange({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        });
      }
    },
  });
  
  return null;
}

/**
 * Zoom-dependent label component
 */
function ZoomDependentLabel({ polygon, minZoom = 17 }: { polygon: BuildingPolygon; minZoom?: number }) {
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

  // Create custom text marker with reduced size
  const labelIcon = L.divIcon({
    className: 'building-label',
    html: `<div style="font-size: 9px; color: #333; text-shadow: 1px 1px 2px white; font-weight: bold; white-space: nowrap;">${polygon.buildingId}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

  return (
    <Marker
      position={[polygon.centerLat, polygon.centerLon]}
      icon={labelIcon}
      eventHandlers={{
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          // Label tap = view info (non-confirming action)
          console.log('Label tapped:', polygon.buildingId);
        },
      }}
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

  useEffect(() => {
    setPosition([latitude, longitude]);
  }, [latitude, longitude]);

  // Load polygons on mount with proper timing
  useEffect(() => {
    // Delay loading slightly to ensure map is rendered
    const timer = setTimeout(() => {
      console.log('[EnhancedLocationMap] Loading polygons for position:', position);
      loadPolygons(position[0], position[1]);
    }, 500);
    return () => clearTimeout(timer);
  }, []); // Only load once on mount

  /**
   * Load polygons from cache or ArcGIS using viewport bounds
   */
  async function loadPolygonsInViewport(bounds: { north: number; south: number; east: number; west: number }) {
    setIsLoadingPolygons(true);
    setPolygonError(null);

    try {
      // Fetch polygons in viewport from ArcGIS
      const freshPolygons = await fetchPolygonsInBounds(bounds);
      
      if (freshPolygons.length > 0) {
        setPolygons(freshPolygons);
        // Update cache
        const centerLat = (bounds.north + bounds.south) / 2;
        const centerLon = (bounds.east + bounds.west) / 2;
        savePolygonsToCache(freshPolygons, centerLat, centerLon);
        console.log(`Fetched and cached ${freshPolygons.length} polygons from viewport`);
      } else {
        setPolygonError('No building data available in this area');
      }
    } catch (error) {
      console.error('Error loading polygons in viewport:', error);
      setPolygonError('Failed to load building data');
    } finally {
      setIsLoadingPolygons(false);
    }
  }

  /**
   * Load polygons from cache or ArcGIS (fallback to radius-based)
   */
  async function loadPolygons(lat: number, lon: number) {
    setIsLoadingPolygons(true);
    setPolygonError(null);

    try {
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

  const handleMarkerDragEnd = (event: L.DragEndEvent) => {
    const marker = event.target;
    const newPos = marker.getLatLng();
    setPosition([newPos.lat, newPos.lng]);
    onLocationChange(newPos.lat, newPos.lng);
  };

  const handleMapClick = (lat: number, lng: number, polygon?: BuildingPolygon) => {
    if (polygon) {
      // Polygon tapped - select it (confirming action)
      console.log('[Map] Polygon tapped:', polygon.buildingId);
      setSelectedPolygon(polygon);
      setPosition([polygon.centerLat, polygon.centerLon]);
      onLocationChange(polygon.centerLat, polygon.centerLon);
      if (onBuildingSelected) {
        console.log('[Map] Calling onBuildingSelected with:', polygon);
        onBuildingSelected(polygon);
      }
    } else {
      // Regular location selection
      setSelectedPolygon(null);
      setPosition([lat, lng]);
      onLocationChange(lat, lng);
    }
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
      <div className="w-full h-64 rounded-lg overflow-hidden border border-gray-200 relative">
        <MapContainer
          center={position}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapUpdater center={position} polygons={polygons} />
          <MapClickHandler onMapClick={handleMapClick} polygons={polygons} />
          
          <Marker
            position={position}
            draggable={true}
            eventHandlers={{
              dragend: handleMarkerDragEnd,
            }}
          >
            <Popup>
              Current Location<br />
              Lat: {position[0].toFixed(6)}<br />
              Lng: {position[1].toFixed(6)}
              {selectedPolygon && (
                <>
                  <br /><br />
                  <strong>Building: {selectedPolygon.buildingId}</strong>
                  {selectedPolygon.businessName && <><br />Business: {selectedPolygon.businessName}</>}
                  {selectedPolygon.address && <><br />Address: {selectedPolygon.address}</>}
                </>
              )}
            </Popup>
          </Marker>

          {/* Render building polygons */}
          {polygons.length > 0 && (() => { console.log(`[Render] Rendering ${polygons.length} polygons`); return null; })()}
          {polygons.map((polygon, index) => {
            const color = getPolygonColor(polygon.buildingId);
            const isSelected = selectedPolygon?.buildingId === polygon.buildingId;
            
            // Convert GeoJSON coordinates to Leaflet format
            if (!polygon.geometry || !polygon.geometry.coordinates || !polygon.geometry.coordinates[0]) {
              console.error(`[Render] Invalid geometry for polygon ${polygon.buildingId}:`, polygon.geometry);
              return null;
            }
            
            const coordinates = polygon.geometry.coordinates[0].map(
              ([lng, lat]) => [lat, lng] as [number, number]
            );
            
            if (index === 0) {
              console.log(`[Render] First polygon sample:`, {
                buildingId: polygon.buildingId,
                originalCoords: polygon.geometry.coordinates[0].slice(0, 2),
                convertedCoords: coordinates.slice(0, 2)
              });
            }

            return (
              <React.Fragment key={polygon.buildingId}>
                <Polygon
                  positions={coordinates}
                  pathOptions={{
                    color: isSelected ? '#000' : color,
                    fillColor: color,
                    fillOpacity: isSelected ? 0.4 : 0.2,
                    weight: isSelected ? 3 : 2,
                  }}
                />
                <ZoomDependentLabel polygon={polygon} minZoom={17} />
              </React.Fragment>
            );
          })}
        </MapContainer>

        {/* Loading indicator */}
        {isLoadingPolygons && (
          <div className="absolute top-2 right-2 bg-white px-3 py-1 rounded-lg shadow-md text-sm text-gray-600 z-10">
            Loading buildings...
          </div>
        )}

        {/* Polygon error indicator */}
        {polygonError && !isLoadingPolygons && (
          <div className="absolute top-2 right-2 bg-yellow-50 px-3 py-1 rounded-lg shadow-md text-sm text-yellow-700 z-10">
            {polygonError}
          </div>
        )}

        {/* Refresh button */}
        <button
          onClick={() => {
            // Get current map bounds and reload polygons
            const mapElement = document.querySelector('.leaflet-container') as any;
            if (mapElement && mapElement._leaflet_map) {
              const map = mapElement._leaflet_map;
              const bounds = map.getBounds();
              loadPolygonsInViewport({
                north: bounds.getNorth(),
                south: bounds.getSouth(),
                east: bounds.getEast(),
                west: bounds.getWest(),
              });
            }
          }}
          disabled={isLoadingPolygons}
          className="absolute top-2 left-2 bg-white px-3 py-2 rounded-lg shadow-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed z-10 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>

        {/* Polygon count indicator */}
        {polygons.length > 0 && !isLoadingPolygons && (
          <div className="absolute bottom-2 right-2 bg-white px-3 py-1 rounded-lg shadow-md text-xs text-gray-600 z-10">
            {polygons.length} buildings
          </div>
        )}
      </div>
    );
  } catch (error) {
    setMapError(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
