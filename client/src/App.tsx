import { useState, useEffect } from 'react';
import Login from './components/Login';
import SessionManagement from './components/SessionManagement';
import SessionStatistics from './components/SessionStatistics';
import EnhancedLocationMap from './components/EnhancedLocationMap';
import type { BuildingPolygon } from './models/BuildingPolygon';
import BuildingForm from './components/BuildingForm';

interface SelectedLocation {
  lat: number;
  lng: number;
  address: string;
}

type Screen = 'login' | 'session-management' | 'location-picker' | 'session-statistics';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingPolygon | null>(null);
  const [showForm, setShowForm] = useState(false);
  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('jwt_token');
    const user = localStorage.getItem('user_data');
    
    if (token && user) {
      setIsAuthenticated(true);
      setCurrentScreen('session-management'); // Navigate to session management after login
    }
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setCurrentScreen('session-management'); // Navigate to session management after login
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('activeSession'); // Clear active session on logout
    setIsAuthenticated(false);
    setCurrentScreen('login');
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng, address: 'Loading address...' });
    // Don't auto-show form - wait for user to click Confirm button
  };

  const handleBuildingSelect = (building: BuildingPolygon) => {
    setSelectedBuilding(building);
    setSelectedLocation({
      lat: building.centerLat,
      lng: building.centerLon,
      address: building.address || building.businessName || building.buildingId,
    });
  };

  const handleConfirmLocation = () => {
    if (selectedLocation) {
      setShowForm(true);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setSelectedLocation(null);
    setSelectedBuilding(null);
    // Show success message
    alert('Building registered successfully!');
    // Stay on location picker to register more buildings
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setSelectedLocation(null);
    setSelectedBuilding(null);
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Session Management Screen
  if (currentScreen === 'session-management') {
    return (
      <SessionManagement
        onLogout={handleLogout}
        onNavigateToLocationPicker={() => setCurrentScreen('location-picker')}
        onNavigateToStatistics={() => setCurrentScreen('session-statistics')}
      />
    );
  }

  // Session Statistics Screen
  if (currentScreen === 'session-statistics') {
    return (
      <SessionStatistics
        onBack={() => setCurrentScreen('session-management')}
      />
    );
  }

  // Location Picker Screen (with Building Form)
  return (
    <div className="w-full h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <button
          onClick={() => setCurrentScreen('session-management')}
          className="text-blue-600 font-medium"
        >
          ← Back
        </button>
        <h1 className="text-lg font-bold">Select Location</h1>
        <div className="w-16"></div>
      </div>

      {/* Location Picker */}
      <div className="flex-1 overflow-y-auto p-4">
        <EnhancedLocationMap
          onLocationSelected={handleLocationSelect}
          onBuildingSelected={handleBuildingSelect}
        />
      </div>

      {/* Action Area with Safe-Area Padding */}
      <div className="bg-white border-t border-gray-200 p-4 pb-[calc(16px+var(--sab))]">
        <button
          onClick={handleConfirmLocation}
          disabled={!selectedLocation}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {selectedBuilding ? `Register Building: ${selectedBuilding.buildingId}` : 'Confirm Location'}
        </button>
        {selectedLocation && (
          <p className="text-xs text-gray-600 mt-2 text-center">
            {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
          </p>
        )}
      </div>

      {/* Building Form Modal */}
      {showForm && selectedLocation && (
        <BuildingForm
          latitude={selectedLocation.lat}
          longitude={selectedLocation.lng}
          address={selectedLocation.address}
          selectedBuilding={selectedBuilding}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  );
}

export default App;
