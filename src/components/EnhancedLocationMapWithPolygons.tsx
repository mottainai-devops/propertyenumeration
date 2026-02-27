import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { BuildingPolygon } from '../models/BuildingPolygon';
import { fetchPolygonsNearLocation } from '../services/arcgisService';
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
 * Map updater component
 */
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  
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

  // Load polygons when map position changes
  useEffect(() => {
    loadPolygons(position[0], position[1]);
  }, [position]);

  /**
   * Load polygons from cache or ArcGIS
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
        setPolygons(freshPolygons);
        // Update cache
        savePolygonsToCache(freshPolygons, lat, lon);
        console.log(`Fetched and cached ${freshPolygons.length} polygons from ArcGIS`);
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
      setSelectedPolygon(polygon);
      setPosition([polygon.centerLat, polygon.centerLon]);
      onLocationChange(polygon.centerLat, polygon.centerLon);
      onBuildingSelected?.(polygon);
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
          
          <MapUpdater center={position} />
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
          {polygons.map((polygon) => {
            const color = getPolygonColor(polygon.buildingId);
            const isSelected = selectedPolygon?.buildingId === polygon.buildingId;
            
            // Convert GeoJSON coordinates to Leaflet format
            const coordinates = polygon.geometry.coordinates[0].map(
              ([lng, lat]) => [lat, lng] as [number, number]
            );

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
