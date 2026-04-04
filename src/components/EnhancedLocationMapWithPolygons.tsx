import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { BuildingPolygon } from '../models/BuildingPolygon';
import { fetchPolygonsNearLocation, fetchPolygonsInBounds, fetchCustomerPointsInBounds, fetchPolygonsForLotProgressive } from '../services/arcgisService';
import type { CustomerPoint } from '../services/arcgisService';
import { getCachedPolygonsNearLocation, savePolygonsToCache, getCacheTimestamp } from '../services/simplePolygonCache';
import { getMockPolygons } from '../services/mockPolygonData';
import { buildingApi } from '../api/client';

// Enable mock data for testing polygon rendering
const USE_MOCK_DATA = false;

// Minimum zoom level to show building labels (reduces clutter when zoomed out)
const LABEL_ZOOM_THRESHOLD = 16;

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet-icons/marker-icon-2x.png',
  iconUrl: '/leaflet-icons/marker-icon.png',
  shadowUrl: '/leaflet-icons/marker-shadow.png',
});

function isValidBusinessName(name?: string): boolean {
  return !!name && name !== 'None' && name !== 'none' && name !== 'null' && name.trim() !== '' && name.toLowerCase() !== 'esteemed customer';
}

/** Resolve the best display name for a polygon: business_name → first+last → buildingId */
function resolveDisplayName(polygon: BuildingPolygon): string {
  if (isValidBusinessName(polygon.businessName)) return polygon.businessName!;
  const fullName = [polygon.firstName, polygon.lastName]
    .filter(n => n && n.trim() !== '' && n !== 'None' && n !== 'null')
    .join(' ')
    .trim();
  if (fullName && fullName.toLowerCase() !== 'esteemed customer') return fullName;
  return polygon.buildingId;
}

// ─── Overlap ratio helper ─────────────────────────────────────────────────────
function boundsOverlapRatio(
  a: { north: number; south: number; east: number; west: number },
  b: { north: number; south: number; east: number; west: number }
): number {
  const latOverlap = Math.max(0, Math.min(a.north, b.north) - Math.max(a.south, b.south));
  const lonOverlap = Math.max(0, Math.min(a.east, b.east) - Math.max(a.west, b.west));
  const areaA = (a.north - a.south) * (a.east - a.west);
  if (areaA <= 0) return 0;
  return (latOverlap * lonOverlap) / areaA;
}

interface EnhancedLocationMapWithPolygonsProps {
  latitude: number;
  longitude: number;
  onLocationChange: (lat: number, lng: number) => void;
  onBuildingSelected?: (polygon: BuildingPolygon) => void;
  /** Set of building IDs that have already been surveyed this session */
  surveyedBuildingIds?: Set<string>;
  /** MongoDB lot code for the active session (e.g. "LOT-242"). Used by the
   *  progressive loader to fetch all polygons for the lot by Lot_ID instead
   *  of a slow spatial radius query. Falls back to spatial query if omitted. */
  lotCode?: string;
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

/** Fires onMoveEnd when the user finishes panning/zooming */
function ViewportChangeHandler({
  onMoveEnd,
}: {
  onMoveEnd: (bounds: { north: number; south: number; east: number; west: number }) => void;
}) {
  useMapEvents({
    moveend: (e) => {
      const b = e.target.getBounds();
      onMoveEnd({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      });
    },
    // Also fire on zoomend so customer labels load when user zooms in past threshold
    zoomend: (e) => {
      const b = e.target.getBounds();
      onMoveEnd({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      });
    },
  });
  return null;
}

/** Resolve the best display name from a CustomerPoint record */
function resolveCustomerPointName(cp: CustomerPoint): string {
  if (isValidBusinessName(cp.businessName)) return cp.businessName!;
  const fullName = [cp.firstName, cp.lastName]
    .filter(n => n && n.trim() !== '' && n !== 'None' && n !== 'null')
    .join(' ')
    .trim();
  if (fullName && fullName.toLowerCase() !== 'esteemed customer') return fullName;
  return '';
}

/** Zoom-dependent label - shows customer name from Customer Layer, or building ID */
function ZoomDependentLabel({
  polygon,
  minZoom = LABEL_ZOOM_THRESHOLD,
  status = 'default',
  customerPoint,
}: {
  polygon: BuildingPolygon;
  minZoom?: number;
  status?: 'enumerated' | 'surveyed-session' | 'default';
  customerPoint?: CustomerPoint;
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

  // Priority: Customer Layer point name > polygon attributes > buildingId
  let labelText = '';
  let hasCustomerData = false;
  if (customerPoint) {
    const cpName = resolveCustomerPointName(customerPoint);
    if (cpName) { labelText = cpName; hasCustomerData = true; }
  }
  if (!labelText) labelText = resolveDisplayName(polygon);
  if (labelText === polygon.buildingId) hasCustomerData = false;

  const maxChars = 18;
  const displayText = labelText.length > maxChars
    ? labelText.slice(0, maxChars - 1) + '…'
    : labelText;

  // Enumerated/surveyed always show checkmark; customer data without status = plain
  const prefix = status === 'enumerated' ? '✓ ' : status === 'surveyed-session' ? '✓ ' : (hasCustomerData ? '● ' : '');
  const color = status === 'enumerated' ? '#166534' : status === 'surveyed-session' ? '#1d4ed8' : (hasCustomerData ? '#7c3aed' : '#1a1a1a');

  const labelIcon = L.divIcon({
    className: 'building-label',
    html: `<div style="font-size: 7.5px; color: ${color}; text-shadow: 0 0 3px white, 0 0 3px white; font-weight: 700; white-space: nowrap; pointer-events: none; line-height: 1.2; text-align: center;">${prefix}${displayText}</div>`,
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

// ─── Existing registrations bottom sheet ─────────────────────────────────────

interface ExistingRegistration {
  _id: string;
  buildingId?: string;
  address?: string;
  buildingName?: string;
  propertyType?: string;
  numberOfUnits?: number;
  contactPersonName?: string;
  contactPhoneNumber?: string;
  unitCode?: string;
}

function ExistingRegistrationsSheet({
  polygon,
  registrations,
  isLoading,
  onClose,
  onProceedNew,
  onSelectExisting,
}: {
  polygon: BuildingPolygon;
  registrations: ExistingRegistration[];
  isLoading: boolean;
  onClose: () => void;
  onProceedNew: () => void;
  onSelectExisting: (reg: ExistingRegistration) => void;
}) {
  return (
    <div className="fixed inset-0 z-[3000] flex flex-col justify-end" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl shadow-2xl max-h-[75vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {isValidBusinessName(polygon.businessName) ? polygon.businessName : polygon.buildingId}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">{polygon.buildingId}</p>
            </div>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-500">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Checking existing records…</span>
            </div>
          ) : registrations.length > 0 ? (
            <>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                ⚠️ {registrations.length} existing registration{registrations.length !== 1 ? 's' : ''} found for this building. Tap one to update it, or register a new unit below.
              </p>
              {registrations.map((reg) => (
                <button
                  key={reg._id}
                  onClick={() => onSelectExisting(reg)}
                  className="w-full text-left bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-2 hover:bg-green-100 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {reg.buildingName || reg.address || 'Unnamed building'}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {reg.unitCode && (
                          <span className="text-xs text-blue-600 font-mono">Unit {reg.unitCode}</span>
                        )}
                        {reg.propertyType && (
                          <span className="text-xs text-gray-500">{reg.propertyType}</span>
                        )}
                        {reg.numberOfUnits && (
                          <span className="text-xs text-gray-500">{reg.numberOfUnits} unit{reg.numberOfUnits !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                      {reg.contactPersonName && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {reg.contactPersonName}{reg.contactPhoneNumber ? ` · ${reg.contactPhoneNumber}` : ''}
                        </p>
                      )}
                      {reg.buildingId && (
                        <p className="text-xs font-mono text-gray-300 mt-0.5">{reg.buildingId}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              No existing registrations found for this building.
            </p>
          )}
        </div>

        {/* Footer — safe-area aware so buttons sit above Android nav bar */}
        <div
          className="px-4 pt-3 border-t border-gray-100 flex gap-3"
          style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-3 border-2 border-gray-300 text-gray-600 rounded-xl text-sm font-semibold bg-white hover:bg-gray-50 active:bg-gray-100 transition"
            style={{ minHeight: 50 }}
          >
            Cancel
          </button>
          <button
            onClick={onProceedNew}
            className="flex-1 py-3 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 active:bg-green-800 transition shadow-sm"
            style={{ minHeight: 50 }}
          >
            + Register New Unit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EnhancedLocationMapWithPolygons({
  latitude,
  longitude,
  onLocationChange,
  onBuildingSelected,
  surveyedBuildingIds = new Set(),
  lotCode,
}: EnhancedLocationMapWithPolygonsProps) {
  const [position, setPosition] = useState<[number, number]>([latitude, longitude]);
  const [mapError, setMapError] = useState<string | null>(null);
  // All loaded polygons (accumulates as user pans)
  const [polygons, setPolygons] = useState<BuildingPolygon[]>([]);
  const polygonsRef = useRef<BuildingPolygon[]>([]);
  const [selectedPolygon, setSelectedPolygon] = useState<BuildingPolygon | null>(null);
  const [isLoadingPolygons, setIsLoadingPolygons] = useState(false);
  const [polygonError, setPolygonError] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(() => getCacheTimestamp());
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // Cross-session enumerated building IDs (fetched from backend)
  const [enumeratedBuildingIds, setEnumeratedBuildingIds] = useState<Set<string>>(new Set());

  // Customer points map: buildingId → CustomerPoint (from ArcGIS Customer Layer)
  const [customerPointsMap, setCustomerPointsMap] = useState<Map<string, CustomerPoint>>(new Map());
  const lastCustomerBoundsRef = useRef<{ north: number; south: number; east: number; west: number } | null>(null);
  const customerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bottom sheet state
  const [sheetPolygon, setSheetPolygon] = useState<BuildingPolygon | null>(null);
  const [sheetRegistrations, setSheetRegistrations] = useState<ExistingRegistration[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);

  // Viewport tracking for progressive loading
  const lastQueriedBoundsRef = useRef<{ north: number; south: number; east: number; west: number } | null>(null);
  const viewportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Monitor GPS accuracy continuously
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGpsAccuracy(pos.coords.accuracy),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

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

  // Fetch cross-session enumerated building IDs from backend on mount
  useEffect(() => {
    async function fetchEnumeratedIds() {
      try {
        // Fetch a broad list of buildings to get their arcgisBuildingIds
        const result = await buildingApi.list({ limit: 2000 });
        const ids = new Set<string>();
        for (const b of result.buildings) {
          if (b.arcgisBuildingId) ids.add(b.arcgisBuildingId);
        }
        setEnumeratedBuildingIds(ids);
      } catch {
        // Non-critical — silently ignore; color coding will fall back to session-only
      }
    }
    fetchEnumeratedIds();
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
      const displayName = resolveDisplayName(p);
      const nameMatch = displayName.toLowerCase().includes(q);
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
        polygonsRef.current = mockPolygons;
        setPolygons(mockPolygons);
        setIsLoadingPolygons(false);
        return;
      }

      // ── Progressive two-phase loader (v1.59.2) ────────────────────────────
      // When a lotCode is available, use the fast Lot_ID-based OBJECTID fetch
      // (Phase 1: ~2.5s) followed by parallel geometry batches (Phase 2: ~2s
      // per 400 polygons). This avoids the slow spatial radius query that was
      // timing out for dense lots like LOT-242 (8,169 polygons, ~24s before).
      //
      // The onBatch callback merges each background batch into the map state
      // so polygons appear progressively as they load.
      // ─────────────────────────────────────────────────────────────────────
      if (lotCode) {
        // Show cached data immediately while fresh data loads
        const cachedPolygons = getCachedPolygonsNearLocation(lat, lon, 5);
        if (cachedPolygons.length > 0) {
          polygonsRef.current = cachedPolygons;
          setPolygons(cachedPolygons);
          tryAutoSelect(lat, lon, cachedPolygons);
        }

        const onBatch = (batch: BuildingPolygon[]) => {
          // Merge background batches, deduplicating by buildingId
          const existingIds = new Set(polygonsRef.current.map(p => p.buildingId));
          const newOnes = batch.filter(p => !existingIds.has(p.buildingId));
          if (newOnes.length === 0) return;
          const merged = [...polygonsRef.current, ...newOnes];
          polygonsRef.current = merged;
          setPolygons([...merged]);
          savePolygonsToCache(merged, lat, lon);
          setCacheTimestamp(Date.now());
        };

        const initialPolygons = await fetchPolygonsForLotProgressive(lotCode, onBatch);

        if (initialPolygons.length > 0) {
          // Merge initial batch with any cached polygons already shown
          const existingIds = new Set(polygonsRef.current.map(p => p.buildingId));
          const newOnes = initialPolygons.filter(p => !existingIds.has(p.buildingId));
          const merged = [...polygonsRef.current, ...newOnes];
          polygonsRef.current = merged;
          setPolygons([...merged]);
          savePolygonsToCache(merged, lat, lon);
          setCacheTimestamp(Date.now());
          tryAutoSelect(lat, lon, merged);
        } else if (cachedPolygons.length === 0) {
          // Progressive loader returned nothing — fall through to legacy loader below
          console.warn('[loadPolygons] Progressive loader returned 0 — falling back to legacy spatial query');
          const fallback = await fetchPolygonsNearLocation(lat, lon, 2);
          if (fallback.length > 0) {
            polygonsRef.current = fallback;
            setPolygons(fallback);
            savePolygonsToCache(fallback, lat, lon);
            setCacheTimestamp(Date.now());
            tryAutoSelect(lat, lon, fallback);
          } else {
            setPolygonError('No building data found for this lot');
          }
        }
        return;
      }

      // ── Legacy spatial query (no lotCode available) ───────────────────────
      const LEGACY_RADIUS_KM = 2;
      const cachedPolygons = getCachedPolygonsNearLocation(lat, lon, LEGACY_RADIUS_KM);
      if (cachedPolygons.length > 0) {
        polygonsRef.current = cachedPolygons;
        setPolygons(cachedPolygons);
        tryAutoSelect(lat, lon, cachedPolygons);
      }

      const freshPolygons = await fetchPolygonsNearLocation(lat, lon, LEGACY_RADIUS_KM);
      if (freshPolygons.length > 0) {
        polygonsRef.current = freshPolygons;
        setPolygons(freshPolygons);
        savePolygonsToCache(freshPolygons, lat, lon);
        setCacheTimestamp(Date.now());
        tryAutoSelect(lat, lon, freshPolygons);
      } else if (cachedPolygons.length === 0) {
        setPolygonError('No building data — tap Download to save area data for offline use');
      }
    } catch (error) {
      console.error('Error loading polygons:', error);
      const cachedPolygons = getCachedPolygonsNearLocation(lat, lon, 2);
      if (cachedPolygons.length > 0) {
        polygonsRef.current = cachedPolygons;
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

  // ─── Customer point loading helper ────────────────────────────────────────────────
  const loadCustomerPoints = useCallback(
    (bounds: { north: number; south: number; east: number; west: number }) => {
      // Only fire when zoom >= LABEL_ZOOM_THRESHOLD to avoid fetching when labels are hidden
      if (mapRef.current && mapRef.current.getZoom() < LABEL_ZOOM_THRESHOLD) return;

      // Skip if bounds haven't changed significantly (>70% overlap)
      if (
        lastCustomerBoundsRef.current &&
        boundsOverlapRatio(bounds, lastCustomerBoundsRef.current) > 0.7
      ) return;

      if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current);
      customerDebounceRef.current = setTimeout(async () => {
        lastCustomerBoundsRef.current = bounds;
        try {
          const cpMap = await fetchCustomerPointsInBounds(bounds);
          if (cpMap.size > 0) {
            setCustomerPointsMap(prev => {
              // Merge: new entries override old ones for the same buildingId
              const merged = new Map(prev);
              cpMap.forEach((v, k) => merged.set(k, v));
              return merged;
            });
          }
        } catch (e) {
          console.warn('[CustomerLayer] Viewport load failed (non-critical):', e);
        }
      }, 600);
    },
    []
  );

  // ─── Viewport-based progressive loading ────────────────────────────────────────────
  const handleViewportChange = useCallback(
    (bounds: { north: number; south: number; east: number; west: number }) => {
      // Skip if bounds haven't changed significantly (>80% overlap with last query)
      if (
        lastQueriedBoundsRef.current &&
        boundsOverlapRatio(bounds, lastQueriedBoundsRef.current) > 0.8
      ) {
        return;
      }

      // Debounce 400ms to avoid firing on every pixel of a pan gesture
      if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current);
      viewportDebounceRef.current = setTimeout(async () => {
        lastQueriedBoundsRef.current = bounds;
        try {
          const viewportPolygons = await fetchPolygonsInBounds(bounds);
          if (viewportPolygons.length === 0) return;

          // Merge with existing polygons, deduplicating by buildingId
          const existingIds = new Set(polygonsRef.current.map((p) => p.buildingId));
          const newPolygons = viewportPolygons.filter((p) => !existingIds.has(p.buildingId));
          if (newPolygons.length === 0) return;

          const merged = [...polygonsRef.current, ...newPolygons];
          polygonsRef.current = merged;
          setPolygons([...merged]);
          console.log(`[Viewport] Loaded ${newPolygons.length} new polygons, total: ${merged.length}`);
        } catch (e) {
          console.warn('[Viewport] Query failed:', e);
          // Non-critical — don't show error to user for viewport queries
        }
        // Also refresh customer point labels for the new viewport
        loadCustomerPoints(bounds);
      }, 400);
    },
    [loadCustomerPoints]
  );

  async function handleDownloadAreaData() {
    setIsDownloading(true);
    setDownloadProgress('Connecting to ArcGIS…');
    try {
      setDownloadProgress('Downloading building data…');
      const freshPolygons = await fetchPolygonsNearLocation(position[0], position[1], 5.0);
      if (freshPolygons.length > 0) {
        polygonsRef.current = freshPolygons;
        setPolygons(freshPolygons);
        savePolygonsToCache(freshPolygons, position[0], position[1]);
        setCacheTimestamp(Date.now());
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
        const ring = poly.geometry?.coordinates?.[0];
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

  // ─── Building tap: show bottom sheet with existing registrations ──────────────
  const handlePolygonClick = useCallback(async (polygon: BuildingPolygon, e: L.LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(e as unknown as Event);
    console.log('[Polygon] Tapped:', polygon.buildingId);
    setSelectedPolygon(polygon);
    setPosition([polygon.centerLat, polygon.centerLon]);
    onLocationChange(polygon.centerLat, polygon.centerLon);

    // Show bottom sheet and fetch existing registrations
    setSheetPolygon(polygon);
    setSheetRegistrations([]);
    setSheetLoading(true);

    try {
      const result = await buildingApi.list({ arcgisBuildingId: polygon.buildingId, limit: 50 });
      setSheetRegistrations(result.buildings as ExistingRegistration[]);
    } catch {
      setSheetRegistrations([]);
    } finally {
      setSheetLoading(false);
    }
  }, [onLocationChange]);

  const handleSheetClose = () => {
    setSheetPolygon(null);
    setSheetRegistrations([]);
  };

  const handleSheetProceedNew = () => {
    if (!sheetPolygon) return;
    setSheetPolygon(null);
    if (onBuildingSelected) onBuildingSelected(sheetPolygon);
  };

  const handleSheetSelectExisting = (reg: ExistingRegistration) => {
    if (!sheetPolygon) return;
    setSheetPolygon(null);
    // Pass existing registration data back so the form can pre-fill for update
    if (onBuildingSelected) {
      onBuildingSelected({
        ...sheetPolygon,
        // Attach existing record id so App.tsx can route to update flow
        _existingRegistrationId: reg._id,
        _existingRegistration: reg,
      } as any);
    }
  };

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
    lastQueriedBoundsRef.current = null;
    lastCustomerBoundsRef.current = null;
    polygonsRef.current = [];
    setPolygons([]);
    setCustomerPointsMap(new Map());
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

  // Determine polygon status for color coding
  function getPolygonStatus(buildingId: string): 'enumerated' | 'surveyed-session' | 'default' {
    if (enumeratedBuildingIds.has(buildingId)) return 'enumerated';
    if (surveyedBuildingIds.has(buildingId)) return 'surveyed-session';
    return 'default';
  }

  function getPolygonColors(status: 'enumerated' | 'surveyed-session' | 'default', isSelected: boolean) {
    if (isSelected) return { color: '#1a56db', fillColor: '#1a56db', fillOpacity: 0.55, weight: 4, dashArray: undefined };
    if (status === 'enumerated') return { color: '#166534', fillColor: '#22c55e', fillOpacity: 0.30, weight: 2, dashArray: undefined };
    if (status === 'surveyed-session') return { color: '#1d4ed8', fillColor: '#93c5fd', fillOpacity: 0.30, weight: 2, dashArray: '4 4' };
    return { color: '#f97316', fillColor: '#fed7aa', fillOpacity: 0.30, weight: 1.5, dashArray: undefined };
  }

  try {
    return (
      <div className="w-full h-full flex flex-col gap-1 px-2 pt-1">
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
              {searchResults.map((p) => {
                const status = getPolygonStatus(p.buildingId);
                return (
                  <button
                    key={p.buildingId}
                    onClick={() => handleSearchSelect(p)}
                    className="w-full text-left px-4 py-3 hover:bg-green-50 border-b border-gray-100 last:border-0 transition"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg shrink-0">🏢</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {resolveDisplayName(p)}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {p.buildingId}{p.address ? ` · ${p.address}` : ''}
                        </p>
                      </div>
                      {status === 'enumerated' && (
                        <span className="ml-auto shrink-0 text-green-700 font-bold text-xs bg-green-100 px-1.5 py-0.5 rounded-md">✓ Enumerated</span>
                      )}
                      {status === 'surveyed-session' && (
                        <span className="ml-auto shrink-0 text-blue-700 font-bold text-xs bg-blue-100 px-1.5 py-0.5 rounded-md">✓ This session</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 px-1 flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-green-500 border border-green-700" />
            <span className="text-xs text-gray-600">Enumerated</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-blue-200 border border-blue-700 border-dashed" />
            <span className="text-xs text-gray-600">This session</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-orange-200 border border-orange-400" />
            <span className="text-xs text-gray-600">Not yet done</span>
          </div>
        </div>

        {/* Map — fills available screen height */}
        <div
          className="w-full flex-1 rounded-lg overflow-hidden border border-gray-200 relative"
          style={{ minHeight: 320 }}
        >
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
            <ViewportChangeHandler onMoveEnd={handleViewportChange} />

            <Marker
              position={position}
              draggable={true}
              eventHandlers={{ dragend: handleMarkerDragEnd }}
            />

            {polygons.map((polygon) => {
              const status = getPolygonStatus(polygon.buildingId);
              const isSelected = selectedPolygon?.buildingId === polygon.buildingId;
              const pathOptions = getPolygonColors(status, isSelected);

              if (!polygon.geometry?.coordinates?.[0]) return null;

              const coordinates = polygon.geometry.coordinates[0].map(
                ([lng, lat]) => [lat, lng] as [number, number]
              );

              // Look up live customer data from the Customer Layer
              const customerPoint = customerPointsMap.get(polygon.buildingId);

              return (
                <React.Fragment key={polygon.buildingId}>
                  <Polygon
                    positions={coordinates}
                    pathOptions={pathOptions}
                    eventHandlers={{
                      click: (e) => handlePolygonClick(polygon, e),
                    }}
                  />
                  <ZoomDependentLabel
                    polygon={polygon}
                    minZoom={LABEL_ZOOM_THRESHOLD}
                    status={status}
                    customerPoint={customerPoint}
                  />
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
              {polygons.length > 0
                ? `Loading buildings… (${polygons.length.toLocaleString()} so far)`
                : 'Connecting to ArcGIS…'}
            </div>
          )}
          {/* Progressive background load indicator (after initial load completes) */}
          {!isLoadingPolygons && polygons.length > 0 && polygons.length < 400 && lotCode && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full shadow-sm text-xs text-blue-700 z-[1001] flex items-center gap-1.5">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading more buildings in background…
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

          {/* GPS Accuracy Badge */}
          {gpsAccuracy !== null && gpsAccuracy > 15 && (
            <div className="absolute top-2 right-2 bg-amber-500 text-white px-2.5 py-1.5 rounded-xl shadow-md text-xs font-bold z-[1002] flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              GPS ±{Math.round(gpsAccuracy)}m — wait for fix
            </div>
          )}

          {/* Building count + cache age */}
          {polygons.length > 0 && !isLoadingPolygons && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white px-3 py-1.5 rounded-full shadow-md text-xs text-gray-600 z-[1001] flex items-center gap-1.5">
              <span>{polygons.length} buildings</span>
              {enumeratedBuildingIds.size > 0 && (
                <span className="text-green-700 font-semibold">· {enumeratedBuildingIds.size} enumerated</span>
              )}
              {surveyedBuildingIds.size > 0 && (
                <span className="text-blue-600 font-semibold">· {surveyedBuildingIds.size} this session</span>
              )}
              {cacheTimestamp && (
                <span className="text-gray-400">
                  · {(() => {
                    const diffMs = Date.now() - cacheTimestamp;
                    const mins = Math.floor(diffMs / 60000);
                    const hrs = Math.floor(mins / 60);
                    const days = Math.floor(hrs / 24);
                    if (days > 0) return `${days}d ago`;
                    if (hrs > 0) return `${hrs}h ago`;
                    if (mins > 0) return `${mins}m ago`;
                    return 'just now';
                  })()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Existing registrations bottom sheet */}
        {sheetPolygon && (
          <ExistingRegistrationsSheet
            polygon={sheetPolygon}
            registrations={sheetRegistrations}
            isLoading={sheetLoading}
            onClose={handleSheetClose}
            onProceedNew={handleSheetProceedNew}
            onSelectExisting={handleSheetSelectExisting}
          />
        )}
      </div>
    );
  } catch (error) {
    setMapError(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
