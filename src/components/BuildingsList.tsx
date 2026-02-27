import { useState, useMemo, useEffect, useCallback } from 'react';
import { buildingApi } from '../api/client';
import type { Building } from '../api/client';

interface LocalBuilding {
  _id?: string;
  address: string;
  buildingName?: string;
  lotCode: string;
  propertyType: string;
  numberOfUnits: number;
  gpsCoordinates?: { latitude: number; longitude: number; accuracy?: number };
  photos?: File[] | string[];
  photoCount?: number;
  notes?: string;
  timestamp?: number;
  synced?: boolean;
}

interface BuildingsListProps {
  buildings: LocalBuilding[];
  pendingBuildings: LocalBuilding[];
  onClose: () => void;
}

type FilterType = 'All' | 'Residential' | 'Commercial' | 'Industrial' | 'Mixed-Use' | 'Pending';

// Normalise a server Building to our local shape
function normaliseServerBuilding(b: Building): LocalBuilding {
  return {
    _id: b._id,
    address: b.address,
    buildingName: b.buildingName,
    lotCode: b.lotCode,
    propertyType: b.propertyType,
    numberOfUnits: b.numberOfUnits,
    gpsCoordinates: b.gpsCoordinates,
    photos: b.photos,
    photoCount: b.photos?.length ?? 0,
    notes: b.notes,
    timestamp: b.createdAt ? new Date(b.createdAt).getTime() : undefined,
    synced: true,
  };
}

export default function BuildingsList({ buildings, pendingBuildings, onClose }: BuildingsListProps) {
  const [filter, setFilter] = useState<FilterType>('All');
  const [search, setSearch] = useState('');
  const [serverBuildings, setServerBuildings] = useState<LocalBuilding[]>([]);
  const [loadingServer, setLoadingServer] = useState(false);
  const [serverError, setServerError] = useState('');
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchFromServer = useCallback(async () => {
    setLoadingServer(true);
    setServerError('');
    try {
      const data = await buildingApi.list();
      setServerBuildings(data.map(normaliseServerBuilding));
      setLastFetched(new Date());
    } catch (err: any) {
      setServerError('Could not load server buildings — showing local data only');
    } finally {
      setLoadingServer(false);
    }
  }, []);

  useEffect(() => {
    fetchFromServer();
  }, [fetchFromServer]);

  // Merge: server data takes priority; pending (unsynced) always shown
  const allBuildings = useMemo(() => {
    const serverIds = new Set(serverBuildings.map(b => b._id).filter(Boolean));
    // Local synced buildings not yet in server response (just submitted)
    const localSynced = buildings.filter(b => b.synced !== false && !serverIds.has(b._id));
    const pending = pendingBuildings.map(b => ({ ...b, synced: false as const }));
    return [...serverBuildings, ...localSynced, ...pending];
  }, [serverBuildings, buildings, pendingBuildings]);

  const filtered = useMemo(() => {
    return allBuildings.filter(b => {
      const matchesFilter =
        filter === 'All' ||
        (filter === 'Pending' && b.synced === false) ||
        b.propertyType?.toLowerCase() === filter.toLowerCase();
      const matchesSearch =
        !search ||
        b.address?.toLowerCase().includes(search.toLowerCase()) ||
        b.buildingName?.toLowerCase().includes(search.toLowerCase()) ||
        b.lotCode?.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [allBuildings, filter, search]);

  const getPhotoCount = (b: LocalBuilding) => {
    if (Array.isArray(b.photos)) return b.photos.length;
    if (typeof b.photoCount === 'number') return b.photoCount;
    return 0;
  };

  const getPhotoThumbnail = (b: LocalBuilding): string | null => {
    if (!Array.isArray(b.photos) || b.photos.length === 0) return null;
    const first = b.photos[0];
    if (typeof first === 'string') return first;
    if (first instanceof File) return URL.createObjectURL(first);
    return null;
  };

  const formatTime = (ts?: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const typeColor: Record<string, string> = {
    residential: 'bg-blue-100 text-blue-700',
    commercial: 'bg-orange-100 text-orange-700',
    industrial: 'bg-purple-100 text-purple-700',
    'mixed-use': 'bg-teal-100 text-teal-700',
  };

  const filters: FilterType[] = ['All', 'Residential', 'Commercial', 'Industrial', 'Mixed-Use', 'Pending'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Registered Buildings</h1>
                <p className="text-xs text-gray-500">
                  {loadingServer ? 'Loading from server…' : `${allBuildings.length} total · ${pendingBuildings.length} pending sync`}
                  {lastFetched && !loadingServer && (
                    <span className="ml-1 text-gray-400">· synced {formatTime(lastFetched.getTime())}</span>
                  )}
                </p>
              </div>
            </div>
            {/* Refresh button */}
            <button
              onClick={fetchFromServer}
              disabled={loadingServer}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition disabled:opacity-50"
              title="Refresh from server"
            >
              <svg className={`w-5 h-5 text-gray-600 ${loadingServer ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Server error banner */}
          {serverError && (
            <div className="mb-3 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-yellow-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-yellow-800">{serverError}</p>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by address, name or lot..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {filters.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f}
                {f === 'Pending' && pendingBuildings.length > 0 && (
                  <span className="ml-1 bg-yellow-500 text-white rounded-full px-1.5 py-0.5 text-xs">{pendingBuildings.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading skeleton */}
      {loadingServer && serverBuildings.length === 0 && (
        <div className="px-4 py-3 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
              <div className="flex">
                <div className="w-20 h-20 bg-gray-200 shrink-0" />
                <div className="flex-1 p-3 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="flex gap-2">
                    <div className="h-5 bg-gray-100 rounded-full w-20" />
                    <div className="h-5 bg-gray-100 rounded-full w-16" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {!loadingServer || serverBuildings.length > 0 ? (
        <div className="px-4 py-3 space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">No buildings found</p>
              <p className="text-gray-400 text-sm mt-1">
                {search ? 'Try a different search term' : 'Register your first building to see it here'}
              </p>
            </div>
          )}

          {filtered.map((b, i) => {
            const thumb = getPhotoThumbnail(b);
            const photoCount = getPhotoCount(b);
            const typeKey = b.propertyType?.toLowerCase() || '';
            const colorClass = typeColor[typeKey] || 'bg-gray-100 text-gray-600';

            return (
              <div
                key={b._id || b.timestamp || i}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                  b.synced === false ? 'border-yellow-300' : 'border-gray-100'
                }`}
              >
                <div className="flex">
                  {/* Photo thumbnail */}
                  <div className="w-20 h-20 shrink-0 bg-gray-100 flex items-center justify-center overflow-hidden">
                    {thumb ? (
                      <img src={thumb} alt="Building" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{b.address}</p>
                        {b.buildingName && (
                          <p className="text-xs text-gray-500 truncate">{b.buildingName}</p>
                        )}
                      </div>
                      {b.synced === false ? (
                        <span className="shrink-0 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Pending</span>
                      ) : (
                        <span className="shrink-0 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Synced</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
                        {b.propertyType}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {b.numberOfUnits} unit{b.numberOfUnits !== 1 ? 's' : ''}
                      </span>
                      {b.lotCode && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {b.lotCode}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {photoCount > 0 && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            </svg>
                            {photoCount}
                          </span>
                        )}
                        {b.gpsCoordinates && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            {b.gpsCoordinates.latitude.toFixed(5)}, {b.gpsCoordinates.longitude.toFixed(5)}
                          </span>
                        )}
                      </div>
                      {b.timestamp && (
                        <span className="text-xs text-gray-400">
                          {formatDate(b.timestamp)} {formatTime(b.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Bottom padding */}
      <div className="h-8" />
    </div>
  );
}
