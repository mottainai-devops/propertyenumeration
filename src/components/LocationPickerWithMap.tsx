import { useState, useEffect } from 'react';
import { MapErrorBoundary } from './MapErrorBoundary';
import { EnhancedLocationMapWithPolygons } from './EnhancedLocationMapWithPolygons';
import SimpleLocationPicker from './SimpleLocationPicker';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface LocationPickerWithMapProps {
  onLocationSelect: (location: LocationData) => void;
}

export default function LocationPickerWithMap({ onLocationSelect }: LocationPickerWithMapProps) {
  const [location, setLocation] = useState<LocationData>({ latitude: 6.5244, longitude: 3.3792 }); // Default: Lagos
  const [useMap, setUseMap] = useState(true);


  // Get initial GPS location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (error) => {
          console.error('Error getting GPS location:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    }
  }, []);

  const handleMapLocationChange = (lat: number, lng: number) => {
    const newLocation = { latitude: lat, longitude: lng };
    setLocation(newLocation);
    onLocationSelect(newLocation);
  };

  const handleSimpleLocationSelect = (locationData: LocationData) => {
    setLocation(locationData);
    onLocationSelect(locationData);
  };

  // Fallback component when map fails
  const MapFallback = () => (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Map visualization unavailable.</strong> Using GPS location picker instead.
        </p>
      </div>
      <SimpleLocationPicker onLocationSelect={handleSimpleLocationSelect} />
    </div>
  );

  return (
    <div className="w-full">
      {useMap ? (
        <MapErrorBoundary fallback={<MapFallback />}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                📍 <strong>Drag the marker</strong> to adjust location or use GPS button below
              </p>
            </div>
            <EnhancedLocationMapWithPolygons
              latitude={location.latitude}
              longitude={location.longitude}
              onLocationChange={handleMapLocationChange}
              onBuildingSelected={(building) => {
                console.log('Building selected:', building.buildingId, building.address);
              }}
            />
            <button
              onClick={() => setUseMap(false)}
              className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
            >
              Switch to GPS-only mode
            </button>
          </div>
        </MapErrorBoundary>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-sm text-gray-700">
              Using GPS-only mode
            </p>
          </div>
          <SimpleLocationPicker onLocationSelect={handleSimpleLocationSelect} />
          <button
            onClick={() => setUseMap(true)}
            className="w-full px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
          >
            Switch to map view
          </button>
        </div>
      )}
    </div>
  );
}
