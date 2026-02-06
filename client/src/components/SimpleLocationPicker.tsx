import { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';

interface SimpleLocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
}

export default function SimpleLocationPicker({ onLocationSelect }: SimpleLocationPickerProps) {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [address, setAddress] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);

  // Get current location on component mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Check if we have location permission
      const permission = await Geolocation.checkPermissions();
      
      if (permission.location !== 'granted') {
        const requestResult = await Geolocation.requestPermissions();
        if (requestResult.location !== 'granted') {
          setError('Location permission denied. Please enable location access in settings.');
          setLoading(false);
          return;
        }
      }

      // Get current position
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      setCurrentLocation({ lat, lng });
      setLatitude(lat.toFixed(6));
      setLongitude(lng.toFixed(6));
      setLocationAccuracy(accuracy);
      setError('');
      
    } catch (err: any) {
      console.error('Location error:', err);
      setError(`Unable to get location: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (currentLocation) {
      onLocationSelect(currentLocation.lat, currentLocation.lng, address || `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`);
    }
  };

  const handleUseManualCoordinates = () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      setError('Please enter valid coordinates');
      return;
    }

    if (lat < -90 || lat > 90) {
      setError('Latitude must be between -90 and 90');
      return;
    }

    if (lng < -180 || lng > 180) {
      setError('Longitude must be between -180 and 180');
      return;
    }

    onLocationSelect(lat, lng, address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 p-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Building Location</h2>
        <p className="text-sm text-gray-600">
          Use your current GPS location or enter coordinates manually
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Current Location Section */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Current GPS Location</h3>
          <button
            onClick={getCurrentLocation}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? 'Getting Location...' : 'Refresh GPS'}
          </button>
        </div>

        {currentLocation ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Latitude</p>
                <p className="text-lg font-mono font-semibold text-gray-900">{currentLocation.lat.toFixed(6)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Longitude</p>
                <p className="text-lg font-mono font-semibold text-gray-900">{currentLocation.lng.toFixed(6)}</p>
              </div>
            </div>

            {locationAccuracy !== null && (
              <p className="text-xs text-gray-500">
                Accuracy: ±{locationAccuracy.toFixed(1)} meters
                {locationAccuracy > 50 && ' (Low accuracy - try moving outdoors)'}
              </p>
            )}

            <button
              onClick={handleUseCurrentLocation}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-semibold transition"
            >
              Use Current Location
            </button>
          </div>
        ) : (
          <div className="text-center py-6">
            {loading ? (
              <div>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-3"></div>
                <p className="text-gray-600">Getting your location...</p>
              </div>
            ) : (
              <p className="text-gray-500">No location data yet. Tap "Refresh GPS" to get your current location.</p>
            )}
          </div>
        )}
      </div>

      {/* Manual Input Section */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Or Enter Coordinates Manually</h3>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Latitude (-90 to 90)
            </label>
            <input
              type="number"
              step="0.000001"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="6.524379"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longitude (-180 to 180)
            </label>
            <input
              type="number"
              step="0.000001"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="3.379206"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address (Optional)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main Street, Lagos"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>

          <button
            onClick={handleUseManualCoordinates}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold transition"
          >
            Use Manual Coordinates
          </button>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">💡 Tip:</span> For best GPS accuracy, make sure you're outdoors with a clear view of the sky. Indoor GPS may be less accurate.
        </p>
      </div>
    </div>
  );
}
