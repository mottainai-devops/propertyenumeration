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
  onLocationSelect: (location: LocationData, buildingData?: {
    buildingId: string;
    address?: string;
    businessName?: string;
    zone?: string;
  }) => void;
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

  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);

  const handleMapLocationChange = (lat: number, lng: number) => {
    const newLocation = { latitude: lat, longitude: lng };
    setLocation(newLocation);
    // If no building is selected, just pass location
    if (!selectedBuilding) {
      onLocationSelect(newLocation);
    }
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
                setSelectedBuilding(building);
              }}
            />
            
            {/* Building Selection Confirmation */}
            {selectedBuilding && (
              <div className="mt-4 bg-green-50 border-2 border-green-500 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-green-900 mb-2">🏢 Building Selected</h3>
                    <div className="space-y-1 text-sm text-green-800">
                      <p><strong>Building ID:</strong> {selectedBuilding.buildingId}</p>
                      {selectedBuilding.address && <p><strong>Address:</strong> {selectedBuilding.address}</p>}
                      {selectedBuilding.businessName && <p><strong>Business:</strong> {selectedBuilding.businessName}</p>}
                      {selectedBuilding.zone && <p><strong>Zone:</strong> {selectedBuilding.zone}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedBuilding(null)}
                    className="ml-4 text-green-600 hover:text-green-800 font-bold"
                  >
                    ✕
                  </button>
                </div>
                <button
                  onClick={() => {
                    const locationData = {
                      latitude: selectedBuilding.centerLat,
                      longitude: selectedBuilding.centerLon,
                    };
                    const buildingData = {
                      buildingId: selectedBuilding.buildingId,
                      address: selectedBuilding.address,
                      businessName: selectedBuilding.businessName,
                      zone: selectedBuilding.zone,
                    };
                    onLocationSelect(locationData, buildingData);
                  }}
                  className="w-full mt-4 px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition"
                >
                  ✓ Proceed with this Building
                </button>
              </div>
            )}
            {!selectedBuilding && (
              <button
                onClick={() => setUseMap(false)}
                className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
              >
                Switch to GPS-only mode
              </button>
            )}
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
