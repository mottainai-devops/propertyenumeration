import { useState, useEffect } from 'react';
import { sessionApi, type Session, type SessionStatistics } from '../api/client';
import SimpleLocationPicker from './SimpleLocationPicker';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface SessionManagementProps {
  onStartEnumeration: () => void;
  onLogout: () => void;
}

export default function SessionManagement({ onStartEnumeration, onLogout }: SessionManagementProps) {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [statistics, setStatistics] = useState<SessionStatistics | null>(null);
  const [sessionHistory, setSessionHistory] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Start session states
  const [showStartSession, setShowStartSession] = useState(false);
  const [lotCode, setLotCode] = useState('');
  const [startLocation, setStartLocation] = useState<LocationData | null>(null);
  const [startNotes, setStartNotes] = useState('');
  const [starting, setStarting] = useState(false);
  
  // End session states
  const [showEndSession, setShowEndSession] = useState(false);
  const [endLocation, setEndLocation] = useState<LocationData | null>(null);
  const [endNotes, setEndNotes] = useState('');
  const [ending, setEnding] = useState(false);

  // Load session data
  useEffect(() => {
    loadSessionData();
  }, []);

  const loadSessionData = async () => {
    try {
      setLoading(true);
      const [stats, sessions] = await Promise.all([
        sessionApi.getStatistics(),
        sessionApi.list(),
      ]);
      
      setStatistics(stats);
      
      // Debug logging
      console.log('[SessionManagement] Loaded sessions:', sessions);
      console.log('[SessionManagement] Statistics:', stats);
      
      // Find active session from the list
      const active = sessions.find(s => s.isActive === true);
      console.log('[SessionManagement] Active session found:', active);
      setActiveSession(active || null);
      
      // Get completed sessions for history
      setSessionHistory(sessions.filter(s => s.isActive === false));
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load session data');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async () => {
    if (!lotCode.trim()) {
      setError('Please enter a lot code');
      return;
    }
    
    if (!startLocation) {
      setError('Please capture GPS location');
      return;
    }

    try {
      setStarting(true);
      setError('');
      
      const session = await sessionApi.start({
        lotCode: lotCode.trim(),
        startLocation,
        notes: startNotes.trim() || undefined,
      });
      
      setActiveSession(session);
      setShowStartSession(false);
      setLotCode('');
      setStartLocation(null);
      setStartNotes('');
      
      // Reload statistics
      await loadSessionData();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to start session';
      
      // Check if it's an "already has active session" error
      if (err.response?.status === 400 && err.response?.data?.details?.sessionId) {
        setError(`You already have an active session for ${err.response.data.details.lotCode}. Please end it first before starting a new one.`);
        // Reload data to show the active session
        await loadSessionData();
      } else {
        setError(errorMsg);
      }
    } finally {
      setStarting(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    
    if (!endLocation) {
      setError('Please capture GPS location');
      return;
    }

    try {
      setEnding(true);
      setError('');
      
      await sessionApi.end(activeSession._id, {
        endLocation,
        notes: endNotes.trim() || undefined,
      });
      
      setActiveSession(null);
      setShowEndSession(false);
      setEndLocation(null);
      setEndNotes('');
      
      // Reload data
      await loadSessionData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to end session');
    } finally {
      setEnding(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading session data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50">
      {/* Header */}
      <div className="bg-white shadow-md sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Session Management</h1>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-blue-600">
              <p className="text-sm text-gray-500 font-medium">Total Sessions</p>
              <p className="text-3xl font-bold text-gray-900">{statistics.totalSessions}</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-green-600">
              <p className="text-sm text-gray-500 font-medium">Active</p>
              <p className="text-3xl font-bold text-green-600">{statistics.activeSessions}</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-purple-600">
              <p className="text-sm text-gray-500 font-medium">Completed</p>
              <p className="text-3xl font-bold text-gray-900">{statistics.completedSessions}</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-orange-600">
              <p className="text-sm text-gray-500 font-medium">Buildings</p>
              <p className="text-3xl font-bold text-gray-900">{statistics.totalBuildingsEnumerated}</p>
            </div>
          </div>
        )}

        {/* Active Session */}
        {activeSession && !showEndSession && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl shadow-xl p-6 border-2 border-green-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Active Session</h2>
                <p className="text-sm text-gray-600">Session ID: {activeSession._id.slice(-8)}</p>
              </div>
              <span className="px-4 py-2 bg-green-600 text-white rounded-full font-semibold text-sm">
                Active
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-500 font-medium">Lot Code</p>
                <p className="text-lg font-bold text-gray-900">{activeSession.lotCode}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Buildings Enumerated</p>
                <p className="text-lg font-bold text-green-600">{activeSession.buildingsEnumerated}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Started</p>
                <p className="text-sm text-gray-700">{formatDate(activeSession.startTime)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Duration</p>
                <p className="text-sm text-gray-700">{formatDuration(activeSession.startTime)}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onStartEnumeration}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-teal-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition"
              >
                📍 Start Enumerating
              </button>
              <button
                onClick={() => setShowEndSession(true)}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition"
              >
                ⏹ End Session
              </button>
            </div>
          </div>
        )}

        {/* No Active Session */}
        {!activeSession && !showStartSession && (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Active Session</h3>
            <p className="text-gray-600 mb-6">Start a new enumeration session to begin registering buildings</p>
            <button
              onClick={() => setShowStartSession(true)}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-teal-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition"
            >
              🚀 Start New Session
            </button>
          </div>
        )}

        {/* Start Session Form */}
        {showStartSession && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Start New Session</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lot Code *
                </label>
                <input
                  type="text"
                  value={lotCode}
                  onChange={(e) => setLotCode(e.target.value)}
                  placeholder="e.g., TEST01"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Location *
                </label>
                <SimpleLocationPicker onLocationSelect={setStartLocation} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={startNotes}
                  onChange={(e) => setStartNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleStartSession}
                  disabled={starting || !lotCode.trim() || !startLocation}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {starting ? '⏳ Starting...' : '✓ Start Session'}
                </button>
                <button
                  onClick={() => {
                    setShowStartSession(false);
                    setLotCode('');
                    setStartLocation(null);
                    setStartNotes('');
                  }}
                  disabled={starting}
                  className="px-6 py-3 bg-gray-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* End Session Form */}
        {showEndSession && activeSession && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">End Session</h2>
            
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
              <p className="text-yellow-800 font-medium">
                ⚠️ You are about to end the current session. This action cannot be undone.
              </p>
              <p className="text-yellow-700 text-sm mt-2">
                Buildings enumerated: <span className="font-bold">{activeSession.buildingsEnumerated}</span>
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Location *
                </label>
                <SimpleLocationPicker onLocationSelect={setEndLocation} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={endNotes}
                  onChange={(e) => setEndNotes(e.target.value)}
                  placeholder="Session summary or notes..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleEndSession}
                  disabled={ending || !endLocation}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {ending ? '⏳ Ending...' : '⏹ End Session'}
                </button>
                <button
                  onClick={() => {
                    setShowEndSession(false);
                    setEndLocation(null);
                    setEndNotes('');
                  }}
                  disabled={ending}
                  className="px-6 py-3 bg-gray-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Session History */}
        {sessionHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Session History</h2>
            
            <div className="space-y-4">
              {sessionHistory.map((session) => (
                <div
                  key={session._id}
                  className="border-2 border-gray-200 rounded-xl p-4 hover:border-blue-300 transition"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{session.lotCode}</p>
                      <p className="text-sm text-gray-500">ID: {session._id.slice(-8)}</p>
                    </div>
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full font-semibold text-sm">
                      Completed
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Buildings</p>
                      <p className="font-bold text-gray-900">{session.buildingsEnumerated}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Duration</p>
                      <p className="font-bold text-gray-900">{formatDuration(session.startTime, session.endTime)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-500">Started</p>
                      <p className="text-gray-700">{formatDate(session.startTime)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
