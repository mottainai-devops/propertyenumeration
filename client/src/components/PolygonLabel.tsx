/**
 * Polygon Label Component
 * Renders text labels at polygon centers using Leaflet DivIcon
 */

import { Marker } from 'react-leaflet';
import L from 'leaflet';
import type { BuildingPolygon } from '../models/BuildingPolygon';

interface PolygonLabelProps {
  polygon: BuildingPolygon;
  isSelected: boolean;
  onClick?: () => void;
}

/**
 * Format label text for a building polygon
 * Shows building ID and customer labels if available
 * e.g., "B001" or "B001-R1,R2,B1"
 */
function formatLabelText(polygon: BuildingPolygon): string {
  const baseText = polygon.buildingId || 'Unknown';
  
  if (polygon.customerLabels && polygon.customerLabels.length > 0) {
    return `${baseText}-${polygon.customerLabels}`;
  }
  
  return baseText;
}

/**
 * Get label color based on occupancy status
 * Green for occupied buildings (has customers), blue for empty
 */
function getLabelColor(polygon: BuildingPolygon, isSelected: boolean): string {
  if (isSelected) {
    return '#2196F3'; // Blue for selected
  }
  
  if (polygon.customerLabels && polygon.customerLabels.length > 0) {
    return '#4CAF50'; // Green for occupied
  }
  
  return '#2196F3'; // Blue for empty
}

export default function PolygonLabel({ polygon, isSelected, onClick }: PolygonLabelProps) {
  const labelText = formatLabelText(polygon);
  const labelColor = getLabelColor(polygon, isSelected);
  
  // Create custom DivIcon for label
  const labelIcon = L.divIcon({
    className: 'polygon-label',
    html: `
      <div style="
        background: ${labelColor};
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: bold;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.3);
        cursor: pointer;
        user-select: none;
        transform: translate(-50%, -50%);
      ">
        ${labelText}
      </div>
    `,
    iconSize: [0, 0], // Size handled by CSS
    iconAnchor: [0, 0], // Anchor handled by CSS transform
  });

  return (
    <Marker
      position={[polygon.centerLat, polygon.centerLon]}
      icon={labelIcon}
      eventHandlers={{
        click: (e) => {
          e.originalEvent.stopPropagation(); // Prevent map click
          onClick?.();
        },
      }}
    />
  );
}
