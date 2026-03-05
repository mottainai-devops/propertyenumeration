import { useState, useEffect } from 'react';

interface SessionManagementProps {
  onStartEnumeration: (lotCode?: string, dailyTarget?: number) => void;
  onLogout: () => void;
  pendingCount: number;
  onViewQueue: () => void;
  onViewStats?: () => void;
  onViewBuildings?: () => void;
  onViewSessionHistory?: () => void;
  onViewProfile?: () => void;
  surveyedCount?: number;
  recentBuildingsCount?: number;
  registeredCount?: number;   // Total buildings registered this session (from recentBuildings)
  onClearSurveyedHistory?: () => void;
  dailyTarget?: number;
  onSetDailyTarget?: (target: number) => void;
}

export default function SessionManagement({
  onStartEnumeration,
  onLogout,
  pendingCount,
  onViewQueue,
  onViewStats,
  onViewBuildings,
  onViewSessionHistory,
  onViewProfile,
  surveyedCount = 0,
  recentBuildingsCount = 0,
  registeredCount = 0,
  onClearSurveyedHistory,
  dailyTarget: _dailyTarget = 50,
  onSetDailyTarget,
}: SessionManagementProps) {
  const [user, setUser] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [targetInput, setTargetInput] = useState('50');

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) setUser(JSON.parse(savedUser));
    const savedSession = localStorage.getItem('activeSession');
    if (savedSession) setActiveSession(JSON.parse(savedSession));
  }, []);

  const handleClearHistory = () => {
    if (onClearSurveyedHistory) onClearSurveyedHistory();
    setShowClearConfirm(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50 p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Property Enumeration</h1>
              <p className="text-sm text-gray-600 mt-1">Welcome back, {user?.fullName || 'User'}</p>
            </div>
            <div className="flex items-center gap-2">
              {onViewProfile && (
                <button
                  onClick={onViewProfile}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                  title="Profile & Settings"
                >
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>
              )}
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition font-medium"
              >
                Logout
              </button>
            </div>
          </div>

          {/* User Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-gray-700">{user?.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="text-gray-700">{user?.role || 'Field Supervisor'}</span>
            </div>
          </div>
        </div>

        {/* Offline Queue Card */}
        {pendingCount > 0 && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h2 className="text-lg font-bold text-yellow-900">Offline Queue</h2>
                </div>
                <p className="text-sm text-yellow-800 mb-4">
                  You have {pendingCount} building{pendingCount > 1 ? 's' : ''} waiting to be synced.
                </p>
                <button
                  onClick={onViewQueue}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  View Queue
                </button>
              </div>
              <div className="ml-4">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-yellow-700">{pendingCount}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Action Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Start Enumeration</h2>
            <p className="text-gray-600">Begin registering buildings in your assigned area</p>
          </div>

          {/* Daily Target Input */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Daily Building Target</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const v = Math.max(1, parseInt(targetInput || '50') - 5);
                  setTargetInput(String(v));
                  if (onSetDailyTarget) onSetDailyTarget(v);
                }}
                className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-gray-700 flex items-center justify-center text-xl"
              >−</button>
              <input
                type="number"
                min="1"
                max="500"
                value={targetInput}
                onChange={e => {
                  setTargetInput(e.target.value);
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v > 0 && onSetDailyTarget) onSetDailyTarget(v);
                }}
                className="flex-1 text-center text-xl font-bold border-2 border-gray-200 rounded-lg py-2 focus:outline-none focus:border-blue-400"
              />
              <button
                onClick={() => {
                  const v = Math.min(500, parseInt(targetInput || '50') + 5);
                  setTargetInput(String(v));
                  if (onSetDailyTarget) onSetDailyTarget(v);
                }}
                className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-gray-700 flex items-center justify-center text-xl"
              >+</button>
            </div>
            {/* Progress ring preview */}
            {(activeSession?.buildingsRegistered || 0) > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke="#10b981" strokeWidth="3"
                      strokeDasharray={`${Math.min(100, Math.round(((activeSession?.buildingsRegistered || 0) / (parseInt(targetInput) || 50)) * 100))} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                    {Math.min(100, Math.round(((activeSession?.buildingsRegistered || 0) / (parseInt(targetInput) || 50)) * 100))}%
                  </span>
                </div>
                <span className="text-sm text-gray-600">
                  {activeSession?.buildingsRegistered || 0} of {parseInt(targetInput) || 50} buildings today
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => onStartEnumeration(undefined, parseInt(targetInput) || 50)}
            className="w-full bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-bold py-4 px-6 rounded-lg transition text-lg shadow-lg"
          >
            Start Enumeration Session
          </button>
        </div>

        {/* Active Session Card */}
        {activeSession && (
          <div className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <h2 className="text-lg font-bold text-green-900">Active Session</h2>
                </div>
                <p className="text-sm text-green-800 mb-4">
                  Lot: {activeSession.lotCode} • {activeSession.buildingsRegistered || 0} building{activeSession.buildingsRegistered !== 1 ? 's' : ''} registered
                </p>
                <div className="flex flex-wrap gap-2">
                  {onViewStats && (
                    <button
                      onClick={onViewStats}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Statistics
                    </button>
                  )}
                  {onViewBuildings && (
                    <button
                      onClick={onViewBuildings}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition font-medium flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Buildings ({recentBuildingsCount})
                    </button>
                  )}
                  {onViewSessionHistory && (
                    <button
                      onClick={onViewSessionHistory}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-medium flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Session History
                    </button>
                  )}
                </div>
              </div>
              <div className="ml-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-green-700">{activeSession.buildingsRegistered || 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* Registered card — tappable to open buildings list */}
          <button
            onClick={onViewBuildings}
            className="bg-white rounded-xl shadow p-4 text-left hover:bg-blue-50 active:bg-blue-100 transition"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <p className="text-xs text-gray-500">Registered</p>
              <p className="text-xl font-bold text-blue-700">{registeredCount}</p>
              <p className="text-xs text-blue-500 mt-0.5">tap to view</p>
            </div>
          </button>

          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs text-gray-500">Surveyed</p>
              <p className="text-xl font-bold text-green-700">{surveyedCount}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-xs text-gray-500">Pending Sync</p>
              <p className="text-xl font-bold text-gray-900">{pendingCount}</p>
            </div>
          </div>
        </div>

        {/* Surveyed History Management */}
        {surveyedCount > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-green-900">{surveyedCount} building{surveyedCount !== 1 ? 's' : ''} marked as surveyed</p>
                  <p className="text-xs text-green-700">Grey polygons on map indicate completed buildings</p>
                </div>
              </div>
              {!showClearConfirm ? (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="ml-3 px-3 py-1.5 text-xs bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-100 transition font-medium shrink-0"
                >
                  Clear History
                </button>
              ) : (
                <div className="flex gap-2 ml-3 shrink-0">
                  <button
                    onClick={handleClearHistory}
                    className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* View All Buildings — always visible shortcut */}
        {onViewBuildings && (
          <button
            onClick={onViewBuildings}
            className="w-full mb-4 flex items-center justify-between bg-white border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 active:bg-blue-100 rounded-xl p-4 transition shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">View All Registered Buildings</p>
                <p className="text-xs text-gray-500">{registeredCount} building{registeredCount !== 1 ? 's' : ''} registered · tap to browse &amp; review</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Help Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-900 mb-1">Need Help?</p>
              <p className="text-xs text-blue-700">
                Tap "Start Enumeration Session" to begin registering buildings. The app works offline and will sync when you're back online.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
