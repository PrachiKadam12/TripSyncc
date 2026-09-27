/**
 * TripWeatherMap.jsx — Leaflet-based geospatial map
 * Shows trip route (Mumbai → Delhi → Manali) with live weather risk markers.
 * Uses OpenStreetMap tiles (free, no API key).
 */

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CloudRain, Thermometer, Wind, Eye } from 'lucide-react';

// Fix default Leaflet marker icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const RISK_COLORS = {
  normal: '#22c55e',
  moderate: '#f59e0b',
  high: '#ef4444',
  severe: '#dc2626',
};

function createRiskIcon(riskLevel, label) {
  const color = RISK_COLORS[riskLevel] || RISK_COLORS.normal;
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background: ${color};
        color: white;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 11px;
        box-shadow: 0 3px 12px ${color}55;
        border: 3px solid white;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
      </div>
      <div style="
        position: absolute;
        bottom: -22px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        color: #16233D;
        padding: 2px 8px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        border: 1px solid ${color}33;
      ">${label}</div>
    `,
    iconSize: [36, 56],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

function FitBounds({ stops }) {
  const map = useMap();
  useEffect(() => {
    if (stops.length > 0) {
      const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [stops, map]);
  return null;
}

export default function TripWeatherMap({ stopsWithWeather = [], selectedLayer = 'weather' }) {
  const center = [26.5, 77.0]; // Center of India roughly between Mumbai and Manali

  const routePositions = stopsWithWeather.map((s) => [s.lat, s.lng]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-navy/10 shadow-card" style={{ height: '380px' }}>
      <MapContainer
        center={center}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds stops={stopsWithWeather} />

        {/* Trip Route Polyline */}
        {routePositions.length > 1 && (
          <Polyline
            positions={routePositions}
            pathOptions={{
              color: '#2563EB',
              weight: 3,
              dashArray: '8, 8',
              opacity: 0.7,
            }}
          />
        )}

        {/* City Markers with Weather Risk */}
        {stopsWithWeather.map((stop) => {
          const riskLevel = stop.riskLevel || 'normal';
          const icon = createRiskIcon(riskLevel, `${stop.city}\n${stop.date}`);

          return (
            <Marker key={stop.city} position={[stop.lat, stop.lng]} icon={icon}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{stop.city}</p>
                  <p style={{ fontSize: 12, color: '#5B6B85', marginBottom: 8 }}>{stop.date} · {stop.type}</p>
                  {stop.weather ? (
                    <div style={{ fontSize: 12 }}>
                      <p>🌡 {stop.weather.temperature}°C · {stop.weather.condition}</p>
                      <p>🌧 Rain: {stop.weather.precipitation || 0} mm/hr</p>
                      <p>💨 Wind: {stop.weather.windSpeed || 0} km/h</p>
                      <p>💧 Humidity: {stop.weather.humidity}%</p>
                      <p style={{ marginTop: 4, fontWeight: 600, color: RISK_COLORS[riskLevel] }}>
                        Risk: {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}
                      </p>
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: '#8A97AD' }}>Weather data unavailable</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Legend */}
      <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-navy/5">
        <div className="flex flex-wrap gap-3 text-[11px] font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Normal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Moderate Risk
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> High Risk
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-700" /> Severe Risk
          </span>
        </div>
      </div>

      {/* Layer Toggle */}
      <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl p-2.5 shadow-lg border border-navy/5 space-y-1.5">
        {[
          { icon: '🌦', label: 'Weather Radar' },
          { icon: '🌡', label: 'Temperature' },
          { icon: '🌧', label: 'Rainfall' },
          { icon: '💨', label: 'Wind' },
          { icon: '📱', label: 'Social Signals' },
        ].map((layer) => (
          <div key={layer.label} className="flex items-center gap-2 text-[11px] font-medium text-navy cursor-pointer hover:text-primary transition">
            <span>{layer.icon}</span>
            <span>{layer.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
