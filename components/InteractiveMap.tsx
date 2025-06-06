import React, { useMemo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ProcessedPole, Coordinate, MatchTier } from '../types';
import { MAP_MARKER_COLORS } from '../constants';

// Fix for default markers in Leaflet with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface InteractiveMapProps {
  processedPoles: ProcessedPole[];
  onPoleClick: (pole: ProcessedPole) => void;
  selectedPoleId?: string | null;
}

// Custom colored marker icons
const createCustomIcon = (color: string, isSelected: boolean = false) => {
  const size = isSelected ? 16 : 12;
  const border = isSelected ? '3px solid #fbbf24' : '2px solid white'; // Gold border for selected
  const shadow = isSelected ? '0 0 8px rgba(251, 191, 36, 0.8)' : '0 0 4px rgba(0,0,0,0.5)';
  
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: ${border}; box-shadow: ${shadow}; z-index: ${isSelected ? 1000 : 1};"></div>`,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Component to fit bounds when poles change
const MapBounds: React.FC<{ poles: ProcessedPole[] }> = ({ poles }) => {
  const map = useMap();

  useEffect(() => {
    if (poles.length === 0) return;

    const validPoles = poles.filter(pole => pole.mapCoords);
    if (validPoles.length === 0) return;

    if (validPoles.length === 1) {
      // For single pole, center the map
      const pole = validPoles[0];
      if (pole.mapCoords) {
        map.setView([pole.mapCoords.lat, pole.mapCoords.lon], 16);
      }
    } else {
      // For multiple poles, fit bounds
      const bounds = L.latLngBounds(
        validPoles.map(pole => [pole.mapCoords!.lat, pole.mapCoords!.lon] as [number, number])
      );
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [poles, map]);

  return null;
};

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ processedPoles, onPoleClick, selectedPoleId }) => {
  const [mapKey, setMapKey] = useState(0);

  // Get valid poles with coordinates
  const validPoles = useMemo(() => {
    return processedPoles.filter(pole => pole.mapCoords);
  }, [processedPoles]);

  // Calculate center and zoom
  const { center, zoom } = useMemo(() => {
    if (validPoles.length === 0) {
      return { center: [39.8283, -98.5795] as [number, number], zoom: 4 }; // Center of USA
    }

    if (validPoles.length === 1) {
      const pole = validPoles[0];
      return { 
        center: [pole.mapCoords!.lat, pole.mapCoords!.lon] as [number, number], 
        zoom: 16 
      };
    }

    // Calculate center for multiple poles
    const latSum = validPoles.reduce((sum, pole) => sum + pole.mapCoords!.lat, 0);
    const lonSum = validPoles.reduce((sum, pole) => sum + pole.mapCoords!.lon, 0);
    
    return {
      center: [latSum / validPoles.length, lonSum / validPoles.length] as [number, number],
      zoom: 12
    };
  }, [validPoles]);

  // Force map re-render when poles change significantly
  useEffect(() => {
    setMapKey(prev => prev + 1);
  }, [processedPoles.length]);

  if (processedPoles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 bg-slate-800 rounded-lg">
        Map will appear here once data is processed.
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-800 rounded-lg shadow-inner relative overflow-hidden">
      <MapContainer
        key={mapKey}
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBounds poles={validPoles} />
        
        {validPoles.map(pole => (
          <Marker
            key={pole.id}
            position={[pole.mapCoords!.lat, pole.mapCoords!.lon]}
            icon={createCustomIcon(MAP_MARKER_COLORS[pole.matchTier], selectedPoleId === pole.id)}
            eventHandlers={{
              click: () => onPoleClick(pole),
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold text-slate-800">
                  {pole.matchTier.replace('_', ' ')}
                </div>
                <div className="text-slate-600">
                  ID: {pole.spida?.scid || pole.katapult?.scid || pole.spida?.poleNum || pole.katapult?.poleNum || 'Unknown'}
                </div>
                {pole.spida && (
                  <div className="text-slate-600">
                    SPIDA: {pole.spida.scid || pole.spida.poleNum}
                  </div>
                )}
                {pole.katapult && (
                  <div className="text-slate-600">
                    Katapult: {pole.katapult.scid || pole.katapult.poleNum}
                  </div>
                )}
                <div className="text-slate-600 text-xs mt-1">
                  Lat: {pole.mapCoords!.lat.toFixed(6)}, Lon: {pole.mapCoords!.lon.toFixed(6)}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 p-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg text-xs text-slate-700 z-[1000]">
        <h4 className="font-semibold mb-2 text-slate-800">Legend:</h4>
        {Object.entries(MAP_MARKER_COLORS).map(([tier, color]) => (
          <div key={tier} className="flex items-center space-x-2 mb-1">
            <span 
              className="w-3 h-3 rounded-full border border-white shadow-sm" 
              style={{ backgroundColor: color }}
            ></span>
            <span className="capitalize">{tier.replace('_', ' ').toLowerCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
