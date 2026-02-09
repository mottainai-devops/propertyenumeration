import { useState, useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import Login from './components/Login';
import SessionManagement from './components/SessionManagement';
import SessionBanner from './components/SessionBanner';
import SimpleLocationPicker from './components/SimpleLocationPicker';
import BuildingForm from './components/BuildingForm';
import { authApi, buildingApi, customerApi } from './api/client';

type AppScreen = 'login' | 'session' | 'location' | 'building' | 'success';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('login');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingBuildings, setPendingBuildings] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

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
      const response = await authApi.login({ email, password });
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      // Login successful - go to session management
      setCurrentScreen('session');
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setCurrentScreen('login');
  };

  const handleLocationSelect = (locationData: LocationData) => {
    setLocation(locationData);
    setCurrentScreen('building');
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
        const building = await buildingApi.create(buildingWithLocation);
        
        // Link customer if one was selected
        if (linkedCustomerId) {
          try {
            await customerApi.link(linkedCustomerId, building._id);
            console.log('Customer linked successfully');
          } catch (error) {
            console.error('Failed to link customer:', error);
            alert('Building created but customer linking failed. You can link the customer later.');
          }
        }
        
        setCurrentScreen('success');
      } catch (error) {
        console.error('Failed to create building:', error);
        // Save to localStorage for later sync
        saveBuildingOffline(buildingWithLocation);
        alert('Building saved offline. Will sync when connection is restored.');
        setCurrentScreen('success');
      }
    } else {
      // Save to localStorage
      saveBuildingOffline(buildingWithLocation);
      alert('Building saved offline. Will sync when connection is restored.');
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
    const remaining: any[] = [];

    for (const building of pendingBuildings) {
      try {
        await buildingApi.create(building);
      } catch (error) {
        console.error('Failed to sync building:', error);
        remaining.push(building);
      }
    }

    setPendingBuildings(remaining);
    localStorage.setItem('pendingBuildings', JSON.stringify(remaining));
    setIsSyncing(false);
  };



  const handleRegisterAnother = () => {
    setLocation(null);
    setCurrentScreen('location');
  };

  return (
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
        <div className="bg-green-500 text-white px-4 pt-safe py-2 text-center font-medium">
          ✅ Online - {pendingBuildings.length} building(s) waiting to sync
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
        />
      )}

      {currentScreen === 'location' && (
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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 1: Select Location</h2>
            <p className="text-gray-600 mb-6">
              Capture the GPS coordinates of the building you want to register.
            </p>
            <SimpleLocationPicker onLocationSelect={handleLocationSelect} />
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
              onBack={() => setCurrentScreen('session')}
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
  );
}

export default App;
