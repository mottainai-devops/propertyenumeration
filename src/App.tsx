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

// ---------------------------------------------------------------------------
// Per-user localStorage key helpers
// All building/session data is keyed by userId so multiple accounts on the
// same device do not share each other's pending queue or recent history.
// ---------------------------------------------------------------------------
function getUserId(): string {
  try {
    const u = localStorage.getItem('user');
    if (u) {
      const parsed = JSON.parse(u);
      return parsed._id || parsed.id || parsed.email || 'default';
    }
  } catch {}
  return 'default';
}
const userKey = (base: string) => `${base}_${getUserId()}`;
// ---------------------------------------------------------------------------

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface SessionSummary {
  lotCode: string;
  duration: string;
  buildingsCount: number;
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('login');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [selectedBuildingData, setSelectedBuildingData] = useState<any>(null);
  const [existingRegistrationId, setExistingRegistrationId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingBuildings, setPendingBuildings] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [recentBuildings, setRecentBuildings] = useState<any[]>([]);
  const [activeServerSession, setActiveServerSession] = useState<Session | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [surveyedBuildingIds, setSurveyedBuildingIds] = useState<Set<string>>(() => {
    try {
      // v1.56.0: scoped by userId to prevent cross-account leakage
      const saved = localStorage.getItem(userKey('surveyedBuildingIds'));
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [dailyTarget, setDailyTarget] = useState<number>(() => {
    const saved = localStorage.getItem('dailyTarget');
    return saved ? parseInt(saved) : 50;
  });
  const [sessionDrillDown, setSessionDrillDown] = useState<{ sessionId: string; lotCode: string } | null>(null);
  const [buildingsRefreshKey, setBuildingsRefreshKey] = useState(0);
  const [buildingsInitialSearch, setBuildingsInitialSearch] = useState('');
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
  // Keys are scoped per-user (v1.55+) so multiple accounts on the same device
  // do not share each other's pending queue or recent history.
  // On first load after upgrade, we migrate data from the old unscoped keys.
  useEffect(() => {
    const uid = getUserId();
    const pendingKey = `pendingBuildings_${uid}`;
    const recentKey = `recentBuildings_${uid}`;
    const migrationKey = `buildings_migrated_v155_${uid}`;

    // One-time migration: copy unscoped data into user-scoped keys, then clear
    if (!localStorage.getItem(migrationKey)) {
      const oldPending = localStorage.getItem('pendingBuildings');
      const oldRecent = localStorage.getItem('recentBuildings');
      if (oldPending && !localStorage.getItem(pendingKey)) {
        localStorage.setItem(pendingKey, oldPending);
      }
      if (oldRecent && !localStorage.getItem(recentKey)) {
        // Also deduplicate and strip synced:false entries from pre-v1.53 builds
        try {
          const parsed: any[] = JSON.parse(oldRecent);
          const seen = new Set<string>();
          const deduped = parsed.filter((b: any) => {
            if (b.synced === false) return false;
            const key = b._id || (b.address && b.lotCode ? `${b.address.trim().toLowerCase()}|${b.lotCode}` : null);
            if (key) { if (seen.has(key)) return false; seen.add(key); }
            return true;
          });
          localStorage.setItem(recentKey, JSON.stringify(deduped));
        } catch { localStorage.setItem(recentKey, oldRecent); }
      }
      // Clear the old unscoped keys so they don't pollute other users' migrations
      localStorage.removeItem('pendingBuildings');
      localStorage.removeItem('recentBuildings');
      localStorage.setItem(migrationKey, '1');
    }

    const pending = localStorage.getItem(pendingKey);
    if (pending) { try { setPendingBuildings(JSON.parse(pending)); } catch {} }

    const recent = localStorage.getItem(recentKey);
    if (recent) { try { setRecentBuildings(JSON.parse(recent)); } catch {} }
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
      // v1.56.0: scope assignedLots by userId to prevent cross-account leakage
      const userId = response.user._id || response.user.id || response.user.email || 'default';
      let assignedLots = response.user.assignedLots || [];
      
      // v1.56.1: If backend doesn't return assignedLots in login response,
      // fetch active session and extract lotCode from it
      if (assignedLots.length === 0) {
        try {
          const sessions = await sessionApi.list();
          const activeSession = sessions.find(s => s.isActive);
          if (activeSession && activeSession.lotCode) {
            assignedLots = [{ lotCode: activeSession.lotCode, lotName: activeSession.lotCode }];
          }
        } catch (err) {
          console.warn('Could not fetch active session to populate assignedLots:', err);
        }
      }
      
      localStorage.setItem(`assignedLots_${userId}`, JSON.stringify(assignedLots));
      // Also set unscoped key for backwards compatibility with old data
      localStorage.setItem('assignedLots', JSON.stringify(assignedLots));
      // Clear old unscoped keys from other users
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('assignedLots_') && key !== `assignedLots_${userId}`) {
          // Keep other user's scoped data but don't load it
        }
      }
      showToast('Login successful!', 'success');
      setCurrentScreen('session');
    } catch (error: any) {
      logError('Login', error, { email });
      const errorMessage = getOperationErrorMessage('login', error);
      showToast(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  const handleLogout = async () => {
    // Contract v1.0.0 §2.3: Invalidate token on server first, then clear local state
    await authApi.logout();
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
            photosUploaded: 0,
            customersLinked: 0,
            areasCovered: [],
            isActive: true,
            startLocation: gps,
          };
          setActiveServerSession(existingSession);
          // v1.56.0: scope serverSessionId by userId
          localStorage.setItem(userKey('serverSessionId'), conflict.existingSessionId);
          sessionStartTimeRef.current = new Date(conflict.existingStartTime);
          showToast('Resuming your existing active session', 'info');
        } else {
          const session = result as Session;
          setActiveServerSession(session);
          localStorage.setItem(userKey('serverSessionId'), session._id);
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
    const sessionId = localStorage.getItem(userKey('serverSessionId')) || activeServerSession?._id;
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
        };
        setActiveServerSession(null);
        localStorage.removeItem(userKey('serverSessionId'));
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
      const userId = (() => {
        try {
          const u = JSON.parse(localStorage.getItem('user') || '{}');
          return u._id || u.id || u.email || 'default';
        } catch { return 'default'; }
      })();
      const key = `assignedLots_${userId}`;
      let lots = JSON.parse(localStorage.getItem(key) || '[]');
      if (lots.length === 0) {
        lots = JSON.parse(localStorage.getItem('assignedLots') || '[]');
      }
      return lots[0]?.lotCode || 'UNKNOWN';
    } catch { return 'UNKNOWN'; }
  };

  const handleLocationSelect = (locationData: LocationData, buildingData?: any) => {
    setLocation(locationData);
    // If the map bottom sheet passed an existing registration to update
    if (buildingData?._existingRegistrationId) {
      const { _existingRegistrationId, _existingRegistration, ...rest } = buildingData;
      setExistingRegistrationId(_existingRegistrationId);
      // Pre-fill the form with the existing record's data
      setSelectedBuildingData({
        ...rest,
        buildingName: _existingRegistration?.buildingName,
        propertyType: _existingRegistration?.propertyType,
        numberOfUnits: _existingRegistration?.numberOfUnits,
        contactPersonName: _existingRegistration?.contactPersonName,
        contactPhoneNumber: _existingRegistration?.contactPhoneNumber,
        unitCode: _existingRegistration?.unitCode,
        _isUpdate: true,
      });
    } else {
      setExistingRegistrationId(null);
      setSelectedBuildingData(buildingData || null);
    }
    setCurrentScreen('building');
  };

  const markBuildingSurveyed = (buildingId: string) => {
    setSurveyedBuildingIds(prev => {
      const next = new Set(prev);
      next.add(buildingId);
      // v1.56.0: scoped by userId
      try { localStorage.setItem(userKey('surveyedBuildingIds'), JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const addToRecentBuildings = (buildingData: any) => {
    const updated = [{ ...buildingData, timestamp: Date.now(), synced: true }, ...recentBuildings].slice(0, 50);
    setRecentBuildings(updated);
    try { localStorage.setItem(userKey('recentBuildings'), JSON.stringify(updated)); } catch {}
  };

  const handleBuildingSubmit = async (buildingData: any) => {
    // Handle update of an existing registration
    if (existingRegistrationId) {
      const { linkedCustomerId: _lc, _isUpdate: _iu, ...updateFields } = buildingData;
      const activeSessionId = localStorage.getItem(userKey('serverSessionId')) || activeServerSession?._id;
      const updatePayload = {
        ...updateFields,
        sessionId: activeSessionId,
        gpsCoordinates: {
          latitude: location!.latitude,
          longitude: location!.longitude,
          accuracy: location!.accuracy,
        },
      };
      if (isOnline) {
        try {
          const updated = await buildingApi.update(existingRegistrationId, updatePayload);
          showToast('Building record updated successfully!', 'success');
          if (updated.buildingId) markBuildingSurveyed(updated.buildingId);
          addToRecentBuildings({ ...updated, synced: true, timestamp: Date.now() });
          setBuildingsRefreshKey(k => k + 1);
          setExistingRegistrationId(null);
          setCurrentScreen('success');
        } catch (error) {
          logError('Building Update', error, updatePayload);
          showToast('Update failed — please try again', 'error');
        }
      } else {
        showToast('Cannot update while offline — please connect to the internet', 'warning');
      }
      return;
    }
    const { linkedCustomerId, ...buildingFields } = buildingData;
    // FIX #1: Always include the active sessionId in the create request
    const activeSessionId = localStorage.getItem(userKey('serverSessionId')) || activeServerSession?._id;
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
            // Use buildingId (auto-generated code e.g. "URBAN-SPIRIT6009") for the link.
            // _id is always populated by normaliseBuilding (raw.buildingId ?? raw._id ?? '').
            // Prefer buildingId over _id since the backend link endpoint expects the code.
            const buildingIdCode = (building.buildingId || building._id || '').trim();
            if (!buildingIdCode) {
              throw new Error(`Building ID missing from create response: ${JSON.stringify(building)}`);
            }
            console.log('[Link] Linking customer', linkedCustomerId, 'to building', buildingIdCode);
            await customerApi.link(linkedCustomerId, buildingIdCode);
            showToast('Building registered and customer linked!', 'success');
          } catch (error: any) {
            logError('Customer Linking', error, { linkedCustomerId, buildingId: building.buildingId, building_id: building._id });
            // Check if the backend rejected because the customer is already linked to another building
            const errMsg: string = error?.response?.data?.error ?? error?.message ?? '';
            const alreadyLinked = errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('linked');
            if (alreadyLinked) {
              showToast('Building registered! Note: this customer is already linked to another building — each customer can only be linked to one building.', 'warning');
            } else {
              showToast('Building registered but customer linking failed — please link manually', 'warning');
            }
          }
        } else {
          showToast('Building registered successfully!', 'success');
        }

        if (building.buildingId) markBuildingSurveyed(building.buildingId);
        addToRecentBuildings({ ...building, synced: true, timestamp: Date.now() });
        // Trigger buildings list to re-fetch from server
        setBuildingsRefreshKey(k => k + 1);
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

  const saveBuildingOffline = async (buildingData: any) => {
    const buildingToSave = {
      ...buildingData,
      timestamp: Date.now(),
    };
    const pending = [...pendingBuildings, buildingToSave];
    setPendingBuildings(pending);
    localStorage.setItem(userKey('pendingBuildings'), JSON.stringify(pending));
  };

  const syncPendingBuildings = async () => {
    if (pendingBuildings.length === 0 || isSyncing) return;
    setIsSyncing(true);
    showToast(`Syncing ${pendingBuildings.length} building(s)...`, 'info');
    const remaining: any[] = [];
    const justSynced: any[] = [];
    let syncedCount = 0;
    // Get fresh sessionId for syncing offline buildings
    const currentSessionId = localStorage.getItem(userKey('serverSessionId')) || activeServerSession?._id;
    for (const building of pendingBuildings) {
      try {
        // Validate GPS coordinates before syncing
        let gpsCoordinates = building.gpsCoordinates;
        if (!gpsCoordinates || !gpsCoordinates.latitude || !gpsCoordinates.longitude) {
          // Try to reconstruct from flat fields
          gpsCoordinates = {
            latitude: building.gpsLatitude || building.latitude || 0,
            longitude: building.gpsLongitude || building.longitude || 0,
          };
        }
        // Skip if still no valid GPS
        if (!gpsCoordinates.latitude || !gpsCoordinates.longitude) {
          const buildingLabel = building.buildingName || building.address || 'Building';
          showToast(`Skipping "${buildingLabel}": Missing GPS coordinates`, 'error');
          remaining.push(building);
          continue;
        }
        // Include sessionId when syncing offline buildings (may not have been set when created offline)
        const buildingToSync = {
          ...building,
          gpsCoordinates,
          sessionId: building.sessionId || currentSessionId,
        };
        const result = await retryOperation(() => buildingApi.create(buildingToSync), { maxRetries: 1 });
        syncedCount++;
        // Move to recentBuildings so it shows as synced (not duplicate of server fetch)
        justSynced.push({ ...building, _id: result?._id ?? building._id, synced: true, timestamp: building.timestamp ?? Date.now() });
      } catch (error) {
        logError('Building Sync', error, building);
        let errorMsg = 'Unknown error';
        if (error instanceof Error) {
          errorMsg = error.message;
          if ('response' in error && typeof error.response === 'object' && error.response !== null) {
            const resp = error.response as any;
            if (resp.data?.error) errorMsg = resp.data.error;
            else if (resp.data?.message) errorMsg = resp.data.message;
            else if (resp.statusText) errorMsg = resp.statusText;
          }
        }
        const buildingLabel = building.buildingName || building.address || 'Building';
        showToast(`Failed to sync "${buildingLabel}": ${errorMsg}`, 'error');
        remaining.push(building);
      }
    }
    // Add newly synced buildings to recentBuildings
    if (justSynced.length > 0) {
      setRecentBuildings(prev => {
        const updated = [...justSynced, ...prev].slice(0, 50);
        try { localStorage.setItem(userKey('recentBuildings'), JSON.stringify(updated)); } catch {}
        return updated;
      });
    }
    setPendingBuildings(remaining);
    localStorage.setItem(userKey('pendingBuildings'), JSON.stringify(remaining));
    setIsSyncing(false);
    if (syncedCount > 0) {
      showToast(`Successfully synced ${syncedCount} building${syncedCount > 1 ? 's' : ''}!`, 'success');
      // Trigger buildings list to re-fetch from server
      setBuildingsRefreshKey(k => k + 1);
    }
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
      localStorage.setItem(userKey('pendingBuildings'), JSON.stringify(updated));
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
            onViewBuildings={() => { setBuildingsInitialSearch(''); setCurrentScreen('buildings-list'); }}
            onViewBuildingsWithSearch={(q) => { setBuildingsInitialSearch(q); setCurrentScreen('buildings-list'); }}
            onViewSessionHistory={() => setCurrentScreen('session-history')}
            onViewProfile={() => setCurrentScreen('profile-settings')}
            surveyedCount={surveyedBuildingIds.size}
            recentBuildingsCount={recentBuildings.length}
            registeredCount={recentBuildings.length}
            onClearSurveyedHistory={() => {
              setSurveyedBuildingIds(new Set());
              try { localStorage.removeItem(userKey('surveyedBuildingIds')); } catch {}
            }}
            dailyTarget={dailyTarget}
            onSetDailyTarget={(t) => {
              setDailyTarget(t);
              localStorage.setItem('dailyTarget', String(t));
            }}
            recentBuildings={recentBuildings}
            onEditBuilding={(b) => {
              // Navigate to buildings list and open edit for this building
              setBuildingsInitialSearch(b.address || b.buildingId || '');
              setCurrentScreen('buildings-list');
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
            onClose={() => { setBuildingsInitialSearch(''); setCurrentScreen('session'); }}
            refreshKey={buildingsRefreshKey}
            initialSearch={buildingsInitialSearch}
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
                Fill in the building details.
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
