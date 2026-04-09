import { useState, useEffect } from 'react';
import { getLotCenter } from '../services/arcgisService';
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
  /** MongoDB lot code for the active session (e.g. "LOT-242") — enables the
   *  fast two-phase progressive polygon loader. */
  lotCode?: string;
}

export default function LocationPickerWithMap({
  onLocationSelect,
  surveyedBuildingIds = new Set(),
  lotCode,
}: LocationPickerWithMapProps) {
  // If a lotCode is provided, use its known geographic center as the initial map position.
  // This ensures the map opens on the correct area (e.g. Ikeja GRA for LOT-6) regardless
  // of the device GPS position, which may be inaccurate or match the Lagos fallback.
  const lotCenter = lotCode ? getLotCenter(lotCode) : null;
  const [location, setLocation] = useState<LocationData>(
    lotCenter
      ? { latitude: lotCenter[0], longitude: lotCenter[1] }
      : { latitude: 6.5244, longitude: 3.3792 }
  );
  const [useMap, setUseMap] = useState(true);

  // Get device GPS location — only override the initial lot-center if GPS is available
  // and the user is actually within ~10km of the lot center (prevents wrong-area centering).
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const gpsLat = pos.coords.latitude;
          const gpsLon = pos.coords.longitude;
          // If we have a lot center, only use GPS if it is within ~10km of the lot
          if (lotCenter) {
            const dlat = gpsLat - lotCenter[0];
            const dlon = gpsLon - lotCenter[1];
            const distKm = Math.sqrt(dlat * dlat + dlon * dlon) * 111; // rough km
            if (distKm > 10) {
              console.log(`[LocationPicker] GPS (${gpsLat.toFixed(4)}, ${gpsLon.toFixed(4)}) is ${distKm.toFixed(1)}km from lot center — keeping lot center`);
              return; // GPS is too far from the lot; keep the lot center
            }
          }
          setLocation({
            latitude: gpsLat,
            longitude: gpsLon,
            accuracy: pos.coords.accuracy,
          });
        },
        (error) => console.error('Error getting GPS location:', error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMapLocationChange = (lat: number, lng: number) => {
    setLocation({ latitude: lat, longitude: lng });
  };

  const handleBuildingSelected = (building: BuildingPolygon) => {
    console.log('[LocationPicker] Building selected:', building.buildingId);
    const b = building as any;
    // If the map bottom sheet chose an existing registration, pass it through immediately
    if (b._existingRegistrationId) {
      onLocationSelect(
        { latitude: building.centerLat, longitude: building.centerLon },
        {
          buildingId: building.buildingId,
          address: building.address,
          businessName: building.businessName,
          zone: building.zone,
          _existingRegistrationId: b._existingRegistrationId,
          _existingRegistration: b._existingRegistration,
        } as any
      );
      return;
    }
    // New registration — proceed directly
    onLocationSelect(
      { latitude: building.centerLat, longitude: building.centerLon },
      {
        buildingId: building.buildingId,
        address: building.address,
        businessName: building.businessName,
        zone: building.zone,
      }
    );
  };

  const handleSimpleLocationSelect = (locationData: LocationData) => {
    setLocation(locationData);
    onLocationSelect(locationData);
  };

  const MapFallback = () => (
    <div className="space-y-4 p-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Map visualization unavailable.</strong> Using GPS location picker instead.
        </p>
      </div>
      <SimpleLocationPicker onLocationSelect={handleSimpleLocationSelect} />
    </div>
  );

  return (
    // h-full so this component fills the flex-1 container from App.tsx
    <div className="w-full h-full flex flex-col">
      {useMap ? (
        <MapErrorBoundary fallback={<MapFallback />}>
          <EnhancedLocationMapWithPolygons
            latitude={location.latitude}
            longitude={location.longitude}
            onLocationChange={handleMapLocationChange}
            onBuildingSelected={handleBuildingSelected}
            surveyedBuildingIds={surveyedBuildingIds}
            lotCode={lotCode}
          />
        </MapErrorBoundary>
      ) : (
        <div className="space-y-4 p-4">
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
