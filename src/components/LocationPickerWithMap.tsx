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
  /** Building IDs already surveyed this session */
  surveyedBuildingIds?: Set<string>;
}

export default function LocationPickerWithMap({
  onLocationSelect,
  surveyedBuildingIds = new Set(),
}: LocationPickerWithMapProps) {
  const [location, setLocation] = useState<LocationData>({ latitude: 6.5244, longitude: 3.3792 });
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
        (error) => console.error('Error getting GPS location:', error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []);

  const handleMapLocationChange = (lat: number, lng: number) => {
    setLocation({ latitude: lat, longitude: lng });
    if (selectedBuilding) {
      const dist = Math.sqrt(
        Math.pow(selectedBuilding.centerLat - lat, 2) +
        Math.pow(selectedBuilding.centerLon - lng, 2)
      );
      if (dist * 111000 > 50) setSelectedBuilding(null);
    }
  };

  const handleBuildingSelected = (building: BuildingPolygon) => {
    console.log('[LocationPicker] Building selected:', building.buildingId);
    setSelectedBuilding(building);
    setLocation({ latitude: building.centerLat, longitude: building.centerLon });
  };

  const handleProceedWithBuilding = () => {
    if (!selectedBuilding) return;
    onLocationSelect(
      { latitude: selectedBuilding.centerLat, longitude: selectedBuilding.centerLon },
      {
        buildingId: selectedBuilding.buildingId,
        address: selectedBuilding.address,
        businessName: selectedBuilding.businessName,
        zone: selectedBuilding.zone,
      }
    );
  };

  const handleSimpleLocationSelect = (locationData: LocationData) => {
    setLocation(locationData);
    onLocationSelect(locationData);
  };

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
          <div className="space-y-3">
            <EnhancedLocationMapWithPolygons
              latitude={location.latitude}
              longitude={location.longitude}
              onLocationChange={handleMapLocationChange}
              onBuildingSelected={handleBuildingSelected}
              surveyedBuildingIds={surveyedBuildingIds}
            />

            {/* Building Selection Confirmation Card */}
            {selectedBuilding ? (
              <div className="bg-green-50 border-2 border-green-500 rounded-xl p-4 shadow-md">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🏢</span>
                    <h3 className="text-base font-bold text-green-900">
                      {surveyedBuildingIds.has(selectedBuilding.buildingId)
                        ? '✓ Already Surveyed'
                        : 'Building Selected'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedBuilding(null)}
                    className="text-green-600 hover:text-green-800 font-bold text-lg leading-none"
                    aria-label="Clear selection"
                  >
                    ✕
                  </button>
                </div>

                {surveyedBuildingIds.has(selectedBuilding.buildingId) && (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 mb-3 text-xs text-amber-800 font-medium">
                    ⚠️ This building was already registered this session. You can still proceed to update it.
                  </div>
                )}

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
                  {selectedBuilding.businessName &&
                    selectedBuilding.businessName !== 'None' &&
                    selectedBuilding.businessName !== 'none' && (
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
                className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Switch to GPS-only mode
              </button>
            )}
          </div>
        </MapErrorBoundary>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-sm text-gray-700">Using GPS-only mode</p>
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
