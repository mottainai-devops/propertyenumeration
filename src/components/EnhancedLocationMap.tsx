import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue - use local bundled icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet-icons/marker-icon-2x.png',
  iconUrl: '/leaflet-icons/marker-icon.png',
  shadowUrl: '/leaflet-icons/marker-shadow.png',
});

interface EnhancedLocationMapProps {
  latitude: number;
  longitude: number;
  onLocationChange: (lat: number, lng: number) => void;
  polygons?: Array<{
    id: string;
    coordinates: [number, number][];
    color?: string;
    label?: string;
  }>;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  
  return null;
}

export function EnhancedLocationMap({
  latitude,
  longitude,
  onLocationChange,
  polygons = []
}: EnhancedLocationMapProps) {
  const [position, setPosition] = useState<[number, number]>([latitude, longitude]);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    setPosition([latitude, longitude]);
  }, [latitude, longitude]);

  const handleMarkerDragEnd = (event: L.DragEndEvent) => {
    const marker = event.target;
    const newPos = marker.getLatLng();
    setPosition([newPos.lat, newPos.lng]);
    onLocationChange(newPos.lat, newPos.lng);
  };

  if (mapError) {
    return (
      <div className="w-full h-64 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 font-semibold">Map failed to load</p>
          <p className="text-sm text-red-500 mt-2">{mapError}</p>
        </div>
      </div>
    );
  }

  try {
    return (
      <div className="w-full h-64 rounded-lg overflow-hidden border border-gray-200">
        <MapContainer
          center={position}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapUpdater center={position} />
          
          <Marker
            position={position}
            draggable={true}
            eventHandlers={{
              dragend: handleMarkerDragEnd,
            }}
          >
            <Popup>
              Current Location<br />
              Lat: {position[0].toFixed(6)}<br />
              Lng: {position[1].toFixed(6)}
            </Popup>
          </Marker>

          {polygons.map((polygon) => (
            <Polygon
              key={polygon.id}
              positions={polygon.coordinates}
              pathOptions={{
                color: polygon.color || '#3388ff',
                fillColor: polygon.color || '#3388ff',
                fillOpacity: 0.2,
              }}
            >
              {polygon.label && (
                <Popup>
                  {polygon.label}
                </Popup>
              )}
            </Polygon>
          ))}
        </MapContainer>
      </div>
    );
  } catch (error) {
    setMapError(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
