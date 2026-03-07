import { useState, useEffect, useCallback } from 'react';
import { sessionApi } from '../api/client';
import type { Session } from '../api/client';

interface SessionHistoryProps {
  onClose: () => void;
  onViewSessionBuildings?: (sessionId: string, lotCode: string) => void;
}

export default function SessionHistory({ onClose, onViewSessionBuildings }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Force-end session state
  const [forceEndingId, setForceEndingId] = useState<string | null>(null);
  const [forceEndError, setForceEndError] = useState<Record<string, string>>({});
  const [forceEndSuccess, setForceEndSuccess] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await sessionApi.list();
      setSessions(data);
    } catch (err: any) {
      setError('Could not load session history. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleForceEnd = async (session: Session) => {
    if (!confirm(`Force-end session ${session._id.slice(-8)}? This will mark it as completed without GPS data.`)) return;
    setForceEndingId(session._id);
    setForceEndError(prev => ({ ...prev, [session._id]: '' }));
    setForceEndSuccess(null);
    try {
      // Use 0,0 as dummy end location since we don't have GPS here
      await sessionApi.end(session._id, {
        endLocation: { latitude: 0, longitude: 0, accuracy: 0 },
      });
      setForceEndSuccess(session._id);
      // Refresh session list
      await fetchSessions();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to end session';
      setForceEndError(prev => ({ ...prev, [session._id]: msg }));
    } finally {
      setForceEndingId(null);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const formatDuration = (start: string, end?: string) => {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const diffMs = e - s;
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
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
              <h1 className="text-lg font-bold text-gray-900">Session History</h1>
              <p className="text-xs text-gray-500">{sessions.length} sessions on record</p>
            </div>
          </div>
          <button
            onClick={fetchSessions}
            disabled={loading}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition disabled:opacity-50"
          >
            <svg className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Error */}
        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3">
            <svg className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-yellow-800">{error}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && sessions.length === 0 && (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
                <div className="flex gap-3">
                  <div className="h-8 bg-gray-100 rounded-lg flex-1" />
                  <div className="h-8 bg-gray-100 rounded-lg flex-1" />
                  <div className="h-8 bg-gray-100 rounded-lg flex-1" />
                </div>
              </div>
            ))}
          </>
        )}

        {/* Empty state */}
        {!loading && sessions.length === 0 && !error && (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-700 font-semibold">No sessions found</p>
            <p className="text-gray-500 text-sm mt-1 leading-relaxed">
              Sessions you complete will appear here.
            </p>
            <p className="text-gray-400 text-xs mt-3 leading-relaxed">
              If you have completed sessions but see nothing here, your account may not be
              linked to a company yet. Please log out, log back in, and try again.
              If the issue persists, contact your administrator to verify your company assignment.
            </p>
          </div>
        )}

        {/* Session cards */}
        {sessions.map(session => {
          const isExpanded = expandedId === session._id;
          const duration = formatDuration(session.startTime, session.endTime);

          return (
            <div
              key={session._id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Card header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : session._id)}
                className="w-full text-left p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        session.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {session.isActive ? '● Active' : 'Completed'}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(session.startTime)}</span>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">{session.lotCode}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatTime(session.startTime)}
                      {session.endTime ? ` – ${formatTime(session.endTime)}` : ' (ongoing)'}
                      {' · '}{duration}
                    </p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform shrink-0 mt-1 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-blue-700">{session.buildingsEnumerated}</p>
                    <p className="text-xs text-blue-600">Buildings</p>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-teal-700">{session.customersLinked}</p>
                    <p className="text-xs text-teal-600">Customers</p>
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-2 bg-gray-50">
                  {session.startLocation && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      <span>Start: {session.startLocation.latitude.toFixed(5)}, {session.startLocation.longitude.toFixed(5)}</span>
                    </div>
                  )}
                  {session.endLocation && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      <span>End: {session.endLocation.latitude.toFixed(5)}, {session.endLocation.longitude.toFixed(5)}</span>
                    </div>
                  )}
                  {session.areasCovered && session.areasCovered.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <span>Areas: {session.areasCovered.join(', ')}</span>
                    </div>
                  )}
                  {session.notes && (
                    <div className="flex items-start gap-2 text-xs text-gray-600">
                      <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>{session.notes}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 pt-1">Session ID: {session._id}</p>

                  {/* Force-end button for active/stuck sessions */}
                  {session.isActive && (
                    <div className="mt-2 space-y-2">
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                        <p className="text-xs text-amber-800 font-medium mb-2">
                          This session is still active. If it is stuck or you cannot end it normally, use Force End.
                        </p>
                        <button
                          onClick={() => handleForceEnd(session)}
                          disabled={forceEndingId === session._id}
                          className="w-full flex items-center justify-center gap-2 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 font-semibold text-xs py-2 px-3 rounded-lg transition disabled:opacity-50"
                        >
                          {forceEndingId === session._id ? (
                            <>
                              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-amber-700" />
                              Ending session…
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                              </svg>
                              Force End Session
                            </>
                          )}
                        </button>
                        {forceEndError[session._id] && (
                          <p className="text-xs text-red-600 mt-1.5">{forceEndError[session._id]}</p>
                        )}
                        {forceEndSuccess === session._id && (
                          <p className="text-xs text-green-700 mt-1.5">Session ended successfully.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Drill-down CTA */}
                  {onViewSessionBuildings && (
                    <button
                      onClick={() => onViewSessionBuildings(session._id, session.lotCode)}
                      className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-semibold text-sm py-2.5 px-4 rounded-xl transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      View Buildings from This Session
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="h-8" />
    </div>
  );
}
