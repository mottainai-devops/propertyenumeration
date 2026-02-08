import { useState, useEffect } from 'react';
import Login from './components/Login';
import SessionManagement from './components/SessionManagement';
import SessionStatistics from './components/SessionStatistics';
import SimpleLocationPicker from './components/SimpleLocationPicker';
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

  const handleLocationSelect = (lat: number, lng: number, address: string) => {
    setSelectedLocation({ lat, lng, address });
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setSelectedLocation(null);
    // Show success message
    alert('Building registered successfully!');
    // Stay on location picker to register more buildings
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setSelectedLocation(null);
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
      {/* Location Picker */}
      <div className="flex-1 overflow-y-auto">
        <SimpleLocationPicker onLocationSelect={handleLocationSelect} />
      </div>

      {/* Building Form Modal */}
      {showForm && selectedLocation && (
        <BuildingForm
          latitude={selectedLocation.lat}
          longitude={selectedLocation.lng}
          address={selectedLocation.address}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  );
}

export default App;
