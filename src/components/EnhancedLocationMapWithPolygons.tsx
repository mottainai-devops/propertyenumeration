import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { BuildingPolygon } from '../models/BuildingPolygon';
import { fetchPolygonsNearLocation } from '../services/arcgisService';
import { getCachedPolygonsNearLocation, savePolygonsToCache } from '../services/simplePolygonCache';
import { getMockPolygons } from '../services/mockPolygonData';

// Enable mock data for testing polygon rendering
const USE_MOCK_DATA = false;

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet-icons/marker-icon-2x.png',
  iconUrl: '/leaflet-icons/marker-icon.png',
  shadowUrl: '/leaflet-icons/marker-shadow.png',
});

// Color palette for polygons (15 distinct colors)
const POLYGON_COLORS = [
  '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3',
  '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
  '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#F44336',
];

function getPolygonColor(buildingId: string): string {
  const hash = buildingId.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  return POLYGON_COLORS[Math.abs(hash) % POLYGON_COLORS.length];
}

function isValidBusinessName(name?: string): boolean {
  return !!name && name !== 'None' && name !== 'none' && name.trim() !== '';
}

interface EnhancedLocationMapWithPolygonsProps {
  latitude: number;
  longitude: number;
  onLocationChange: (lat: number, lng: number) => void;
  onBuildingSelected?: (polygon: BuildingPolygon) => void;
  /** Set of building IDs that have already been surveyed this session */
  surveyedBuildingIds?: Set<string>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MapCenterUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom()); }, [center, map]);
  return null;
}

function MapRefCapture({ onMapReady }: { onMapReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onMapReady(map); }, [map, onMapReady]);
  return null;
}

/** Pan + zoom to a target position (used by search) */
function MapFlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, Math.max(map.getZoom(), 19), { duration: 0.8 });
    }
  }, [target, map]);
  return null;
}

/** Zoom-dependent label - shows business name or building ID */
function ZoomDependentLabel({
  polygon,
  minZoom = 18,
  isSurveyed = false,
}: {
  polygon: BuildingPolygon;
  minZoom?: number;
  isSurveyed?: boolean;
}) {
  const map = useMap();
  const [showLabel, setShowLabel] = useState(false);

  useEffect(() => {
    const update = () => setShowLabel(map.getZoom() >= minZoom);
    update();
    map.on('zoomend', update);
    return () => { map.off('zoomend', update); };
  }, [map, minZoom]);

  if (!showLabel) return null;

  const labelText = isValidBusinessName(polygon.businessName)
    ? polygon.businessName!
    : polygon.buildingId;
  const maxChars = 18;
  const displayText = labelText.length > maxChars
    ? labelText.slice(0, maxChars - 1) + '…'
    : labelText;

  const prefix = isSurveyed ? '✓ ' : '';
  const color = isSurveyed ? '#166534' : '#1a1a1a';

  const labelIcon = L.divIcon({
    className: 'building-label',
    html: `<div style="font-size: 8px; color: ${color}; text-shadow: 0 0 3px white, 0 0 3px white; font-weight: 700; white-space: nowrap; pointer-events: none; line-height: 1.2; text-align: center;">${prefix}${displayText}</div>`,
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

// ─── Main component ───────────────────────────────────────────────────────────

export function EnhancedLocationMapWithPolygons({
  latitude,
  longitude,
  onLocationChange,
  onBuildingSelected,
  surveyedBuildingIds = new Set(),
}: EnhancedLocationMapWithPolygonsProps) {
  const [position, setPosition] = useState<[number, number]>([latitude, longitude]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [polygons, setPolygons] = useState<BuildingPolygon[]>([]);
  const [selectedPolygon, setSelectedPolygon] = useState<BuildingPolygon | null>(null);
  const [isLoadingPolygons, setIsLoadingPolygons] = useState(false);
  const [polygonError, setPolygonError] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BuildingPolygon[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const mapRef = useRef<L.Map | null>(null);
  const hasLoadedRef = useRef(false);
  const autoSelectedRef = useRef(false);

  useEffect(() => { setPosition([latitude, longitude]); }, [latitude, longitude]);

  // Auto-load polygons on mount
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    const timer = setTimeout(() => {
      loadPolygons(latitude, longitude);
    }, 800);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Search logic - filter polygons by query
  useEffect(() => {
    if (!searchQuery.trim() || polygons.length === 0) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches = polygons.filter(p => {
      const idMatch = p.buildingId.toLowerCase().includes(q);
      const nameMatch = isValidBusinessName(p.businessName) && p.businessName!.toLowerCase().includes(q);
      const addrMatch = p.address && p.address.toLowerCase().includes(q);
      return idMatch || nameMatch || addrMatch;
    }).slice(0, 6);
    setSearchResults(matches);
    setShowSearchResults(matches.length > 0);
  }, [searchQuery, polygons]);

  async function loadPolygons(lat: number, lon: number) {
    setIsLoadingPolygons(true);
    setPolygonError(null);

    try {
      if (USE_MOCK_DATA) {
        const mockPolygons = getMockPolygons();
        setPolygons(mockPolygons);
        setIsLoadingPolygons(false);
        return;
      }

      const cachedPolygons = getCachedPolygonsNearLocation(lat, lon, 5.0);
      if (cachedPolygons.length > 0) {
        setPolygons(cachedPolygons);
        tryAutoSelect(lat, lon, cachedPolygons);
      }

      const freshPolygons = await fetchPolygonsNearLocation(lat, lon, 5.0);
      if (freshPolygons.length > 0) {
        setPolygons(freshPolygons);
        savePolygonsToCache(freshPolygons, lat, lon);
        tryAutoSelect(lat, lon, freshPolygons);
      } else if (cachedPolygons.length === 0) {
        setPolygonError('No building data — tap Download to save area data for offline use');
      }
    } catch (error) {
      console.error('Error loading polygons:', error);
      // Check if we have cached data to fall back to
      const cachedPolygons = getCachedPolygonsNearLocation(lat, lon, 5.0);
      if (cachedPolygons.length > 0) {
        setPolygons(cachedPolygons);
        tryAutoSelect(lat, lon, cachedPolygons);
        setPolygonError('Offline — showing cached data');
      } else {
        setPolygonError('No internet & no cached data — tap Download when online');
      }
    } finally {
      setIsLoadingPolygons(false);
    }
  }

  async function handleDownloadAreaData() {
    setIsDownloading(true);
    setDownloadProgress('Connecting to ArcGIS…');
    try {
      setDownloadProgress('Downloading building data…');
      const freshPolygons = await fetchPolygonsNearLocation(position[0], position[1], 5.0);
      if (freshPolygons.length > 0) {
        setPolygons(freshPolygons);
        savePolygonsToCache(freshPolygons, position[0], position[1]);
        tryAutoSelect(position[0], position[1], freshPolygons);
        setPolygonError(null);
        setDownloadProgress(`✓ ${freshPolygons.length} buildings saved for offline use`);
        setTimeout(() => setDownloadProgress(null), 3000);
      } else {
        setDownloadProgress('No buildings found in this area');
        setTimeout(() => setDownloadProgress(null), 3000);
      }
    } catch (error) {
      console.error('Download error:', error);
      setDownloadProgress('Download failed — check internet connection');
      setTimeout(() => setDownloadProgress(null), 4000);
    } finally {
      setIsDownloading(false);
    }
  }

  /** Check if GPS point is inside any polygon; if so, auto-select it once */
  function tryAutoSelect(lat: number, lon: number, polys: BuildingPolygon[]) {
    if (autoSelectedRef.current) return;
    const match = findPolygonAtPoint({ lat, lon }, polys);
    if (match) {
      autoSelectedRef.current = true;
      console.log('[AutoSelect] GPS inside polygon:', match.buildingId);
      setSelectedPolygon(match);
      setPosition([match.centerLat, match.centerLon]);
      onLocationChange(match.centerLat, match.centerLon);
      if (onBuildingSelected) onBuildingSelected(match);
    }
  }

  function findPolygonAtPoint(
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
      } catch { continue; }
    }
    return null;
  }

  const handleMarkerDragEnd = (event: L.DragEndEvent) => {
    const marker = event.target;
    const newPos = marker.getLatLng();
    setPosition([newPos.lat, newPos.lng]);
    onLocationChange(newPos.lat, newPos.lng);
  };

  const handlePolygonClick = useCallback((polygon: BuildingPolygon, e: L.LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(e as unknown as Event);
    console.log('[Polygon] Tapped:', polygon.buildingId);
    setSelectedPolygon(polygon);
    setPosition([polygon.centerLat, polygon.centerLon]);
    onLocationChange(polygon.centerLat, polygon.centerLon);
    if (onBuildingSelected) onBuildingSelected(polygon);
  }, [onLocationChange, onBuildingSelected]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLon = pos.coords.longitude;
        setPosition([newLat, newLon]);
        onLocationChange(newLat, newLon);
        if (mapRef.current) {
          mapRef.current.setView([newLat, newLon], mapRef.current.getZoom());
        }
        // Try auto-select at new GPS position
        if (polygons.length > 0) {
          const match = findPolygonAtPoint({ lat: newLat, lon: newLon }, polygons);
          if (match) {
            setSelectedPolygon(match);
            if (onBuildingSelected) onBuildingSelected(match);
          }
        }
      },
      (error) => {
        console.error('[Location] Error:', error);
        alert('Unable to get GPS location. Please enable location services.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleRefresh = () => {
    autoSelectedRef.current = false;
    loadPolygons(position[0], position[1]);
  };

  /** Handle search result selection */
  const handleSearchSelect = (polygon: BuildingPolygon) => {
    setSearchQuery('');
    setShowSearchResults(false);
    setSelectedPolygon(polygon);
    setPosition([polygon.centerLat, polygon.centerLon]);
    setFlyTarget([polygon.centerLat, polygon.centerLon]);
    onLocationChange(polygon.centerLat, polygon.centerLon);
    if (onBuildingSelected) onBuildingSelected(polygon);
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
      <div className="w-full flex flex-col gap-2">
        {/* Search bar */}
        <div className="relative">
          <div className="flex items-center bg-white border border-gray-300 rounded-xl shadow-sm px-3 py-2 gap-2">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search building ID or name…"
              className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setShowSearchResults(false); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          {showSearchResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-[2000] overflow-hidden">
              {searchResults.map((p) => (
                <button
                  key={p.buildingId}
                  onClick={() => handleSearchSelect(p)}
                  className="w-full text-left px-4 py-3 hover:bg-green-50 border-b border-gray-100 last:border-0 transition"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg shrink-0">🏢</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {isValidBusinessName(p.businessName) ? p.businessName : p.buildingId}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {p.buildingId}{p.address ? ` · ${p.address}` : ''}
                      </p>
                    </div>
                    {surveyedBuildingIds.has(p.buildingId) && (
                      <span className="ml-auto shrink-0 text-green-600 font-bold text-xs">✓ Done</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
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
            <MapFlyTo target={flyTarget} />

            <Marker
              position={position}
              draggable={true}
              eventHandlers={{ dragend: handleMarkerDragEnd }}
            />

            {polygons.map((polygon) => {
              const isSurveyed = surveyedBuildingIds.has(polygon.buildingId);
              const isSelected = selectedPolygon?.buildingId === polygon.buildingId;
              const baseColor = getPolygonColor(polygon.buildingId);

              if (!polygon.geometry?.coordinates?.[0]) return null;

              const coordinates = polygon.geometry.coordinates[0].map(
                ([lng, lat]) => [lat, lng] as [number, number]
              );

              return (
                <React.Fragment key={polygon.buildingId}>
                  <Polygon
                    positions={coordinates}
                    pathOptions={{
                      color: isSelected ? '#1a56db' : isSurveyed ? '#6b7280' : baseColor,
                      fillColor: isSelected ? '#1a56db' : isSurveyed ? '#9ca3af' : baseColor,
                      fillOpacity: isSelected ? 0.55 : isSurveyed ? 0.25 : 0.35,
                      weight: isSelected ? 4 : isSurveyed ? 1 : 2,
                      dashArray: isSurveyed ? '4 4' : undefined,
                    }}
                    eventHandlers={{
                      click: (e) => handlePolygonClick(polygon, e),
                    }}
                  />
                  <ZoomDependentLabel polygon={polygon} minZoom={18} isSurveyed={isSurveyed} />
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
              Loading buildings…
            </div>
          )}

          {/* Polygon error / offline notice */}
          {polygonError && !isLoadingPolygons && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-yellow-50 border border-yellow-300 px-3 py-2 rounded-xl shadow-md text-xs text-yellow-800 z-[1001] flex items-center gap-2 max-w-[85%]">
              <span className="shrink-0">⚠️</span>
              <span>{polygonError}</span>
              {polygons.length === 0 && (
                <button
                  onClick={handleDownloadAreaData}
                  disabled={isDownloading}
                  className="ml-1 px-2 py-0.5 bg-blue-600 text-white rounded-lg text-xs font-bold shrink-0 disabled:opacity-50"
                >
                  {isDownloading ? '…' : 'Download'}
                </button>
              )}
            </div>
          )}

          {/* Download progress toast */}
          {downloadProgress && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-md text-xs font-semibold z-[1002] flex items-center gap-2">
              {isDownloading && (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {downloadProgress}
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isLoadingPolygons}
            className="absolute bottom-14 left-3 bg-white rounded-xl shadow-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 z-[1001] flex items-center justify-center"
            style={{ width: '52px', height: '52px' }}
            title="Refresh building data"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Location button */}
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

          {/* Building count */}
          {polygons.length > 0 && !isLoadingPolygons && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-md text-xs text-gray-600 z-[1001]">
              {polygons.length} buildings loaded
              {surveyedBuildingIds.size > 0 && (
                <span className="ml-1 text-green-600 font-semibold">· {surveyedBuildingIds.size} surveyed</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  } catch (error) {
    setMapError(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
