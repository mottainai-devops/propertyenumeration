import { useState, useEffect } from 'react';
import { MapErrorBoundary } from './MapErrorBoundary';
import { EnhancedLocationMapWithPolygons } from './EnhancedLocationMapWithPolygons';
import SimpleLocationPicker from './SimpleLocationPicker';
import type { BuildingPolygon } from '../models/BuildingPolygon';

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
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingPolygon | null>(null);

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

  // Called when the user drags the marker or the map location changes
  // Does NOT navigate to form - just updates the stored location
  const handleMapLocationChange = (lat: number, lng: number) => {
    setLocation({ latitude: lat, longitude: lng });
    // Clear building selection if user moves the marker manually
    // (only clear if the new position is far from the selected building center)
    if (selectedBuilding) {
      const dist = Math.sqrt(
        Math.pow(selectedBuilding.centerLat - lat, 2) +
        Math.pow(selectedBuilding.centerLon - lng, 2)
      );
      // If moved more than ~50m away from building center, clear selection
      if (dist * 111000 > 50) {
        setSelectedBuilding(null);
      }
    }
  };

  // Called when user taps a polygon - shows confirmation card, does NOT navigate
  const handleBuildingSelected = (building: BuildingPolygon) => {
    console.log('[LocationPicker] Building selected from polygon tap:', building.buildingId);
    console.log('[LocationPicker] Building data:', {
      buildingId: building.buildingId,
      address: building.address,
      businessName: building.businessName,
      zone: building.zone,
    });
    setSelectedBuilding(building);
    setLocation({ latitude: building.centerLat, longitude: building.centerLon });
  };

  // Called when user presses "Proceed with this Building" - navigates to form WITH building data
  const handleProceedWithBuilding = () => {
    if (!selectedBuilding) return;

    const locationData: LocationData = {
      latitude: selectedBuilding.centerLat,
      longitude: selectedBuilding.centerLon,
    };
    const buildingData = {
      buildingId: selectedBuilding.buildingId,
      address: selectedBuilding.address,
      businessName: selectedBuilding.businessName,
      zone: selectedBuilding.zone,
    };

    console.log('[LocationPicker] Proceeding with building:', buildingData);
    onLocationSelect(locationData, buildingData);
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
              onBuildingSelected={handleBuildingSelected}
            />

            {/* Building Selection Confirmation Card */}
            {selectedBuilding ? (
              <div className="mt-2 bg-green-50 border-2 border-green-500 rounded-xl p-4 shadow-md">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🏢</span>
                    <h3 className="text-base font-bold text-green-900">Building Selected</h3>
                  </div>
                  <button
                    onClick={() => setSelectedBuilding(null)}
                    className="text-green-600 hover:text-green-800 font-bold text-lg leading-none"
                    aria-label="Clear selection"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1 text-sm text-green-800 mb-4">
                  <div className="flex gap-2">
                    <span className="font-semibold w-24 shrink-0">Building ID:</span>
                    <span className="font-mono font-bold text-green-900">{selectedBuilding.buildingId}</span>
                  </div>
                  {selectedBuilding.address && (
                    <div className="flex gap-2">
                      <span className="font-semibold w-24 shrink-0">Address:</span>
                      <span>{selectedBuilding.address}</span>
                    </div>
                  )}
                  {selectedBuilding.businessName && (
                    <div className="flex gap-2">
                      <span className="font-semibold w-24 shrink-0">Business:</span>
                      <span>{selectedBuilding.businessName}</span>
                    </div>
                  )}
                  {selectedBuilding.zone && (
                    <div className="flex gap-2">
                      <span className="font-semibold w-24 shrink-0">Zone:</span>
                      <span>{selectedBuilding.zone}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleProceedWithBuilding}
                  className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 active:bg-green-800 transition text-base"
                >
                  ✓ Proceed with this Building
                </button>
              </div>
            ) : (
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
