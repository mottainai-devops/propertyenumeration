import { useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface SimpleLocationPickerProps {
  onLocationSelect: (locationData: LocationData) => void;
}

export default function SimpleLocationPicker({ onLocationSelect }: SimpleLocationPickerProps) {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  const getCurrentLocation = async () => {
    setLoading(true);
    setError('');
    
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });

      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      setLocation(locationData);
      setLoading(false);
    } catch (err: any) {
      setError(`GPS Error: ${err.message || 'Unable to get location'}. Please enable location services.`);
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (location) {
      onLocationSelect(location);
    }
  };

  const handleManualSubmit = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);

    if (isNaN(lat) || isNaN(lng)) {
      setError('Please enter valid latitude and longitude');
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

    const locationData: LocationData = {
      latitude: lat,
      longitude: lng,
    };

    onLocationSelect(locationData);
  };

  return (
    <div className="space-y-6">
      {/* GPS Location Card */}
      {!manualMode && (
        <div className="bg-gradient-to-br from-blue-50 to-teal-50 rounded-2xl p-6 shadow-lg border-2 border-blue-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            GPS Location
          </h3>

          {!location && !loading && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">Tap the button below to capture your current GPS coordinates</p>
              <button
                onClick={getCurrentLocation}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-teal-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition"
              >
                📍 Get Current Location
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="relative inline-block">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
                <svg className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium mt-4">Acquiring GPS signal...</p>
              <p className="text-gray-500 text-sm mt-2">This may take a few seconds</p>
            </div>
          )}

          {location && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-md">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Latitude</p>
                    <p className="text-lg font-mono font-bold text-gray-900">{location.latitude.toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Longitude</p>
                    <p className="text-lg font-mono font-bold text-gray-900">{location.longitude.toFixed(6)}</p>
                  </div>
                </div>
                {location.accuracy && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-500">Accuracy</p>
                    <p className={`text-lg font-semibold ${
                      location.accuracy < 10 ? 'text-green-600' : 
                      location.accuracy < 50 ? 'text-yellow-600' : 
                      'text-orange-600'
                    }`}>
                      ± {location.accuracy.toFixed(1)} meters
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleUseCurrentLocation}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition"
                >
                  ✓ Use This Location
                </button>
                <button
                  onClick={getCurrentLocation}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition"
                >
                  🔄 Refresh GPS
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mt-4 animate-shake">
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          )}

          <div className="mt-6 pt-6 border-t-2 border-blue-200">
            <button
              onClick={() => setManualMode(true)}
              className="w-full px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition"
            >
              ✏️ Enter Coordinates Manually
            </button>
          </div>

          <div className="mt-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
            <p className="text-sm text-yellow-800 font-medium">💡 Tips for Best GPS Accuracy:</p>
            <ul className="text-sm text-yellow-700 mt-2 space-y-1 ml-4 list-disc">
              <li>Go outdoors for better signal</li>
              <li>Ensure location services are enabled</li>
              <li>Wait a few seconds for GPS to stabilize</li>
            </ul>
          </div>
        </div>
      )}

      {/* Manual Input Card */}
      {manualMode && (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 shadow-lg border-2 border-purple-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Manual Coordinates
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Latitude (-90 to 90)
              </label>
              <input
                type="number"
                step="0.000001"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="e.g., 6.524379"
                className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Longitude (-180 to 180)
              </label>
              <input
                type="number"
                step="0.000001"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                placeholder="e.g., 3.379206"
                className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition font-mono"
              />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 animate-shake">
                <p className="text-red-700 font-medium">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleManualSubmit}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition"
              >
                ✓ Use Manual Coordinates
              </button>
              <button
                onClick={() => {
                  setManualMode(false);
                  setError('');
                }}
                className="px-6 py-3 bg-gray-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition"
              >
                ← Back to GPS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
