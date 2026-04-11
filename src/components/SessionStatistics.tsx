import { useState, useEffect } from 'react';
import { sessionApi, type SessionStatistics as ServerStats } from '../api/client';

interface SessionData {
  sessionId: string;
  lotCode: string;
  startTime: string;
  buildingsRegistered: number;
  isActive: boolean;
}

interface SessionStatisticsProps {
  onClose: () => void;
  pendingBuildings?: any[];
  isOnline?: boolean;
  isSyncing?: boolean;
  onSyncAll?: () => void;
  dailyTarget?: number;
}

function formatRelativeTime(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

export default function SessionStatistics({
  onClose,
  pendingBuildings = [],
  isOnline = true,
  isSyncing = false,
  onSyncAll,
  dailyTarget = 50,
}: SessionStatisticsProps) {
  const [activeSession, setActiveSession] = useState<SessionData | null>(null);
  const [sessionDuration, setSessionDuration] = useState('00:00:00');
  const [recentBuildings, setRecentBuildings] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  const [serverStatsLoading, setServerStatsLoading] = useState(false);

  useEffect(() => {
    const savedSession = localStorage.getItem('activeSession');
    if (savedSession) setActiveSession(JSON.parse(savedSession));
    const savedBuildings = localStorage.getItem('recentBuildings');
    if (savedBuildings) setRecentBuildings(JSON.parse(savedBuildings));
  }, []);

  // Fetch server-side historical statistics
  useEffect(() => {
    if (!isOnline) return;
    setServerStatsLoading(true);
    sessionApi.getStatistics()
      .then(stats => setServerStats(stats))
      .catch(() => setServerStats(null))
      .finally(() => setServerStatsLoading(false));
  }, [isOnline]);

  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(() => {
      const startTime = new Date(activeSession.startTime);
      const now = new Date();
      const diffMs = now.getTime() - startTime.getTime();
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      setSessionDuration(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  function escapeCSV(val: any): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  async function handleShareReport() {
    setIsExporting(true);
    try {
      const allBuildings = [...recentBuildings, ...pendingBuildings];
      if (allBuildings.length === 0) {
        setExportMsg('No buildings to share yet');
        setTimeout(() => setExportMsg(null), 3000);
        setIsExporting(false);
        return;
      }

      const headers = [
        'Building ID', 'Address', 'Building Name', 'Lot Code',
        'Property Type', 'Number of Units', 'Latitude', 'Longitude',
        'Zone', 'Notes', 'Timestamp', 'Status',
      ];

      const rows = allBuildings.map((b: any) => {
        return [
          escapeCSV(b.buildingId || b.selectedBuildingId || ''),
          escapeCSV(b.address || ''),
          escapeCSV(b.buildingName || ''),
          escapeCSV(b.lotCode || activeSession?.lotCode || ''),
          escapeCSV(b.propertyType || ''),
          escapeCSV(b.numberOfUnits || ''),
          escapeCSV(b.latitude || b.gpsCoordinates?.latitude || ''),
          escapeCSV(b.longitude || b.gpsCoordinates?.longitude || ''),
          escapeCSV(b.zone || (b.arcgisBuildingId?.split(' ')[1]) || ''),
          escapeCSV(b.notes || ''),
          escapeCSV(b.timestamp ? new Date(b.timestamp).toISOString() : ''),
          escapeCSV(b.synced ? 'Synced' : 'Pending'),
        ];
      });

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const sessionDate = activeSession
        ? new Date(activeSession.startTime).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const filename = `enumeration_${activeSession?.lotCode || 'session'}_${sessionDate}.csv`;

      // Try Web Share API (Android share sheet)
      if (navigator.share && navigator.canShare) {
        const file = new File([csvContent], filename, { type: 'text/csv' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Property Enumeration Report — ${activeSession?.lotCode || 'Session'}`,
            text: `${allBuildings.length} buildings registered on ${sessionDate}`,
            files: [file],
          });
          setExportMsg(`✓ Shared ${allBuildings.length} buildings`);
          setTimeout(() => setExportMsg(null), 4000);
          return;
        }
      }

      // Fallback: download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportMsg(`✓ Exported ${allBuildings.length} buildings`);
      setTimeout(() => setExportMsg(null), 4000);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setExportMsg('Share cancelled');
      } else {
        console.error('Share error:', err);
        setExportMsg('Share failed — try Export CSV instead');
      }
      setTimeout(() => setExportMsg(null), 3000);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportCSV() {
    setIsExporting(true);
    try {
      const allBuildings = [...recentBuildings, ...pendingBuildings];
      if (allBuildings.length === 0) {
        setExportMsg('No buildings to export yet');
        setTimeout(() => setExportMsg(null), 3000);
        setIsExporting(false);
        return;
      }

      const headers = [
        'Building ID', 'Address', 'Building Name', 'Lot Code',
        'Property Type', 'Number of Units', 'Latitude', 'Longitude',
        'Zone', 'Notes', 'Timestamp', 'Status',
      ];

      const rows = allBuildings.map((b: any) => {
        return [
          escapeCSV(b.buildingId || b.selectedBuildingId || ''),
          escapeCSV(b.address || ''),
          escapeCSV(b.buildingName || ''),
          escapeCSV(b.lotCode || activeSession?.lotCode || ''),
          escapeCSV(b.propertyType || ''),
          escapeCSV(b.numberOfUnits || ''),
          escapeCSV(b.latitude || b.gpsCoordinates?.latitude || ''),
          escapeCSV(b.longitude || b.gpsCoordinates?.longitude || ''),
          escapeCSV(b.zone || (b.arcgisBuildingId?.split(' ')[1]) || ''),
          escapeCSV(b.notes || ''),
          escapeCSV(b.timestamp ? new Date(b.timestamp).toISOString() : ''),
          escapeCSV(b.synced ? 'Synced' : 'Pending'),
        ];
      });

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const sessionDate = activeSession
        ? new Date(activeSession.startTime).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const filename = `enumeration_${activeSession?.lotCode || 'session'}_${sessionDate}.csv`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportMsg(`✓ Exported ${allBuildings.length} buildings`);
      setTimeout(() => setExportMsg(null), 4000);
    } catch (err) {
      console.error('CSV export error:', err);
      setExportMsg('Export failed — try again');
      setTimeout(() => setExportMsg(null), 3000);
    } finally {
      setIsExporting(false);
    }
  }

  // Build property type breakdown from all buildings
  const allBuildings = [...recentBuildings, ...pendingBuildings];
  const typeCounts: Record<string, number> = {};
  for (const b of allBuildings) {
    const t = b.propertyType || 'Unknown';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = typeEntries.length > 0 ? Math.max(...typeEntries.map(e => e[1])) : 1;

  const TYPE_COLORS: Record<string, string> = {
    Residential: 'bg-blue-500',
    Commercial: 'bg-orange-500',
    Industrial: 'bg-purple-500',
    Mixed: 'bg-teal-500',
    Unknown: 'bg-gray-400',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                aria-label="Close"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Session Statistics</h2>
                <p className="text-sm text-gray-600">Current session metrics</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShareReport}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition text-sm font-medium"
                title="Share via WhatsApp, email, Drive…"
              >
                {isExporting ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                )}
                Share
              </button>
              <button
                onClick={handleExportCSV}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition text-sm font-medium"
              >
                {isExporting ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                Export CSV
              </button>
            </div>
          </div>
          {exportMsg && (
            <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg font-medium ${exportMsg.startsWith('✓') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {exportMsg}
            </div>
          )}
        </div>

        {/* Sync-All Banner */}
        {pendingBuildings.length > 0 && isOnline && (
          <div className="mx-6 mt-4 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-sm text-yellow-800 font-medium">
                {pendingBuildings.length} building{pendingBuildings.length !== 1 ? 's' : ''} pending sync
              </p>
            </div>
            <button
              onClick={onSyncAll}
              disabled={isSyncing}
              className="shrink-0 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold flex items-center gap-1.5 transition"
            >
              {isSyncing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Syncing…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync All
                </>
              )}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-6">
          {activeSession ? (
            <>
              {/* Active Session Card */}
              <div className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold text-green-700 uppercase">Active Session</span>
                  </div>
                  <span className="text-xs px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                    {activeSession.lotCode}
                  </span>
                </div>

                <div className="text-center mb-6">
                  <p className="text-sm text-gray-600 mb-2">Session Duration</p>
                  <p className="text-4xl font-bold text-gray-900 font-mono">{sessionDuration}</p>
                </div>

                {/* Daily Target Progress Ring */}
                {dailyTarget > 0 && (
                  <div className="flex items-center justify-center gap-4 mb-4 bg-white rounded-xl p-4">
                    <div className="relative w-20 h-20">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="15.9" fill="none"
                          stroke={activeSession.buildingsRegistered >= dailyTarget ? '#10b981' : '#3b82f6'}
                          strokeWidth="3"
                          strokeDasharray={`${Math.min(100, Math.round((activeSession.buildingsRegistered / dailyTarget) * 100))} 100`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-800">
                        {Math.min(100, Math.round((activeSession.buildingsRegistered / dailyTarget) * 100))}%
                      </span>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">{activeSession.buildingsRegistered} / {dailyTarget}</p>
                      <p className="text-sm text-gray-600">Daily target</p>
                      {activeSession.buildingsRegistered >= dailyTarget && (
                        <p className="text-xs font-bold text-green-600 mt-1">🎯 Target reached!</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 text-center">
                    <svg className="w-8 h-8 text-blue-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <p className="text-2xl font-bold text-gray-900">{activeSession.buildingsRegistered}</p>
                    <p className="text-xs text-gray-600">Buildings</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center">
                    <svg className="w-8 h-8 text-purple-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-2xl font-bold text-gray-900">{activeSession.lotCode}</p>
                    <p className="text-xs text-gray-600">Lot Code</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-green-200">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Started: {formatDate(activeSession.startTime)}</span>
                  </div>
                </div>
              </div>

              {/* Property Type Breakdown Chart */}
              {typeEntries.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-5">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Property Type Breakdown
                  </h3>
                  <div className="space-y-3">
                    {typeEntries.map(([type, count]) => {
                      const pct = Math.round((count / maxCount) * 100);
                      const colorClass = TYPE_COLORS[type] || 'bg-gray-400';
                      const totalBuildings = allBuildings.length;
                      const share = totalBuildings > 0 ? Math.round((count / totalBuildings) * 100) : 0;
                      return (
                        <div key={type}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">{type}</span>
                            <span className="text-sm text-gray-500">{count} ({share}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className={`${colorClass} h-3 rounded-full transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">{allBuildings.length} total buildings this session</p>
                </div>
              )}

              {/* Recent Buildings */}
              {recentBuildings.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Recent Buildings</h3>
                  <div className="space-y-3">
                    {recentBuildings.slice(0, 5).map((building, index) => {
                      return (
                        <div
                          key={index}
                          className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 mb-1">
                                {building.buildingName || building.address}
                              </p>
                              {building.buildingName && (
                                <p className="text-sm text-gray-600 mb-2">{building.address}</p>
                              )}
                              <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                                <span>{building.propertyType}</span>
                                <span>{building.numberOfUnits} unit{building.numberOfUnits > 1 ? 's' : ''}</span>

                                {building.timestamp && (
                                  <span className="text-gray-400">
                                    {formatRelativeTime(Date.now() - new Date(building.timestamp).getTime())}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="ml-4">
                              <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                                ✓ Registered
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Performance Stats */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Performance</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Average time per building</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {activeSession.buildingsRegistered > 0
                        ? Math.round(
                            (new Date().getTime() - new Date(activeSession.startTime).getTime()) /
                              60000 / activeSession.buildingsRegistered
                          )
                        : 0}{' '}
                      min
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Buildings per hour</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {activeSession.buildingsRegistered > 0
                        ? Math.round(
                            (activeSession.buildingsRegistered /
                              (new Date().getTime() - new Date(activeSession.startTime).getTime())) *
                              3600000
                          )
                        : 0}
                    </span>
                  </div>

                </div>
              </div>

              {/* Server-Side Historical Statistics */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  Historical (All Sessions)
                </h3>
                {!isOnline ? (
                  <p className="text-sm text-gray-400">Connect to the internet to view historical statistics</p>
                ) : serverStatsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading server statistics...
                  </div>
                ) : serverStats ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-indigo-50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-indigo-700">{serverStats.totalSessions}</p>
                        <p className="text-xs text-indigo-600">Total Sessions</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-green-700">{serverStats.totalBuildingsEnumerated}</p>
                        <p className="text-xs text-green-600">Total Buildings</p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-blue-700">{Math.round(serverStats.averageBuildingsPerSession)}</p>
                        <p className="text-xs text-blue-600">Avg per Session</p>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-purple-700">{Math.round(serverStats.averageDurationMinutes)}m</p>
                        <p className="text-xs text-purple-600">Avg Duration</p>
                      </div>
                    </div>
                    {Object.keys(serverStats.lotBreakdown).length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Lot Breakdown</p>
                        <div className="space-y-2">
                          {Object.entries(serverStats.lotBreakdown).map(([lot, data]) => (
                            <div key={lot} className="flex items-center justify-between text-sm">
                              <span className="font-medium text-gray-700">{lot}</span>
                              <div className="flex gap-3 text-xs text-gray-500">
                                <span>{data.sessions} session{data.sessions !== 1 ? 's' : ''}</span>
                                <span className="font-semibold text-gray-700">{data.buildings} bldgs</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Could not load server statistics</p>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Active Session</h3>
              <p className="text-gray-600">Start an enumeration session to see statistics</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
