import { useState, useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import Login from './components/Login';
import SessionManagement from './components/SessionManagement';
import SessionBanner from './components/SessionBanner';
import LocationPickerWithMap from './components/LocationPickerWithMap';
import BuildingForm from './components/BuildingForm';
import OfflineQueue from './components/OfflineQueue';
import SessionStatistics from './components/SessionStatistics';
import ErrorBoundary from './components/ErrorBoundary';
import { useToast } from './components/Toast';
import { authApi, buildingApi, customerApi } from './api/client';
import { getOperationErrorMessage, logError, retryOperation } from './utils/errorHandler';

type AppScreen = 'login' | 'session' | 'location' | 'building' | 'success' | 'offline-queue' | 'statistics';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('login');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [selectedBuildingData, setSelectedBuildingData] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingBuildings, setPendingBuildings] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [surveyedBuildingIds, setSurveyedBuildingIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('surveyedBuildingIds');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const { showToast, ToastContainer } = useToast();

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

  // Load pending buildings from localStorage
  useEffect(() => {
    const loadPendingBuildings = () => {
      const pending = localStorage.getItem('pendingBuildings');
      if (pending) {
        setPendingBuildings(JSON.parse(pending));
      }
    };
    loadPendingBuildings();
  }, []);

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      // User is logged in
      setCurrentScreen('location');
    }
  }, []);

  // Handle hardware back button
  useEffect(() => {
    let backButtonHandler: any;

    const setupBackButton = async () => {
      backButtonHandler = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        // If in building or location screen, go back to session
        if (currentScreen === 'building' || currentScreen === 'location') {
          setCurrentScreen('session');
        }
        // If in session screen, allow app to go to background (don't exit)
        else if (currentScreen === 'session') {
          CapacitorApp.minimizeApp();
        }
        // For other screens, use default behavior
        else if (canGoBack) {
          window.history.back();
        } else {
          CapacitorApp.minimizeApp();
        }
      });
    };

    setupBackButton();

    return () => {
      if (backButtonHandler) {
        backButtonHandler.remove();
      }
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
      // Store assigned lots separately for easy access
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
    setCurrentScreen('login');
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

  const handleBuildingSubmit = async (buildingData: any) => {
    const { linkedCustomerId, ...buildingFields } = buildingData;
    const buildingWithLocation = {
      ...buildingFields,
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
        
        // Link customer if one was selected
        if (linkedCustomerId) {
          try {
            await customerApi.link(linkedCustomerId, building._id);
            showToast('Building registered and customer linked!', 'success');
          } catch (error) {
            logError('Customer Linking', error, { linkedCustomerId, buildingId: building._id });
            showToast('Building registered but customer linking failed', 'warning');
          }
        } else {
          showToast('Building registered successfully!', 'success');
        }
        // Track surveyed building
        if (buildingWithLocation.buildingId) markBuildingSurveyed(buildingWithLocation.buildingId);
        setCurrentScreen('success');
      } catch (error) {
        logError('Building Creation', error, buildingWithLocation);
        // Save to localStorage for later sync
        saveBuildingOffline(buildingWithLocation);
        showToast('Building saved offline. Will sync when online.', 'info');
        if (buildingWithLocation.buildingId) markBuildingSurveyed(buildingWithLocation.buildingId);
        setCurrentScreen('success');
      }
    } else {
      // Save to localStorage
      saveBuildingOffline(buildingWithLocation);
      showToast('Building saved offline. Will sync when online.', 'info');
      if (buildingWithLocation.buildingId) markBuildingSurveyed(buildingWithLocation.buildingId);
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
    let syncedCount = 0;

    for (const building of pendingBuildings) {
      try {
        await retryOperation(
          () => buildingApi.create(building),
          { maxRetries: 1 }
        );
        syncedCount++;
      } catch (error) {
        logError('Building Sync', error, building);
        remaining.push(building);
      }
    }

    setPendingBuildings(remaining);
    localStorage.setItem('pendingBuildings', JSON.stringify(remaining));
    setIsSyncing(false);

    // Show success message
    if (syncedCount > 0) {
      showToast(`Successfully synced ${syncedCount} building${syncedCount > 1 ? 's' : ''}!`, 'success');
    }
    if (remaining.length > 0) {
      showToast(`${remaining.length} building${remaining.length > 1 ? 's' : ''} failed to sync`, 'error');
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
        <div 
          className="bg-green-500 text-white px-4 pt-safe py-2 text-center font-medium cursor-pointer hover:bg-green-600 transition"
          onClick={() => setCurrentScreen('offline-queue')}
        >
          ✅ Online - {pendingBuildings.length} building(s) waiting to sync (Tap to view)
        </div>
      )}

      {/* Session Banner - shown during enumeration */}
      {['location', 'building'].includes(currentScreen) && (
        <SessionBanner onEndSession={() => setCurrentScreen('session')} />
      )}

      {/* Main Content */}
      {currentScreen === 'login' && (
        <Login onLogin={handleLogin} />
      )}

      {currentScreen === 'session' && (
        <SessionManagement
          onStartEnumeration={() => setCurrentScreen('location')}
          onLogout={handleLogout}
          pendingCount={pendingBuildings.length}
          onViewQueue={() => setCurrentScreen('offline-queue')}
          onViewStats={() => setCurrentScreen('statistics')}
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
        />
      )}

      {currentScreen === 'location' && (
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
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Property Enumeration</h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Logout
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 2: Building Information</h2>
            <p className="text-gray-600 mb-6">
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
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Property Enumeration</h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Logout
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Success!</h2>
            <p className="text-gray-600 mb-8">
              Building registered successfully{!isOnline && ' (offline - will sync later)'}.
            </p>
            <button
              onClick={handleRegisterAnother}
              className="px-8 py-4 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition font-medium text-lg"
            >
              Register Another Building
            </button>
          </div>
        </div>
      )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
