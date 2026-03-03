import { useState, useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import Login from './components/Login';
import SessionManagement from './components/SessionManagement';
import SessionBanner from './components/SessionBanner';
import LocationPickerWithMap from './components/LocationPickerWithMap';
import BuildingForm from './components/BuildingForm';
import OfflineQueue from './components/OfflineQueue';
import SessionStatistics from './components/SessionStatistics';
import BuildingsList from './components/BuildingsList';
import SessionHistory from './components/SessionHistory';
import ProfileSettings from './components/ProfileSettings';
import CustomerImport from './components/CustomerImport';
import ErrorBoundary from './components/ErrorBoundary';
import { useToast } from './components/Toast';
import { authApi, buildingApi, customerApi, sessionApi, type Session, type SessionConflictError } from './api/client';
import { getOperationErrorMessage, logError, retryOperation } from './utils/errorHandler';

type AppScreen = 'login' | 'session' | 'location' | 'building' | 'success' | 'offline-queue' | 'statistics' | 'buildings-list' | 'session-history' | 'profile-settings' | 'session-buildings' | 'customer-import';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface SessionSummary {
  lotCode: string;
  duration: string;
  buildingsCount: number;
  photosCount: number;
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('login');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [selectedBuildingData, setSelectedBuildingData] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingBuildings, setPendingBuildings] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [recentBuildings, setRecentBuildings] = useState<any[]>([]);
  const [activeServerSession, setActiveServerSession] = useState<Session | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [surveyedBuildingIds, setSurveyedBuildingIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('surveyedBuildingIds');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [dailyTarget, setDailyTarget] = useState<number>(() => {
    const saved = localStorage.getItem('dailyTarget');
    return saved ? parseInt(saved) : 50;
  });
  const [sessionDrillDown, setSessionDrillDown] = useState<{ sessionId: string; lotCode: string } | null>(null);
  const sessionStartTimeRef = useRef<Date | null>(null);
  const { showToast, ToastContainer } = useToast();

  // Request notification permission on mount (Android 13+)
  useEffect(() => {
    LocalNotifications.requestPermissions().catch(() => {
      // Silently ignore if notifications are not supported (e.g., web browser)
    });
  }, []);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingBuildings();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load pending buildings and recent buildings from localStorage.
  // One-time migration (v1.53+): deduplicate recentBuildings that were stored with
  // synced:false by pre-v1.53 builds (those builds added offline buildings to both
  // pendingBuildings AND recentBuildings, causing duplicate entries in the list).
  useEffect(() => {
    const pending = localStorage.getItem('pendingBuildings');
    if (pending) setPendingBuildings(JSON.parse(pending));

    const recent = localStorage.getItem('recentBuildings');
    if (recent) {
      const parsed: any[] = JSON.parse(recent);
      const migrationKey = 'recentBuildings_deduped_v153';
      if (!localStorage.getItem(migrationKey)) {
        // Remove any entries that have synced:false — those are now tracked in pendingBuildings only.
        // Also deduplicate by _id and by address+lotCode fingerprint.
        const seen = new Set<string>();
        const deduped = parsed.filter((b: any) => {
          if (b.synced === false) return false; // was double-stored pre-v1.53
          const key = b._id || (b.address && b.lotCode ? `${b.address.trim().toLowerCase()}|${b.lotCode}` : null);
          if (key) {
            if (seen.has(key)) return false;
            seen.add(key);
          }
          return true;
        });
        setRecentBuildings(deduped);
        try { localStorage.setItem('recentBuildings', JSON.stringify(deduped)); } catch {}
        localStorage.setItem(migrationKey, '1');
      } else {
        setRecentBuildings(parsed);
      }
    }
  }, []);

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setCurrentScreen('session');
    }
  }, []);

  // Handle hardware back button
  useEffect(() => {
    let backButtonHandler: any;
    const setupBackButton = async () => {
      backButtonHandler = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (currentScreen === 'building' || currentScreen === 'location') {
          setCurrentScreen('session');
        } else if (currentScreen === 'buildings-list' || currentScreen === 'statistics' || currentScreen === 'offline-queue' || currentScreen === 'session-history' || currentScreen === 'profile-settings') {
          setCurrentScreen('session');
        } else if (currentScreen === 'session-buildings') {
          setCurrentScreen('session-history');
        } else if (currentScreen === 'customer-import') {
          setCurrentScreen('profile-settings');
        } else if (currentScreen === 'success') {
          setCurrentScreen('location');
        } else if (currentScreen === 'session') {
          CapacitorApp.minimizeApp();
        } else if (canGoBack) {
          window.history.back();
        } else {
          CapacitorApp.minimizeApp();
        }
      });
    };
    setupBackButton();
    return () => {
      if (backButtonHandler) backButtonHandler.remove();
    };
  }, [currentScreen]);

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await retryOperation(
        () => authApi.login({ email, password }),
        {
          maxRetries: 2,
          onRetry: (attempt) => {
            showToast(`Connection failed. Retrying (${attempt}/2)...`, 'warning');
          },
        }
      );
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      localStorage.setItem('assignedLots', JSON.stringify(response.user.assignedLots || []));
      showToast('Login successful!', 'success');
      setCurrentScreen('session');
    } catch (error: any) {
      logError('Login', error, { email });
      const errorMessage = getOperationErrorMessage('login', error);
      showToast(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setActiveServerSession(null);
    setCurrentScreen('login');
  };

  const handleStartEnumeration = async (lotCode?: string, target?: number) => {
    if (target && target !== dailyTarget) {
      setDailyTarget(target);
      localStorage.setItem('dailyTarget', String(target));
    }
    // Try to start a server-side session
    if (isOnline) {
      try {
        const gps = await getCurrentGPS();
        const result = await sessionApi.start({
          lotCode: lotCode || getDefaultLotCode(),
          startLocation: gps,
        });

        // FIX #2: Handle 409 conflict — resume existing session automatically
        if ((result as SessionConflictError).isConflict) {
          const conflict = result as SessionConflictError;
          const existingSession: Session = {
            _id: conflict.existingSessionId,
            lotCode: conflict.existingLotCode,
            startTime: conflict.existingStartTime,
            buildingsEnumerated: 0,
            customersLinked: 0,
            photosUploaded: 0,
            areasCovered: [],
            isActive: true,
            startLocation: gps,
          };
          setActiveServerSession(existingSession);
          localStorage.setItem('serverSessionId', conflict.existingSessionId);
          sessionStartTimeRef.current = new Date(conflict.existingStartTime);
          showToast('Resuming your existing active session', 'info');
        } else {
          const session = result as Session;
          setActiveServerSession(session);
          localStorage.setItem('serverSessionId', session._id);
          sessionStartTimeRef.current = new Date(session.startTime);
          showToast('Session started!', 'success');
        }
      } catch (error) {
        logError('Session Start', error, {});
        // Continue offline — session will be local only
        sessionStartTimeRef.current = new Date();
        showToast('Started offline — session will sync later', 'info');
      }
    } else {
      sessionStartTimeRef.current = new Date();
    }
    setCurrentScreen('location');
  };

  const handleEndSession = async () => {
    const sessionId = localStorage.getItem('serverSessionId') || activeServerSession?._id;
    let summary: SessionSummary | null = null;

    if (isOnline && sessionId) {
      try {
        const gps = await getCurrentGPS();
        const ended = await sessionApi.end(sessionId, { endLocation: gps });
        const startTime = new Date(ended.startTime);
        const endTime = ended.endTime ? new Date(ended.endTime) : new Date();
        const diffMs = endTime.getTime() - startTime.getTime();
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        summary = {
          lotCode: ended.lotCode,
          duration: `${hrs}h ${mins}m`,
          buildingsCount: ended.buildingsEnumerated,
          photosCount: ended.photosUploaded,
        };
        setActiveServerSession(null);
        localStorage.removeItem('serverSessionId');
      } catch (error) {
        logError('Session End', error, {});
      }
    }

    // Build local summary if server call failed
    if (!summary) {
      const startTime = sessionStartTimeRef.current || new Date();
      const diffMs = Date.now() - startTime.getTime();
      const hrs = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      const savedSession = localStorage.getItem('activeSession');
      const localSession = savedSession ? JSON.parse(savedSession) : null;
      summary = {
        lotCode: localSession?.lotCode || getDefaultLotCode(),
        duration: `${hrs}h ${mins}m`,
        buildingsCount: recentBuildings.length,
        photosCount: recentBuildings.reduce((sum, b) => {
          return sum + (Array.isArray(b.photos) ? b.photos.length : (b.photoCount ?? 0));
        }, 0),
      };
    }

    setSessionSummary(summary);
    setShowSessionSummary(true);
  };

  const getCurrentGPS = (): Promise<{ latitude: number; longitude: number; accuracy?: number }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ latitude: 0, longitude: 0 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
        () => resolve({ latitude: 0, longitude: 0 }),
        { timeout: 5000, maximumAge: 30000 }
      );
    });
  };

  const getDefaultLotCode = (): string => {
    try {
      const lots = JSON.parse(localStorage.getItem('assignedLots') || '[]');
      return lots[0]?.lotCode || 'UNKNOWN';
    } catch { return 'UNKNOWN'; }
  };

  const handleLocationSelect = (locationData: LocationData, buildingData?: any) => {
    setLocation(locationData);
    setSelectedBuildingData(buildingData || null);
    setCurrentScreen('building');
  };

  const markBuildingSurveyed = (buildingId: string) => {
    setSurveyedBuildingIds(prev => {
      const next = new Set(prev);
      next.add(buildingId);
      try { localStorage.setItem('surveyedBuildingIds', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const addToRecentBuildings = (buildingData: any) => {
    const updated = [{ ...buildingData, timestamp: Date.now(), synced: true }, ...recentBuildings].slice(0, 50);
    setRecentBuildings(updated);
    try { localStorage.setItem('recentBuildings', JSON.stringify(updated)); } catch {}
  };

  const handleBuildingSubmit = async (buildingData: any) => {
    const { linkedCustomerId, ...buildingFields } = buildingData;
    // FIX #1: Always include the active sessionId in the create request
    const activeSessionId = localStorage.getItem('serverSessionId') || activeServerSession?._id;
    const buildingWithLocation = {
      ...buildingFields,
      sessionId: activeSessionId,
      gpsCoordinates: {
        latitude: location!.latitude,
        longitude: location!.longitude,
        accuracy: location!.accuracy,
      },
    };

    if (isOnline) {
      try {
        const building = await retryOperation(
          () => buildingApi.create(buildingWithLocation),
          {
            maxRetries: 2,
            onRetry: (attempt) => {
              showToast(`Saving building... Retry ${attempt}/2`, 'warning');
            },
          }
        );

        if (linkedCustomerId) {
          try {
            // FIX #5: Use auto-generated buildingId CODE (not MongoDB _id) for customer link
            const buildingIdCode = building.buildingId ?? building._id;
            await customerApi.link(linkedCustomerId, buildingIdCode);
            showToast('Building registered and customer linked!', 'success');
          } catch (error) {
            logError('Customer Linking', error, { linkedCustomerId, buildingId: building.buildingId });
            showToast('Building registered but customer linking failed', 'warning');
          }
        } else {
          showToast('Building registered successfully!', 'success');
        }

        if (buildingWithLocation.buildingId) markBuildingSurveyed(buildingWithLocation.buildingId);
        addToRecentBuildings({ ...buildingWithLocation, _id: building._id, synced: true });
        setCurrentScreen('success');
      } catch (error) {
        logError('Building Creation', error, buildingWithLocation);
        saveBuildingOffline(buildingWithLocation);
        showToast('Building saved offline. Will sync when online.', 'info');
        if (buildingWithLocation.buildingId) markBuildingSurveyed(buildingWithLocation.buildingId);
        // Do NOT add to recentBuildings here — pendingBuildings already tracks this building.
        // Adding to both causes duplicates in BuildingsList (one synced, one not synced).
        setCurrentScreen('success');
      }
    } else {
      saveBuildingOffline(buildingWithLocation);
      showToast('Building saved offline. Will sync when online.', 'info');
      if (buildingWithLocation.buildingId) markBuildingSurveyed(buildingWithLocation.buildingId);
      // Do NOT add to recentBuildings here — pendingBuildings already tracks this building.
      setCurrentScreen('success');
    }
  };

  const saveBuildingOffline = (buildingData: any) => {
    const pending = [...pendingBuildings, { ...buildingData, timestamp: Date.now() }];
    setPendingBuildings(pending);
    localStorage.setItem('pendingBuildings', JSON.stringify(pending));
  };

  const syncPendingBuildings = async () => {
    if (pendingBuildings.length === 0 || isSyncing) return;
    setIsSyncing(true);
    showToast(`Syncing ${pendingBuildings.length} building(s)...`, 'info');
    const remaining: any[] = [];
    const justSynced: any[] = [];
    let syncedCount = 0;
    for (const building of pendingBuildings) {
      try {
        const result = await retryOperation(() => buildingApi.create(building), { maxRetries: 1 });
        syncedCount++;
        // Move to recentBuildings so it shows as synced (not duplicate of server fetch)
        justSynced.push({ ...building, _id: result?._id ?? building._id, synced: true, timestamp: building.timestamp ?? Date.now() });
      } catch (error) {
        logError('Building Sync', error, building);
        remaining.push(building);
      }
    }
    // Add newly synced buildings to recentBuildings
    if (justSynced.length > 0) {
      setRecentBuildings(prev => {
        const updated = [...justSynced, ...prev].slice(0, 50);
        try { localStorage.setItem('recentBuildings', JSON.stringify(updated)); } catch {}
        return updated;
      });
    }
    setPendingBuildings(remaining);
    localStorage.setItem('pendingBuildings', JSON.stringify(remaining));
    setIsSyncing(false);
    if (syncedCount > 0) showToast(`Successfully synced ${syncedCount} building${syncedCount > 1 ? 's' : ''}!`, 'success');
    if (remaining.length > 0) {
      showToast(`${remaining.length} building${remaining.length > 1 ? 's' : ''} failed to sync`, 'error');
      // Fire a local notification so the surveyor is alerted even if the app is backgrounded
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display === 'granted') {
          await LocalNotifications.schedule({
            notifications: [{
              id: Date.now() % 2147483647, // must fit in a 32-bit int
              title: 'Sync Failed',
              body: `${remaining.length} building${remaining.length > 1 ? 's' : ''} could not be synced. Open the app to retry.`,
              smallIcon: 'ic_stat_icon_config_sample',
              channelId: 'sync_failures',
            }],
          });
        }
      } catch {
        // Notification scheduling is best-effort; do not block the sync flow
      }
    }
  };

  const handleRemovePendingBuilding = (index: number) => {
    if (confirm('Are you sure you want to remove this building from the queue? This action cannot be undone.')) {
      const updated = pendingBuildings.filter((_, i) => i !== index);
      setPendingBuildings(updated);
      localStorage.setItem('pendingBuildings', JSON.stringify(updated));
    }
  };

  const handleRegisterAnother = () => {
    setLocation(null);
    setCurrentScreen('location');
  };

  return (
    <ErrorBoundary>
      <ToastContainer />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50">

        {/* Network Status Banner */}
        {!isOnline && (
          <div className="bg-yellow-500 text-white px-4 pt-safe py-2 text-center font-medium">
            📡 Offline Mode - Buildings will sync when connection is restored
          </div>
        )}
        {isSyncing && (
          <div className="bg-blue-500 text-white px-4 pt-safe py-2 text-center font-medium">
            🔄 Syncing {pendingBuildings.length} pending building(s)...
          </div>
        )}
        {isOnline && pendingBuildings.length > 0 && !isSyncing && (
          <div className="bg-green-500 text-white px-4 pt-safe py-2 flex items-center justify-between gap-3">
            <button
              type="button"
              className="flex-1 text-left font-medium text-sm"
              onClick={() => setCurrentScreen('offline-queue')}
            >
              ✅ {pendingBuildings.length} building{pendingBuildings.length !== 1 ? 's' : ''} waiting to sync
            </button>
            <button
              type="button"
              onClick={syncPendingBuildings}
              className="shrink-0 bg-white text-green-700 font-semibold text-xs px-3 py-1.5 rounded-full hover:bg-green-50 active:scale-95 transition"
            >
              Sync Now
            </button>
          </div>
        )}

        {/* Session Banner - shown during enumeration */}
        {['location', 'building'].includes(currentScreen) && (
          <SessionBanner onEndSession={handleEndSession} />
        )}

        {/* Session Summary Modal */}
        {showSessionSummary && sessionSummary && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Session Complete</h2>
                <p className="text-sm text-gray-500 mt-1">Great work today!</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-700">{sessionSummary.buildingsCount}</p>
                  <p className="text-xs text-blue-600 mt-1">Buildings Registered</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-purple-700">{sessionSummary.photosCount}</p>
                  <p className="text-xs text-purple-600 mt-1">Photos Taken</p>
                </div>
                <div className="bg-teal-50 rounded-xl p-4 text-center">
                  <p className="text-lg font-bold text-teal-700">{sessionSummary.duration}</p>
                  <p className="text-xs text-teal-600 mt-1">Duration</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 text-center">
                  <p className="text-lg font-bold text-orange-700">{sessionSummary.lotCode}</p>
                  <p className="text-xs text-orange-600 mt-1">Lot Code</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowSessionSummary(false);
                  setCurrentScreen('session');
                }}
                className="w-full bg-gradient-to-r from-blue-500 to-teal-500 text-white font-bold py-3 rounded-xl transition hover:from-blue-600 hover:to-teal-600"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        {currentScreen === 'login' && (
          <Login onLogin={handleLogin} />
        )}

        {currentScreen === 'session' && (
          <SessionManagement
            onStartEnumeration={handleStartEnumeration}
            onLogout={handleLogout}
            pendingCount={pendingBuildings.length}
            onViewQueue={() => setCurrentScreen('offline-queue')}
            onViewStats={() => setCurrentScreen('statistics')}
            onViewBuildings={() => setCurrentScreen('buildings-list')}
            onViewSessionHistory={() => setCurrentScreen('session-history')}
            onViewProfile={() => setCurrentScreen('profile-settings')}
            surveyedCount={surveyedBuildingIds.size}
            recentBuildingsCount={recentBuildings.length}
            onClearSurveyedHistory={() => {
              setSurveyedBuildingIds(new Set());
              try { localStorage.removeItem('surveyedBuildingIds'); } catch {}
            }}
            dailyTarget={dailyTarget}
            onSetDailyTarget={(t) => {
              setDailyTarget(t);
              localStorage.setItem('dailyTarget', String(t));
            }}
          />
        )}

        {currentScreen === 'offline-queue' && (
          <OfflineQueue
            pendingBuildings={pendingBuildings}
            onSync={syncPendingBuildings}
            onRemove={handleRemovePendingBuilding}
            onClose={() => setCurrentScreen('session')}
            isSyncing={isSyncing}
          />
        )}

        {currentScreen === 'statistics' && (
          <SessionStatistics
            onClose={() => setCurrentScreen('session')}
            pendingBuildings={pendingBuildings}
            isOnline={isOnline}
            isSyncing={isSyncing}
            onSyncAll={syncPendingBuildings}
            dailyTarget={dailyTarget}
          />
        )}

        {currentScreen === 'buildings-list' && (
          <BuildingsList
            buildings={recentBuildings}
            pendingBuildings={pendingBuildings}
            onClose={() => setCurrentScreen('session')}
          />
        )}

        {currentScreen === 'session-history' && (
          <SessionHistory
            onClose={() => setCurrentScreen('session')}
            onViewSessionBuildings={(sessionId, lotCode) => {
              setSessionDrillDown({ sessionId, lotCode });
              setCurrentScreen('session-buildings');
            }}
          />
        )}

        {currentScreen === 'session-buildings' && sessionDrillDown && (
          <BuildingsList
            buildings={[]}
            pendingBuildings={[]}
            onClose={() => setCurrentScreen('session-history')}
            filterSessionId={sessionDrillDown.sessionId}
            filterSessionLabel={sessionDrillDown.lotCode}
          />
        )}

        {currentScreen === 'profile-settings' && (
          <ProfileSettings
            onClose={() => setCurrentScreen('session')}
            onLogout={handleLogout}
            onLoadCustomers={() => setCurrentScreen('customer-import')}
          />
        )}

        {currentScreen === 'customer-import' && (() => {
          const savedUser = localStorage.getItem('user');
          const u = savedUser ? JSON.parse(savedUser) : {};
          // Derive ownerCompanyId: explicit field > company.companyId > company name slug
          const cName: string = u.company?.companyName ?? u.companyName ?? '';
          const derivedCompanyId: string | undefined =
            u.ownerCompanyId ||
            u.company?.companyId ||
            u.company?.ownerCompanyId ||
            (cName ? cName.trim().toUpperCase().replace(/\s+/g, '-') : undefined);
          return (
            <CustomerImport
              user={{
                role: u.role ?? 'user',
                ownerCompanyId: derivedCompanyId,
                company: u.company,
                fullName: u.fullName,
              }}
              onBack={() => setCurrentScreen('profile-settings')}
            />
          );
        })()}

        {currentScreen === 'location' && (
          <div className="container mx-auto px-4 pt-4 pb-4">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Property Enumeration</h1>
                {surveyedBuildingIds.size > 0 && (
                  <p className="text-xs text-green-700 font-semibold mt-0.5">
                    ✓ {surveyedBuildingIds.size} building{surveyedBuildingIds.size !== 1 ? 's' : ''} surveyed this session
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentScreen('session')}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Session
                </button>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
                >
                  Logout
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Step 1: Select Location</h2>
              <p className="text-gray-500 text-sm mb-3">
                Tap a building polygon to select it.
              </p>
              <LocationPickerWithMap
                onLocationSelect={handleLocationSelect}
                surveyedBuildingIds={surveyedBuildingIds}
              />
            </div>
          </div>
        )}

        {currentScreen === 'building' && location && (
          <div className="container mx-auto px-4 pt-4 pb-4">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSelectedBuildingData(null); setCurrentScreen('location'); }}
                  className="p-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <h1 className="text-xl font-bold text-gray-900">Register Building</h1>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
              >
                Logout
              </button>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Step 2: Building Information</h2>
              <p className="text-gray-500 text-sm mb-3">
                Fill in the building details and capture photos.
              </p>
              <BuildingForm
                onSubmit={handleBuildingSubmit}
                location={location}
                selectedBuilding={selectedBuildingData}
                onBack={() => {
                  setSelectedBuildingData(null);
                  setCurrentScreen('session');
                }}
              />
            </div>
          </div>
        )}

        {currentScreen === 'success' && (
          <div className="container mx-auto px-4 pt-4 pb-4">
            <div className="flex justify-between items-center mb-3">
              <h1 className="text-xl font-bold text-gray-900">Property Enumeration</h1>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
              >
                Logout
              </button>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Building Registered!</h2>
              <p className="text-gray-500 text-sm mb-4">
                {!isOnline ? 'Saved offline — will sync when online.' : 'Successfully saved to server.'}
              </p>
              {recentBuildings[0] && (
                <div className="bg-gray-50 rounded-xl p-4 mb-4 text-left">
                  {recentBuildings[0].buildingId && (
                    <p className="text-xs font-mono text-blue-600 mb-1">ID: {recentBuildings[0].buildingId}</p>
                  )}
                  <p className="text-sm font-semibold text-gray-800">{recentBuildings[0].address}</p>
                  {recentBuildings[0].buildingName && (
                    <p className="text-xs text-gray-500 mt-0.5">{recentBuildings[0].buildingName}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {recentBuildings[0].propertyType} · {recentBuildings[0].numberOfUnits} unit{recentBuildings[0].numberOfUnits !== 1 ? 's' : ''}
                    {recentBuildings[0].lotCode && ` · ${recentBuildings[0].lotCode}`}
                  </p>
                  {/* Photo thumbnails */}
                  {Array.isArray(recentBuildings[0].photos) && recentBuildings[0].photos.length > 0 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                      {recentBuildings[0].photos.slice(0, 4).map((photo: string, i: number) => (
                        <img
                          key={i}
                          src={photo}
                          alt={`Photo ${i + 1}`}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0 border border-gray-200"
                        />
                      ))}
                      {recentBuildings[0].photos.length > 4 && (
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center text-xs text-gray-500 font-medium">
                          +{recentBuildings[0].photos.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleRegisterAnother}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-xl hover:from-blue-600 hover:to-teal-600 transition font-bold text-base shadow"
                >
                  Register Another Building
                </button>
                <button
                  onClick={() => setCurrentScreen('buildings-list')}
                  className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium text-sm"
                >
                  View All Registered Buildings
                </button>
                <button
                  onClick={() => setCurrentScreen('session')}
                  className="w-full py-2.5 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 transition font-medium text-sm"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
