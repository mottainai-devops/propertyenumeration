import { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import { sessionApi, type Session, type SessionStatistics as SessionStats } from '../api/client';

interface SessionStatisticsProps {
  onBack: () => void;
}

export default function SessionStatistics({ onBack }: SessionStatisticsProps) {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [statistics, setStatistics] = useState<SessionStats | null>(null);
  const [sessionHistory, setSessionHistory] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isLoadingStatistics, setIsLoadingStatistics] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [statisticsError, setStatisticsError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showSessionDetailsModal, setShowSessionDetailsModal] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    checkNetworkStatus();
    loadStatistics();

    const networkListener = Network.addListener('networkStatusChange', (status) => {
      setIsOnline(status.connected);
      if (status.connected) {
        loadStatistics();
      }
    });

    return () => {
      networkListener.then(listener => listener.remove());
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, currentPage]);

  const checkNetworkStatus = async () => {
    const status = await Network.getStatus();
    setIsOnline(status.connected);
  };

  const loadStatistics = async () => {
    setIsLoadingStatistics(true);
    setStatisticsError(null);

    try {
      // Try to load from cache first
      const cached = await getCachedStatistics();
      if (cached) {
        setStatistics(cached);
      }

      if (isOnline) {
        // Fetch fresh data
        const stats = await sessionApi.getStatistics();
        setStatistics(stats);
        await cacheStatistics(stats);
      }
    } catch (error: any) {
      console.error('Load statistics error:', error);
      setStatisticsError('Failed to load statistics');
      
      // Try to show cached data on error
      const cached = await getCachedStatistics();
      if (cached) {
        setStatistics(cached);
      }
    } finally {
      setIsLoadingStatistics(false);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      // Try to load from cache first
      const cached = await getCachedHistory();
      if (cached) {
        setSessionHistory(cached);
      }

      if (isOnline) {
        // Fetch fresh data
        const response = await sessionApi.list({
          page: currentPage,
          limit: 20,
          status: 'completed',
        });
        setSessionHistory(response.sessions);
        setTotalPages(response.pagination.pages);
        await cacheHistory(response.sessions);
      }
    } catch (error: any) {
      console.error('Load history error:', error);
      setHistoryError('Failed to load session history');
      
      // Try to show cached data on error
      const cached = await getCachedHistory();
      if (cached) {
        setSessionHistory(cached);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadSessionDetails = async (sessionId: string) => {
    try {
      const session = await sessionApi.getById(sessionId);
      setSelectedSession(session);
      setShowSessionDetailsModal(true);
    } catch (error: any) {
      console.error('Load session details error:', error);
      alert('Failed to load session details');
    }
  };

  const getCachedStatistics = async (): Promise<SessionStats | null> => {
    const { value } = await Preferences.get({ key: 'sessionStatistics' });
    const { value: cacheTime } = await Preferences.get({ key: 'statisticsCacheTime' });
    
    if (value && cacheTime) {
      const age = Date.now() - parseInt(cacheTime);
      const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
      
      if (age < CACHE_DURATION) {
        return JSON.parse(value);
      }
    }
    
    return null;
  };

  const cacheStatistics = async (stats: SessionStats) => {
    await Preferences.set({
      key: 'sessionStatistics',
      value: JSON.stringify(stats),
    });
    await Preferences.set({
      key: 'statisticsCacheTime',
      value: Date.now().toString(),
    });
  };

  const getCachedHistory = async (): Promise<Session[]> => {
    const { value } = await Preferences.get({ key: 'sessionHistory' });
    return value ? JSON.parse(value) : [];
  };

  const cacheHistory = async (sessions: Session[]) => {
    await Preferences.set({
      key: 'sessionHistory',
      value: JSON.stringify(sessions),
    });
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDuration = (milliseconds: number) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-teal-600 text-white p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-bold">Session Statistics</h1>
            <p className="text-sm opacity-90">Performance & History</p>
          </div>
        </div>
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white px-4 py-3 text-center">
          <p className="font-medium">⚠️ Offline - Showing cached data</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="flex">
          <button
            onClick={() => setActiveTab('current')}
            className={`flex-1 py-4 font-semibold transition-colors ${
              activeTab === 'current'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 Current Session
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-4 font-semibold transition-colors ${
              activeTab === 'history'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📜 History
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Current Session Tab */}
        {activeTab === 'current' && (
          <div className="space-y-4">
            {isLoadingStatistics && !statistics ? (
              <div className="text-center py-12">
                <svg className="animate-spin h-12 w-12 mx-auto text-blue-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-gray-500 mt-4">Loading statistics...</p>
              </div>
            ) : statisticsError && !statistics ? (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                <p className="text-red-700 font-medium">{statisticsError}</p>
              </div>
            ) : statistics ? (
              <>
                {/* Performance Metrics Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl shadow-lg p-6">
                    <p className="text-sm opacity-90 mb-2">Total Sessions</p>
                    <p className="text-4xl font-bold">{statistics.totalSessions}</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl shadow-lg p-6">
                    <p className="text-sm opacity-90 mb-2">Total Buildings</p>
                    <p className="text-4xl font-bold">{statistics.totalBuildingsEnumerated}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl shadow-lg p-6">
                    <p className="text-sm opacity-90 mb-2">Avg per Session</p>
                    <p className="text-4xl font-bold">{statistics.averageBuildingsPerSession.toFixed(1)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl shadow-lg p-6">
                    <p className="text-sm opacity-90 mb-2">Avg Duration</p>
                    <p className="text-2xl font-bold">{formatDuration(statistics.averageSessionDuration)}</p>
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h3 className="font-bold text-lg mb-4">Session Status</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Active</span>
                      <span className="font-bold text-green-600">{statistics.activeSessions}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Completed</span>
                      <span className="font-bold text-blue-600">{statistics.completedSessions}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Cancelled</span>
                      <span className="font-bold text-red-600">{statistics.cancelledSessions}</span>
                    </div>
                  </div>
                </div>

                {/* By Lot Code */}
                {Object.keys(statistics.byLotCode).length > 0 && (
                  <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h3 className="font-bold text-lg mb-4">By Lot Code</h3>
                    <div className="space-y-3">
                      {Object.entries(statistics.byLotCode).map(([lotCode, data]) => (
                        <div key={lotCode} className="flex justify-between items-center">
                          <span className="font-medium">{lotCode}</span>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">{data.sessions} sessions</p>
                            <p className="font-bold text-blue-600">{data.buildings} buildings</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Sessions */}
                {statistics.recentSessions && statistics.recentSessions.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h3 className="font-bold text-lg mb-4">Recent Sessions</h3>
                    <div className="space-y-3">
                      {statistics.recentSessions.map((session) => (
                        <div key={session.sessionId} className="border-l-4 border-blue-500 pl-4 py-2">
                          <p className="font-mono text-sm font-medium">{session.sessionId}</p>
                          <p className="text-sm text-gray-600">{session.lotCode} • {session.buildingsEnumerated} buildings</p>
                          <p className="text-xs text-gray-500">{formatDateTime(session.startTime)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No statistics available</p>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {isLoadingHistory && sessionHistory.length === 0 ? (
              <div className="text-center py-12">
                <svg className="animate-spin h-12 w-12 mx-auto text-blue-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-gray-500 mt-4">Loading history...</p>
              </div>
            ) : historyError && sessionHistory.length === 0 ? (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                <p className="text-red-700 font-medium">{historyError}</p>
              </div>
            ) : sessionHistory.length > 0 ? (
              <>
                {sessionHistory.map((session) => (
                  <div
                    key={session._id}
                    onClick={() => loadSessionDetails(session._id)}
                    className="bg-white rounded-2xl shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-mono text-sm font-medium">{session.sessionId}</p>
                        <p className="text-lg font-bold text-blue-600">{session.lotCode}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        session.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {session.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Date</p>
                        <p className="font-medium">{formatDateTime(session.startTime)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Duration</p>
                        <p className="font-medium">{session.duration ? formatDuration(session.duration) : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Buildings</p>
                        <p className="font-bold text-blue-600 text-lg">{session.buildingsEnumerated}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 pt-4">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-white rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Previous
                    </button>
                    <span className="px-4 py-2 bg-white rounded-lg shadow-md font-medium">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-white rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No session history available</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Session Details Modal */}
      {showSessionDetailsModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full my-8">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold">Session Details</h3>
              <button
                onClick={() => setShowSessionDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Session ID</p>
                <p className="font-mono text-sm font-medium">{selectedSession.sessionId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Lot Code</p>
                <p className="font-bold text-lg">{selectedSession.lotCode}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  selectedSession.status === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : selectedSession.status === 'active'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {selectedSession.status}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Start Time</p>
                <p className="font-medium">{formatDateTime(selectedSession.startTime)}</p>
              </div>
              {selectedSession.endTime && (
                <div>
                  <p className="text-sm text-gray-500">End Time</p>
                  <p className="font-medium">{formatDateTime(selectedSession.endTime)}</p>
                </div>
              )}
              {selectedSession.duration && (
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="font-medium">{formatDuration(selectedSession.duration)}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Buildings Enumerated</p>
                <p className="text-3xl font-bold text-blue-600">{selectedSession.buildingsEnumerated}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Start Location</p>
                <p className="font-mono text-sm">
                  {selectedSession.startLocation.latitude.toFixed(6)}, {selectedSession.startLocation.longitude.toFixed(6)}
                </p>
              </div>
              {selectedSession.endLocation && (
                <div>
                  <p className="text-sm text-gray-500">End Location</p>
                  <p className="font-mono text-sm">
                    {selectedSession.endLocation.latitude.toFixed(6)}, {selectedSession.endLocation.longitude.toFixed(6)}
                  </p>
                </div>
              )}
              {selectedSession.notes && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-sm">{selectedSession.notes}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowSessionDetailsModal(false)}
              className="w-full mt-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
