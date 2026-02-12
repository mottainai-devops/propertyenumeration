import { useState, useEffect } from 'react';

interface SessionData {
  sessionId: string;
  lotCode: string;
  startTime: string;
  buildingsRegistered: number;
  isActive: boolean;
}

interface SessionStatisticsProps {
  onClose: () => void;
}

export default function SessionStatistics({ onClose }: SessionStatisticsProps) {
  const [activeSession, setActiveSession] = useState<SessionData | null>(null);
  const [sessionDuration, setSessionDuration] = useState('00:00:00');
  const [recentBuildings, setRecentBuildings] = useState<any[]>([]);

  useEffect(() => {
    // Load active session from localStorage
    const savedSession = localStorage.getItem('activeSession');
    if (savedSession) {
      setActiveSession(JSON.parse(savedSession));
    }

    // Load recent buildings from localStorage
    const savedBuildings = localStorage.getItem('recentBuildings');
    if (savedBuildings) {
      setRecentBuildings(JSON.parse(savedBuildings));
    }
  }, []);

  useEffect(() => {
    if (!activeSession) return;

    // Update duration every second
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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
          </div>
        </div>

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

                {/* Duration Display */}
                <div className="text-center mb-6">
                  <p className="text-sm text-gray-600 mb-2">Session Duration</p>
                  <p className="text-4xl font-bold text-gray-900 font-mono">{sessionDuration}</p>
                </div>

                {/* Stats Grid */}
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

                {/* Session Info */}
                <div className="mt-4 pt-4 border-t border-green-200">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Started: {formatDate(activeSession.startTime)}</span>
                  </div>
                </div>
              </div>

              {/* Recent Buildings */}
              {recentBuildings.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Recent Buildings</h3>
                  <div className="space-y-3">
                    {recentBuildings.slice(0, 5).map((building, index) => (
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
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                {building.propertyType}
                              </span>
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                {building.numberOfUnits} unit{building.numberOfUnits > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                              ✓ Registered
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
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
                              60000 /
                              activeSession.buildingsRegistered
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
