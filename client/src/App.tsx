import { useState, useEffect } from 'react';
import Login from './components/Login';
import SimpleLocationPicker from './components/SimpleLocationPicker';
import BuildingForm from './components/BuildingForm';

interface SelectedLocation {
  lat: number;
  lng: number;
  address: string;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('jwt_token');
    const user = localStorage.getItem('user_data');
    
    if (token && user) {
      setIsAuthenticated(true);
      setUserData(JSON.parse(user));
    }
  }, []);

  const handleLoginSuccess = () => {
    const user = localStorage.getItem('user_data');
    if (user) {
      setUserData(JSON.parse(user));
    }
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_data');
    setIsAuthenticated(false);
    setUserData(null);
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
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setSelectedLocation(null);
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Header */}
      <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between shadow-lg z-20">
        <div>
          <h1 className="text-lg font-bold">Property Enumeration</h1>
          {userData && (
            <p className="text-xs text-green-100">{userData.name} • {userData.companyName}</p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="bg-green-700 hover:bg-green-800 px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Logout
        </button>
      </div>

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
