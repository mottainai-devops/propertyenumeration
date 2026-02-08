import { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Network } from '@capacitor/network';
import { sessionApi, type Session, type LoginResponse } from '../api/client';

interface SessionManagementProps {
  onLogout: () => void;
}

interface SessionManagementScreenProps extends SessionManagementProps {
  onNavigateToLocationPicker: () => void;
  onNavigateToStatistics: () => void;
}

export default function SessionManagement({ onLogout, onNavigateToLocationPicker, onNavigateToStatistics }: SessionManagementScreenProps) {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [startSessionError, setStartSessionError] = useState<string | null>(null);
  const [endSessionError, setEndSessionError] = useState<string | null>(null);
  const [selectedLotCode, setSelectedLotCode] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [showEndConfirmDialog, setShowEndConfirmDialog] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [operationalLots, setOperationalLots] = useState<Array<{ lotCode: string; lotName: string }>>([]);

  // Load user data and check for active session on mount
  useEffect(() => {
    loadUserData();
    checkActiveSession();
    checkNetworkStatus();

    // Listen for network changes
    const networkListener = Network.addListener('networkStatusChange', (status) => {
      setIsOnline(status.connected);
    });

    return () => {
      networkListener.then(listener => listener.remove());
    };
  }, []);

  const loadUserData = () => {
    const userData = localStorage.getItem('user_data');
    if (userData) {
      const parsedData: LoginResponse = JSON.parse(userData);
      setOperationalLots(parsedData.company.operationalLots);
      if (parsedData.company.operationalLots.length > 0) {
        setSelectedLotCode(parsedData.company.operationalLots[0].lotCode);
      }
    }
  };

  const checkActiveSession = () => {
    const sessionData = localStorage.getItem('activeSession');
    if (sessionData) {
      const session: Session = JSON.parse(sessionData);
      setActiveSession(session);
    }
  };

  const checkNetworkStatus = async () => {
    const status = await Network.getStatus();
    setIsOnline(status.connected);
  };

  const handleStartSession = async () => {
    if (!isOnline) {
      setStartSessionError('Cannot start session while offline. Please check your internet connection.');
      return;
    }

    setIsStartingSession(true);
    setStartSessionError(null);

    try {
      // Capture GPS location
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      // Call API
      const session = await sessionApi.start({
        lotCode: selectedLotCode,
        startLocation: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        notes: sessionNotes || undefined,
      });

      // Store active session in localStorage (read-only for UI components)
      localStorage.setItem('activeSession', JSON.stringify(session));
      setActiveSession(session);

      // Clear form
      setSessionNotes('');

      // Navigate to Location Picker
      onNavigateToLocationPicker();
    } catch (error: any) {
      if (error.message?.includes('location')) {
        setStartSessionError('Cannot start session without GPS location. Please enable location services.');
      } else if (error.response?.status === 409) {
        setStartSessionError('You already have an active session. Please end it before starting a new one.');
      } else if (error.response?.status === 400) {
        setStartSessionError(error.response?.data?.message || 'Invalid session data. Please try again.');
      } else {
        setStartSessionError('Failed to start session. Please try again.');
      }
      console.error('Start session error:', error);
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) {
      setEndSessionError('No active session to end.');
      return;
    }

    setIsEndingSession(true);
    setEndSessionError(null);

    try {
      // Capture GPS location
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      // Call API
      await sessionApi.end(activeSession._id, {
        endLocation: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
      });

      // Remove active session from localStorage
      localStorage.removeItem('activeSession');
      setActiveSession(null);
      setShowEndConfirmDialog(false);

      // Navigate to Session Statistics
      onNavigateToStatistics();
    } catch (error: any) {
      if (!isOnline) {
        // Queue for offline sync
        // TODO: Implement offline queue for session end
        localStorage.removeItem('activeSession');
        setActiveSession(null);
        setShowEndConfirmDialog(false);
        onNavigateToStatistics();
      } else if (error.message?.includes('location')) {
        setEndSessionError('Cannot end session without GPS location. Please enable location services.');
      } else if (error.response?.status === 404) {
        setEndSessionError('Session not found. It may have been deleted.');
        localStorage.removeItem('activeSession');
        setActiveSession(null);
      } else if (error.response?.status === 409) {
        setEndSessionError('This session has already been ended.');
        localStorage.removeItem('activeSession');
        setActiveSession(null);
      } else {
        setEndSessionError('Failed to end session. Please try again.');
      }
      console.error('End session error:', error);
    } finally {
      setIsEndingSession(false);
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-teal-600 text-white p-4 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Session Management</h1>
            <p className="text-sm opacity-90">Property Enumeration</p>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white px-4 py-3 text-center">
          <p className="font-medium">⚠️ You are offline. Session management requires internet connection.</p>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Active Session Card */}
        {activeSession ? (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-600 font-semibold text-lg">Active Session</span>
            </div>

            {/* Session Info */}
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Session ID</p>
                <p className="font-mono text-sm font-medium">{activeSession.sessionId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Lot Code</p>
                <p className="font-semibold text-lg">{activeSession.lotCode}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Start Time</p>
                <p className="font-medium">{formatDateTime(activeSession.startTime)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Start Location</p>
                <p className="font-mono text-sm">
                  {activeSession.startLocation.latitude.toFixed(6)}, {activeSession.startLocation.longitude.toFixed(6)}
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Buildings Enumerated</p>
                <p className="text-3xl font-bold text-blue-600">{activeSession.buildingsEnumerated}</p>
              </div>
              {activeSession.notes && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-sm">{activeSession.notes}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-4">
              <button
                onClick={onNavigateToLocationPicker}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all transform hover:scale-105"
              >
                📍 Register Building
              </button>
              <button
                onClick={() => setShowEndConfirmDialog(true)}
                className="w-full py-3 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all transform hover:scale-105"
              >
                ⏹️ End Session
              </button>
              <button
                onClick={onNavigateToStatistics}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all transform hover:scale-105"
              >
                📊 View Statistics
              </button>
            </div>

            {/* Error Display */}
            {endSessionError && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg animate-shake">
                <p className="text-red-700 text-sm font-medium">{endSessionError}</p>
              </div>
            )}
          </div>
        ) : (
          /* No Active Session Card */
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <div className="text-center py-4">
              <p className="text-gray-500 text-lg font-medium">No Active Session</p>
              <p className="text-sm text-gray-400 mt-1">Start a new enumeration session to begin</p>
            </div>

            {/* Start Session Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lot Code *</label>
                <select
                  value={selectedLotCode}
                  onChange={(e) => setSelectedLotCode(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isStartingSession || !isOnline}
                >
                  {operationalLots.map((lot) => (
                    <option key={lot.lotCode} value={lot.lotCode}>
                      {lot.lotCode} - {lot.lotName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Add any notes about this session..."
                  maxLength={500}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled={isStartingSession || !isOnline}
                />
                <p className="text-xs text-gray-400 mt-1">{sessionNotes.length}/500 characters</p>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  📍 Your current GPS location will be captured when you start the session
                </p>
              </div>

              {/* Action Buttons */}
              <button
                onClick={handleStartSession}
                disabled={isStartingSession || !isOnline || !selectedLotCode}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isStartingSession ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Starting Session...
                  </span>
                ) : (
                  '🚀 Start Session'
                )}
              </button>

              <button
                onClick={onNavigateToStatistics}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all transform hover:scale-105"
              >
                📊 View History
              </button>
            </div>

            {/* Error Display */}
            {startSessionError && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg animate-shake">
                <p className="text-red-700 text-sm font-medium">{startSessionError}</p>
              </div>
            )}
          </div>
        )}

        {/* ArcGIS Sync Status Banner */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl shadow-md p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">☁️</div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800 mb-1">ArcGIS Sync Status</h3>
              <p className="text-sm text-gray-600">
                Buildings are automatically synced to ArcGIS every 15 minutes by the backend system.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                ℹ️ No manual action needed - sync happens automatically
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* End Session Confirmation Dialog */}
      {showEndConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-2">End Session?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to end this enumeration session? Your current GPS location will be captured.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirmDialog(false)}
                disabled={isEndingSession}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEndSession}
                disabled={isEndingSession}
                className="flex-1 py-3 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50"
              >
                {isEndingSession ? 'Ending...' : 'End Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
