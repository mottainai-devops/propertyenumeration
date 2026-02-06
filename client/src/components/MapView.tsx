import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Geolocation } from '@capacitor/geolocation';

interface MapViewProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
}

export default function MapView({ onLocationSelect }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [marker, setMarker] = useState<google.maps.Marker | null>(null);
  const [, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Initialize Google Maps
  useEffect(() => {
    const loader = new Loader({
      apiKey: 'AIzaSyDT6p1kGrmkpYsk5Zwtjc6zo43FwTP4veA',
      version: 'weekly',
      libraries: ['places', 'geocoding'],
    });

    (loader as any).load().then(() => {
      if (mapRef.current) {
        const mapInstance = new google.maps.Map(mapRef.current, {
          center: { lat: 6.5244, lng: 3.3792 }, // Lagos, Nigeria
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        setMap(mapInstance);
        setLoading(false);

        // Add click listener
        mapInstance.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            handleMapClick(e.latLng.lat(), e.latLng.lng());
          }
        });
      }
    }).catch(() => {
      setError('Failed to load Google Maps');
      setLoading(false);
    });
  }, []);

  // Get current location
  const getCurrentLocation = async () => {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      setCurrentPosition({ lat, lng });

      if (map) {
        map.setCenter({ lat, lng });
        map.setZoom(18);
      }
    } catch (err) {
      setError('Unable to get your location');
    }
  };

  // Handle map click
  const handleMapClick = async (lat: number, lng: number) => {
    if (!map) return;

    // Remove existing marker
    if (marker) {
      marker.setMap(null);
    }

    // Add new marker
    const newMarker = new google.maps.Marker({
      position: { lat, lng },
      map,
      draggable: true,
    });

    setMarker(newMarker);

    // Reverse geocode to get address
    const geocoder = new google.maps.Geocoder();
    try {
      const response = await geocoder.geocode({ location: { lat, lng } });
      const address = response.results[0]?.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      
      onLocationSelect(lat, lng, address);
    } catch (err) {
      onLocationSelect(lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }

    // Update marker position on drag
    newMarker.addListener('dragend', async () => {
      const position = newMarker.getPosition();
      if (position) {
        const newLat = position.lat();
        const newLng = position.lng();
        
        try {
          const response = await geocoder.geocode({ location: { lat: newLat, lng: newLng } });
          const address = response.results[0]?.formatted_address || `${newLat.toFixed(6)}, ${newLng.toFixed(6)}`;
          
          onLocationSelect(newLat, newLng, address);
        } catch (err) {
          onLocationSelect(newLat, newLng, `${newLat.toFixed(6)}, ${newLng.toFixed(6)}`);
        }
      }
    });
  };

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg z-10">
          {error}
        </div>
      )}

      <div ref={mapRef} className="w-full h-full" />

      {/* My Location Button */}
      <button
        onClick={getCurrentLocation}
        className="absolute bottom-24 right-4 bg-white rounded-full p-4 shadow-lg hover:shadow-xl transition z-10"
        title="My Location"
      >
        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Instructions */}
      <div className="absolute top-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4 z-10">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">Tap on the map</span> to place a marker at the building location
        </p>
      </div>
    </div>
  );
}
