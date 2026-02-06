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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-teal-500 text-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Property Enumeration</h1>
            <p className="text-blue-100 text-sm mt-1">Building Location</p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              window.location.reload();
            }}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all duration-200 backdrop-blur-sm"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm animate-shake">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-800 text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* GPS Location Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-blue-500 to-teal-400 p-4">
            <div className="flex items-center text-white">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <h2 className="text-lg font-bold">Current GPS Location</h2>
                <p className="text-blue-100 text-xs">Tap refresh to get your current position</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <svg className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium mt-4">Getting your location...</p>
                <p className="text-gray-400 text-sm mt-1">This may take a few seconds</p>
              </div>
            ) : currentLocation ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Latitude</p>
                    <p className="text-2xl font-bold text-blue-900">{currentLocation.lat.toFixed(6)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-xl border border-teal-200">
                    <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">Longitude</p>
                    <p className="text-2xl font-bold text-teal-900">{currentLocation.lng.toFixed(6)}</p>
                  </div>
                </div>

                {locationAccuracy !== null && (
                  <div className={`flex items-center p-3 rounded-lg ${
                    locationAccuracy <= 20 ? 'bg-green-50 border border-green-200' :
                    locationAccuracy <= 50 ? 'bg-yellow-50 border border-yellow-200' :
                    'bg-orange-50 border border-orange-200'
                  }`}>
                    <svg className={`w-5 h-5 mr-2 ${
                      locationAccuracy <= 20 ? 'text-green-600' :
                      locationAccuracy <= 50 ? 'text-yellow-600' :
                      'text-orange-600'
                    }`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${
                        locationAccuracy <= 20 ? 'text-green-800' :
                        locationAccuracy <= 50 ? 'text-yellow-800' :
                        'text-orange-800'
                      }`}>
                        Accuracy: ±{locationAccuracy.toFixed(1)} meters
                      </p>
                      <p className={`text-xs ${
                        locationAccuracy <= 20 ? 'text-green-600' :
                        locationAccuracy <= 50 ? 'text-yellow-600' :
                        'text-orange-600'
                      }`}>
                        {locationAccuracy <= 20 ? 'Excellent signal' :
                         locationAccuracy <= 50 ? 'Good signal' :
                         'Fair signal - consider moving outdoors'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={getCurrentLocation}
                    className="flex-1 flex items-center justify-center px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                  <button
                    onClick={handleUseCurrentLocation}
                    className="flex-1 flex items-center justify-center px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Use Location
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-gray-600 font-medium mb-2">No location data yet</p>
                <p className="text-gray-400 text-sm mb-4">Tap the button below to get your current GPS location</p>
                <button
                  onClick={getCurrentLocation}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Get GPS Location
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center">
          <div className="flex-1 border-t-2 border-gray-200"></div>
          <span className="px-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">Or</span>
          <div className="flex-1 border-t-2 border-gray-200"></div>
        </div>

        {/* Manual Input Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4">
            <div className="flex items-center text-white">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <div>
                <h2 className="text-lg font-bold">Enter Coordinates Manually</h2>
                <p className="text-purple-100 text-xs">Input latitude and longitude directly</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Latitude <span className="text-gray-400 font-normal">(-90 to 90)</span>
              </label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g., 6.524379"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 text-lg font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Longitude <span className="text-gray-400 font-normal">(-180 to 180)</span>
              </label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g., 3.379206"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 text-lg font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Address <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., 123 Main Street, Lagos"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200"
              />
            </div>

            <button
              onClick={handleUseManualCoordinates}
              className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Use Manual Coordinates
            </button>
          </div>
        </div>

        {/* Tips Card */}
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-400 p-4 rounded-r-xl shadow-sm">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-amber-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-900 mb-1">💡 Tips for Best GPS Accuracy</p>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• Move outdoors with a clear view of the sky</li>
                <li>• Wait 30-60 seconds for GPS to acquire satellites</li>
                <li>• Indoor GPS may be less accurate (±50+ meters)</li>
                <li>• Use manual input if GPS signal is weak</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Add custom animations */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
