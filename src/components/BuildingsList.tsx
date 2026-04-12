import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { buildingApi, customerApi, sessionApi } from '../api/client';
import type { Building, Customer } from '../api/client';
import BuildingEdit from './BuildingEdit';

interface LocalBuilding {
  _id?: string;
  address: string;
  buildingName?: string;
  lotCode: string;
  propertyType: string;
  numberOfUnits: number;
  gpsCoordinates?: { latitude: number; longitude: number; accuracy?: number };
  notes?: string;
  timestamp?: number;
  synced?: boolean;
  // Customer link info (from server)
  linkedCustomerId?: string;
  linkedCustomerName?: string;
  // Multi-customer polygon fields
  unitCode?: string;
  buildingId?: string;          // Auto-generated code e.g. URBAN-SPIRITLOT-6005
  arcgisBuildingId?: string;    // ArcGIS polygon feature ID
}

interface BuildingsListProps {
  buildings: LocalBuilding[];
  pendingBuildings: LocalBuilding[];
  onClose: () => void;
  filterSessionId?: string;   // When set, fetches only buildings for this session
  filterSessionLabel?: string; // e.g. lot code for display in header
  refreshKey?: number;        // Increment to trigger a server refresh (e.g. after creating a building)
  initialSearch?: string;     // Pre-fill search bar (e.g. from home screen quick search)
  onSyncAll?: () => Promise<void>; // Trigger full sync of all pending buildings
}

type FilterType = 'All' | 'Today' | 'This Week' | 'Last 7 Days' | 'Residential' | 'Commercial' | 'Industrial' | 'Mixed-Use' | 'Pending';

const PAGE_SIZE = 20;

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
    notes: b.notes,
    timestamp: b.createdAt ? new Date(b.createdAt).getTime() : undefined,
    synced: true,
    linkedCustomerId: b.linkedCustomerId,
    linkedCustomerName: b.linkedCustomerName,
    unitCode: b.unitCode,
    buildingId: b.buildingId,
    arcgisBuildingId: b.arcgisBuildingId,
  };
}

export default function BuildingsList({ buildings, pendingBuildings, onClose, filterSessionId, filterSessionLabel, refreshKey, initialSearch, onSyncAll }: BuildingsListProps) {
  const [syncingIndex, setSyncingIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterType>('All');
  const [search, setSearch] = useState(initialSearch ?? '');
  const [serverBuildings, setServerBuildings] = useState<LocalBuilding[]>([]);
  const [loadingServer, setLoadingServer] = useState(false);
  const [serverError, setServerError] = useState('');
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Pagination
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Expand / detail panel
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Edit modal
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);

  // Unlink state
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [unlinkError, setUnlinkError] = useState<Record<string, string>>({});

  // Re-link state (shown after unlink or when building has no customer)
  const [relinkBuildingId, setRelinkBuildingId] = useState<string | null>(null);
  const [relinkSearch, setRelinkSearch] = useState('');
  const [relinkResults, setRelinkResults] = useState<Customer[]>([]);
  const [relinkSearching, setRelinkSearching] = useState(false);
  const [relinkLinking, setRelinkLinking] = useState(false);
  const [relinkError, setRelinkError] = useState<Record<string, string>>({});
  const relinkDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load-more sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [sessionTotal, setSessionTotal] = useState<number | null>(null);

  const fetchFromServer = useCallback(async () => {
    setLoadingServer(true);
    setServerError('');
    try {
      if (filterSessionId) {
        // Use dedicated session buildings endpoint (backend v4.0.0)
        const { buildings, total } = await sessionApi.getBuildings(filterSessionId);
        setServerBuildings(buildings.map(normaliseServerBuilding));
        setSessionTotal(total);
      } else {
        const { buildings } = await buildingApi.list();
        setServerBuildings(buildings.map(normaliseServerBuilding));
        setSessionTotal(null);
      }
      setLastFetched(new Date());
    } catch (err: any) {
      setServerError('Could not load buildings — check your connection and try again');
    } finally {
      setLoadingServer(false);
    }
  }, [filterSessionId]);

  useEffect(() => {
    fetchFromServer();
  }, [fetchFromServer]);

  // Re-fetch from server when refreshKey changes (e.g. after a new building is created)
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      fetchFromServer();
    }
  }, [refreshKey, fetchFromServer]);

  // Reset pagination when filter/search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, search]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(v => v + PAGE_SIZE);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Merge: server data takes priority; pending (unsynced) always shown.
  // Deduplication strategy:
  //   1. Server buildings are the source of truth.
  //   2. A local building is suppressed if ANY of these match a server building:
  //      a. _id matches (building was synced and we have its server _id)
  //      b. arcgisBuildingId matches (same polygon captured twice)
  //      c. address+lotCode fingerprint matches (same address in same lot)
  //   3. Pending (unsynced) buildings are always shown — they have no server record yet.
  const allBuildings = useMemo(() => {
    const serverIds = new Set(serverBuildings.map(b => b._id).filter(Boolean));
    const serverArcgisIds = new Set(
      serverBuildings.map(b => (b as any).arcgisBuildingId).filter(Boolean)
    );
    const serverFingerprints = new Set(
      serverBuildings
        .map(b => b.address && b.lotCode ? `${b.address.trim().toLowerCase()}|${b.lotCode}` : null)
        .filter(Boolean)
    );

    const localSynced = buildings.filter(b => {
      if (b.synced === false) return false; // pending handled separately
      if (b._id && serverIds.has(b._id)) return false; // already on server by _id
      if ((b as any).arcgisBuildingId && serverArcgisIds.has((b as any).arcgisBuildingId)) return false;
      const fp = b.address && b.lotCode ? `${b.address.trim().toLowerCase()}|${b.lotCode}` : null;
      if (fp && serverFingerprints.has(fp)) return false;
      return true;
    });

    const pending = pendingBuildings.map(b => ({ ...b, synced: false as const }));
    return [...serverBuildings, ...localSynced, ...pending];
  }, [serverBuildings, buildings, pendingBuildings]);

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    // This Week: Monday 00:00 to now
    const thisWeekStart = new Date(now);
    const dayOfWeek = thisWeekStart.getDay(); // 0=Sun, 1=Mon...
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    thisWeekStart.setDate(thisWeekStart.getDate() + diffToMonday);
    thisWeekStart.setHours(0, 0, 0, 0);

    // Last 7 Days: 7 days ago 00:00 to now
    const last7Start = new Date(now);
    last7Start.setDate(last7Start.getDate() - 6);
    last7Start.setHours(0, 0, 0, 0);

    return allBuildings.filter(b => {
      const matchesFilter =
        filter === 'All' ||
        (filter === 'Pending' && b.synced === false) ||
        (filter === 'Today' && b.timestamp !== undefined &&
          b.timestamp >= todayStart.getTime() && b.timestamp <= todayEnd.getTime()) ||
        (filter === 'This Week' && b.timestamp !== undefined &&
          b.timestamp >= thisWeekStart.getTime()) ||
        (filter === 'Last 7 Days' && b.timestamp !== undefined &&
          b.timestamp >= last7Start.getTime()) ||
        b.propertyType?.toLowerCase() === filter.toLowerCase();
      const matchesSearch =
        !search ||
        b.address?.toLowerCase().includes(search.toLowerCase()) ||
        b.buildingName?.toLowerCase().includes(search.toLowerCase()) ||
        b.lotCode?.toLowerCase().includes(search.toLowerCase()) ||
        b.buildingId?.toLowerCase().includes(search.toLowerCase()) ||
        b.arcgisBuildingId?.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [allBuildings, filter, search]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

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

  const filters: FilterType[] = ['All', 'Today', 'This Week', 'Last 7 Days', 'Residential', 'Commercial', 'Industrial', 'Mixed-Use', 'Pending'];

  // Handle unlink customer
  const handleUnlink = async (b: LocalBuilding) => {
    if (!b.linkedCustomerId || !b._id) return;
    setUnlinkingId(b._id);
    setUnlinkError(prev => ({ ...prev, [b._id!]: '' }));
    try {
      // v1.58.2: Use MongoDB _id for unlink — unit-specific, avoids parent polygon ambiguity
      const buildingMongoId = b._id ?? '';
      await customerApi.unlink(b.linkedCustomerId, buildingMongoId);
      // Update local state to remove link
      setServerBuildings(prev =>
        prev.map(sb =>
          sb._id === b._id ? { ...sb, linkedCustomerId: undefined, linkedCustomerName: undefined } : sb
        )
      );
      // Automatically open re-link panel after successful unlink
      setRelinkBuildingId(b._id);
      setRelinkSearch('');
      setRelinkResults([]);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to unlink customer';
      setUnlinkError(prev => ({ ...prev, [b._id!]: msg }));
    } finally {
      setUnlinkingId(null);
    }
  };

  // Handle re-link customer search (debounced)
  const handleRelinkSearchChange = (query: string) => {
    setRelinkSearch(query);
    if (relinkDebounceRef.current) clearTimeout(relinkDebounceRef.current);
    if (!query.trim()) { setRelinkResults([]); return; }
    relinkDebounceRef.current = setTimeout(async () => {
      setRelinkSearching(true);
      try {
        const results = await customerApi.search({ query: query.trim(), limit: 10 });
        setRelinkResults(results);
      } catch {
        setRelinkResults([]);
      } finally {
        setRelinkSearching(false);
      }
    }, 400);
  };

  // Handle re-link: link selected customer to building
  const handleRelinkCustomer = async (b: LocalBuilding, customer: Customer) => {
    if (!b._id) return;
    setRelinkLinking(true);
    setRelinkError(prev => ({ ...prev, [b._id!]: '' }));
    try {
      // v1.58.2: Use MongoDB _id for link — unit-specific, avoids parent polygon ambiguity
      const buildingMongoId = b._id ?? '';
      await customerApi.link(customer._id, buildingMongoId);
      // Update local state to show new link
      setServerBuildings(prev =>
        prev.map(sb =>
          sb._id === b._id
            ? { ...sb, linkedCustomerId: customer._id, linkedCustomerName: customer.name }
            : sb
        )
      );
      // Close re-link panel
      setRelinkBuildingId(null);
      setRelinkSearch('');
      setRelinkResults([]);
    } catch (err: any) {
      const raw = err?.response?.data?.message ?? err?.message ?? '';
      const isDuplicate =
        raw.toLowerCase().includes('already linked') ||
        raw.toLowerCase().includes('already assigned') ||
        raw.toLowerCase().includes('duplicate');
      const msg = isDuplicate
        ? `${customer.name} is already linked to another building. Each customer can only be linked to one building.`
        : raw || 'Failed to link customer. Please try again.';
      setRelinkError(prev => ({ ...prev, [b._id!]: msg }));
    } finally {
      setRelinkLinking(false);
    }
  };

  // Handle edit saved
  const handleEditSaved = (updated: Building) => {
    setServerBuildings(prev =>
      prev.map(sb => (sb._id === updated._id ? normaliseServerBuilding(updated) : sb))
    );
    setEditingBuilding(null);
  };

  // Convert LocalBuilding to Building shape for edit modal (server buildings only)
  const toBuilding = (b: LocalBuilding): Building | null => {
    if (!b._id || b.synced === false) return null;
    return {
      _id: b._id,
      address: b.address,
      buildingName: b.buildingName,
      lotCode: b.lotCode,
      propertyType: b.propertyType as Building['propertyType'],
      numberOfUnits: b.numberOfUnits,
      gpsCoordinates: b.gpsCoordinates ?? { latitude: 0, longitude: 0 },
      photos: [],
      notes: b.notes,
      userId: '',
      companyId: '',
      createdAt: b.timestamp ? new Date(b.timestamp).toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Edit modal */}
      {editingBuilding && (
        <BuildingEdit
          building={editingBuilding}
          onSaved={handleEditSaved}
          onClose={() => setEditingBuilding(null)}
        />
      )}

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
                <h1 className="text-lg font-bold text-gray-900">
                  {filterSessionLabel ? `Session: ${filterSessionLabel}` : 'Registered Buildings'}
                </h1>
                <p className="text-xs text-gray-500">
                  {loadingServer
                    ? 'Loading from server…'
                    : filterSessionId
                      ? `${sessionTotal ?? allBuildings.length} building${(sessionTotal ?? allBuildings.length) !== 1 ? 's' : ''} in this session`
                      : `${allBuildings.length} building${allBuildings.length !== 1 ? 's' : ''} · ${pendingBuildings.length} pending sync`
                  }
                  {lastFetched && !loadingServer && (
                    <span className="ml-1 text-gray-400">· synced {formatTime(lastFetched.getTime())}</span>
                  )}
                </p>
              </div>
            </div>
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
                {f === 'Today' && (() => {
              const todayStart = new Date(); todayStart.setHours(0,0,0,0);
              const cnt = allBuildings.filter(b => b.timestamp !== undefined && b.timestamp >= todayStart.getTime()).length;
              return cnt > 0 ? <span className="ml-1 bg-green-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{cnt}</span> : null;
            })()}
            {f === 'This Week' && (() => {
              const ws = new Date(); const d = ws.getDay(); ws.setDate(ws.getDate() + (d === 0 ? -6 : 1 - d)); ws.setHours(0,0,0,0);
              const cnt = allBuildings.filter(b => b.timestamp !== undefined && b.timestamp >= ws.getTime()).length;
              return cnt > 0 ? <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{cnt}</span> : null;
            })()}
            {f === 'Last 7 Days' && (() => {
              const s = new Date(); s.setDate(s.getDate() - 6); s.setHours(0,0,0,0);
              const cnt = allBuildings.filter(b => b.timestamp !== undefined && b.timestamp >= s.getTime()).length;
              return cnt > 0 ? <span className="ml-1 bg-indigo-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{cnt}</span> : null;
            })()}
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
      {(!loadingServer || serverBuildings.length > 0) && (
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

          {visible.map((b, i) => {
            const typeKey = b.propertyType?.toLowerCase() || '';
            const colorClass = typeColor[typeKey] || 'bg-gray-100 text-gray-600';
            const cardId = b._id || String(b.timestamp) || String(i);
            const isExpanded = expandedId === cardId;
            const canEdit = !!b._id && b.synced !== false;

            return (
              <div
                key={cardId}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${
                  b.synced === false ? 'border-yellow-300' : isExpanded ? 'border-blue-300' : 'border-gray-100'
                }`}
              >
                {/* Card row — tap to expand */}
                <div
                  className="flex cursor-pointer active:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : cardId)}
                >


                  {/* Details */}
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{b.address}</p>
                        {b.buildingName && (
                          <p className="text-xs text-gray-500 truncate">{b.buildingName}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {b.synced === false ? (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            ⏳ Pending
                            {onSyncAll && (
                              <button
                                type="button"
                                onClick={async (e) => { e.stopPropagation(); await onSyncAll(); }}
                                className="ml-1 text-yellow-800 underline text-xs font-semibold"
                              >
                                Retry
                              </button>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Synced</span>
                        )}
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {/* Unit code badge — prominent amber pill */}
                      {b.unitCode && (
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                          {b.unitCode}
                        </span>
                      )}
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
                      {/* Linked customer badge — visible on collapsed card */}
                      {b.linkedCustomerName && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {b.linkedCustomerName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3 text-xs text-gray-400">
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

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-4">
                    {/* Notes */}
                    {b.notes && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                        <p className="text-sm text-gray-700">{b.notes}</p>
                      </div>
                    )}

                    {/* Building ID — arcgisBuildingId is primary, buildingId is secondary */}
                    {(b.arcgisBuildingId || b.buildingId) && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Building ID</p>
                        {b.arcgisBuildingId && (
                          <p className="text-sm font-mono text-gray-900 font-semibold">{b.arcgisBuildingId}</p>
                        )}
                        {b.buildingId && (
                          <p className="text-xs font-mono text-gray-400 mt-0.5">System: {b.buildingId}</p>
                        )}
                      </div>
                    )}

                    {/* GPS detail */}
                    {b.gpsCoordinates && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">GPS Coordinates</p>
                        <p className="text-sm font-mono text-gray-700">
                          {b.gpsCoordinates.latitude.toFixed(6)}, {b.gpsCoordinates.longitude.toFixed(6)}
                          {b.gpsCoordinates.accuracy != null && (
                            <span className="text-gray-400"> ±{Math.round(b.gpsCoordinates.accuracy)}m</span>
                          )}
                        </p>
                      </div>
                    )}

                    {/* Customer link */}
                    {b.linkedCustomerId ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-0.5">Linked Customer</p>
                            <p className="text-sm font-medium text-blue-900">{b.linkedCustomerName ?? b.linkedCustomerId}</p>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            {/* Re-link button — opens search panel */}
                            {canEdit && (
                              <button
                                onClick={() => {
                                  if (relinkBuildingId === b._id) {
                                    setRelinkBuildingId(null);
                                  } else {
                                    setRelinkBuildingId(b._id!);
                                    setRelinkSearch('');
                                    setRelinkResults([]);
                                    setRelinkError(prev => ({ ...prev, [b._id!]: '' }));
                                  }
                                }}
                                className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-200 transition flex items-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Re-link
                              </button>
                            )}
                            <button
                              onClick={() => handleUnlink(b)}
                              disabled={unlinkingId === b._id}
                              className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition disabled:opacity-50 flex items-center gap-1"
                            >
                              {unlinkingId === b._id ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600" />
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                  </svg>
                                  Unlink
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                        {unlinkError[b._id!] && (
                          <p className="text-xs text-red-600 mt-2">{unlinkError[b._id!]}</p>
                        )}
                      </div>
                    ) : canEdit && (
                      /* No customer linked — show Link Customer button */
                      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500">No customer linked to this building</p>
                          <button
                            onClick={() => {
                              if (relinkBuildingId === b._id) {
                                setRelinkBuildingId(null);
                              } else {
                                setRelinkBuildingId(b._id!);
                                setRelinkSearch('');
                                setRelinkResults([]);
                                setRelinkError(prev => ({ ...prev, [b._id!]: '' }));
                              }
                            }}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            Link Customer
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Re-link / Link customer search panel */}
                    {relinkBuildingId === b._id && (
                      <div className="bg-white border border-blue-200 rounded-xl px-4 py-4 space-y-3">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                          {b.linkedCustomerId ? 'Re-link Customer' : 'Link Customer'}
                        </p>
                        <div className="relative">
                          <input
                            type="text"
                            value={relinkSearch}
                            onChange={e => handleRelinkSearchChange(e.target.value)}
                            placeholder="Search by name, phone, or ID…"
                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 pr-8"
                            autoFocus
                          />
                          {relinkSearching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                          )}
                        </div>
                        {relinkResults.length > 0 && (
                          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden max-h-48 overflow-y-auto">
                            {relinkResults.map(c => (
                              <li key={c._id}>
                                <button
                                  onClick={() => handleRelinkCustomer(b, c)}
                                  disabled={relinkLinking}
                                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition flex items-center justify-between gap-2 disabled:opacity-50"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                                    {(c.phone || c.customerId) && (
                                      <p className="text-xs text-gray-500">
                                        {[c.phone, c.customerId].filter(Boolean).join(' · ')}
                                      </p>
                                    )}
                                  </div>
                                  {relinkLinking ? (
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-500" />
                                  ) : (
                                    <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {relinkSearch.trim() && !relinkSearching && relinkResults.length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-2">No customers found for "{relinkSearch}"</p>
                        )}
                        {relinkError[b._id!] && (
                          <p className="text-xs text-red-600">{relinkError[b._id!]}</p>
                        )}
                        <button
                          onClick={() => { setRelinkBuildingId(null); setRelinkSearch(''); setRelinkResults([]); }}
                          className="text-xs text-gray-400 hover:text-gray-600 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      {canEdit && (
                        <button
                          onClick={() => {
                            const full = toBuilding(b);
                            if (full) setEditingBuilding(full);
                          }}
                          className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit Building
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedId(null)}
                        className="py-2.5 px-4 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="py-4 flex justify-center">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
                Loading more…
              </div>
            </div>
          )}

          {!hasMore && filtered.length > PAGE_SIZE && (
            <p className="text-center text-xs text-gray-400 py-4">
              All {filtered.length} buildings loaded
            </p>
          )}
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
