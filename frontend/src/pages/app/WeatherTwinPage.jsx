import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CloudRain,
  Thermometer,
  Wind,
  ShieldAlert,
  Sliders,
  TrendingUp,
  Activity,
  MapPin,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  Clock,
  Building,
  Car,
  Compass,
  CheckCircle2,
} from 'lucide-react';
import { useTrip } from '../../context/TripContext.jsx';
import TripWeatherMap from '../../components/twin/TripWeatherMap.jsx';
import {
  fetchSocialSignals,
  getFallbackSocialSignals,
} from '../../services/socialSignalService.js';
import {
  getItineraryWeatherAlerts,
} from '../../services/weatherAlertService.js';
import {
  fetchAllStopsWeather,
  simulateImpact,
  buildLiveSimulation,
  getStopRiskLevel,
} from '../../services/weatherTwinService.js';
import { getTripNews, formatNewsTime } from '../../services/newsService.js';

export default function WeatherTwinPage() {
  const { activeTrip, realTrips } = useTrip();
  const [loading, setLoading] = useState(true);
  const [stopsWithWeather, setStopsWithWeather] = useState([]);
  const [socialSignals, setSocialSignals] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [newsArticles, setNewsArticles] = useState([]);
  const [scenario, setScenario] = useState({
    rainfall: 0,
    temperature: 20,
    stormDuration: 0,
    floodRisk: 'Low',
    windSpeed: 0,
    location: '',
  });
  const [simulation, setSimulation] = useState(null);

  // Load initial weather & data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Build trip stops from real trip data
        const tripStops = [];
        if (activeTrip?.route && Array.isArray(activeTrip.route)) {
          activeTrip.route.forEach((city, i) => {
            tripStops.push({
              city,
              type: i === 0 ? 'origin' : i === activeTrip.route.length - 1 ? 'destination' : 'transit',
            });
          });
        }
        if (activeTrip?.origin_city) tripStops.push({ city: activeTrip.origin_city, type: 'origin' });
        if (activeTrip?.destination_city) tripStops.push({ city: activeTrip.destination_city, type: 'destination' });
        if (activeTrip?.bookings) {
          activeTrip.bookings.forEach((b) => {
            if (b.origin_name) tripStops.push({ city: b.origin_name, type: 'booking' });
            if (b.destination_name) tripStops.push({ city: b.destination_name, type: 'booking' });
          });
        }

        const stops = await fetchAllStopsWeather(tripStops.length > 0 ? tripStops : null);
        const formattedStops = stops.map((s) => ({
          ...s,
          riskLevel: getStopRiskLevel(s),
        }));
        setStopsWithWeather(formattedStops);

        // Build live simulation
        const sim = buildLiveSimulation(formattedStops);
        setSimulation(sim);
        if (sim.scenarioParams) {
          setScenario(sim.scenarioParams);
        }

        // Fetch social signals for destination
        const destCity = formattedStops.find((s) => s.type === 'destination')?.city || 'Manali';
        try {
          const signals = await fetchSocialSignals(destCity);
          if (signals && signals.length > 0) {
            setSocialSignals(signals);
          } else {
            setSocialSignals(getFallbackSocialSignals(destCity));
          }
        } catch {
          setSocialSignals(getFallbackSocialSignals(destCity));
        }

        // Fetch weather alerts
        try {
          const res = await getItineraryWeatherAlerts([], formattedStops);
          setAlerts(res?.activeAlerts || []);
        } catch {
          setAlerts([]);
        }

        // Fetch live news for trip
        if (activeTrip?.id) {
          try {
            const newsData = await getTripNews(activeTrip.id, { hours: 24, limit: 10 });
            setNewsArticles(newsData?.articles || []);
          } catch {
            setNewsArticles([]);
          }
        }
      } catch (err) {
        console.error('[WeatherTwinPage] Initialization error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [activeTrip?.id]);

  // Update simulation whenever sliders change
  const handleScenarioChange = (key, value) => {
    const updated = { ...scenario, [key]: value };
    setScenario(updated);
    const newSim = simulateImpact(updated);
    setSimulation(newSim);
  };

  const resetScenario = () => {
    const liveSim = buildLiveSimulation(stopsWithWeather);
    setSimulation(liveSim);
    if (liveSim.scenarioParams) {
      setScenario(liveSim.scenarioParams);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* ── Top Hero Header ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy via-navy/95 to-primary/90 text-white p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-accent-cyan">
              <Activity className="w-4 h-4 animate-pulse" />
              <span>Digital Twin Engine · Real-Time Resilience</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
              Weather-Driven Digital Twin
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl">
              Simulating continuous cascading operational impacts across your trip (Mumbai → Delhi → Manali) under dynamic weather conditions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Open-Meteo Stream
            </span>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition backdrop-blur-md border border-white/15"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Twin
            </button>
          </div>
        </div>

        {/* Abstract Background Accents */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-accent-cyan/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-64 h-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      </div>

      {/* ── Geospatial Map View ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-navy">Trip Geospatial Weather Map</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Route: Mumbai → Delhi → Manali</span>
        </div>
        <TripWeatherMap stopsWithWeather={stopsWithWeather} />
      </div>

      {/* ── Live Disruption Signals (Weather + News) ── */}
      {(alerts.length > 0 || newsArticles.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-navy">Live Disruption Signals</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.slice(0, 2).map((alert) => (
              <div key={alert.id} className="bg-white rounded-xl border border-navy/10 p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <span className="text-lg">🌧</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold text-navy truncate">{alert.title}</p>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {alert.location} · {alert.condition} · {alert.temperature}°C
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Risk: <span className="font-semibold text-amber-600">{alert.severity?.toUpperCase()}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">Source: Open-Meteo</p>
                  </div>
                </div>
              </div>
            ))}
            {newsArticles.filter((a) => a.disruption?.isDisruption).slice(0, 2).map((article) => (
              <div key={article.id} className="bg-white rounded-xl border border-navy/10 p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <span className="text-lg">📰</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-navy truncate">{article.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {article.location?.name || article.matchedLocation || 'Unknown location'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Type: <span className="font-semibold text-rose-600">{article.disruption?.type}</span>
                      {' · '}Severity: <span className="font-semibold text-amber-600">{article.disruption?.severity}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Source: {article.source?.name} · {formatNewsTime(article.publishedAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Live Weather Summary ── */}
      {stopsWithWeather.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CloudRain className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-navy">Live Weather — Trip Stops</h2>
            </div>
            <span className="text-xs text-slate-500">
              Updated: {stopsWithWeather[0]?.weather?.fetchedAt
                ? new Date(stopsWithWeather[0].weather.fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                : 'Just now'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stopsWithWeather.map((stop, i) => {
              const w = stop.weather;
              const risk = stop.risk;
              return (
                <div key={i} className="bg-white rounded-xl border border-navy/10 p-4 shadow-card">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold text-navy">{stop.city}</p>
                      <p className="text-[11px] text-slate-500 capitalize">{stop.type}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${
                      risk?.level === 'SEVERE' ? 'bg-rose-50 text-rose-700 ring-rose-100' :
                      risk?.level === 'HIGH' ? 'bg-rose-50 text-rose-700 ring-rose-100' :
                      risk?.level === 'MODERATE' ? 'bg-amber-50 text-amber-700 ring-amber-100' :
                      'bg-emerald-50 text-emerald-700 ring-emerald-100'
                    }`}>
                      {risk?.level || 'LOW'}
                    </span>
                  </div>
                  {w ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                        <span className="font-semibold">{w.temperature ?? '--'}°C</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                        <span className="font-semibold">{w.precipitation ?? 0} mm</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Wind className="w-3.5 h-3.5 text-teal-500" />
                        <span className="font-semibold">{w.windSpeed ?? '--'} km/h</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <ShieldAlert className="w-3.5 h-3.5 text-purple-500" />
                        <span className="font-semibold">{w.humidity ?? '--'}%</span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-slate-400">Weather data unavailable</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main Interactive Section: Grid Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: What-If Scenario Simulator (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-navy/10 shadow-card space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-navy text-base">What-If Weather Simulator</h3>
                  <p className="text-xs text-slate-500">Adjust parameters to simulate future disruptions</p>
                </div>
              </div>
              <button
                onClick={resetScenario}
                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
              >
                Reset to Live
              </button>
            </div>

            {/* Slider 1: Rainfall */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-navy">
                  <CloudRain className="w-4 h-4 text-blue-500" /> Rainfall Intensity
                </span>
                <span className="text-primary font-bold">{scenario.rainfall} mm/hr</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={scenario.rainfall}
                onChange={(e) => handleScenarioChange('rainfall', parseFloat(e.target.value))}
                className="w-full accent-primary h-2 bg-slate-100 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0 mm (Clear)</span>
                <span>15 mm (Heavy)</span>
                <span>50 mm (Torrential)</span>
              </div>
            </div>

            {/* Slider 2: Temperature */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-navy">
                  <Thermometer className="w-4 h-4 text-amber-500" /> Temperature
                </span>
                <span className="text-amber-600 font-bold">{scenario.temperature}°C</span>
              </div>
              <input
                type="range"
                min="-5"
                max="40"
                value={scenario.temperature}
                onChange={(e) => handleScenarioChange('temperature', parseFloat(e.target.value))}
                className="w-full accent-amber-500 h-2 bg-slate-100 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>-5°C (Frost)</span>
                <span>20°C (Mild)</span>
                <span>40°C (Extreme Heat)</span>
              </div>
            </div>

            {/* Slider 3: Wind Speed */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-navy">
                  <Wind className="w-4 h-4 text-teal-500" /> Wind Speed
                </span>
                <span className="text-teal-600 font-bold">{scenario.windSpeed} km/h</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={scenario.windSpeed}
                onChange={(e) => handleScenarioChange('windSpeed', parseFloat(e.target.value))}
                className="w-full accent-teal-500 h-2 bg-slate-100 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0 km/h (Calm)</span>
                <span>40 km/h (High)</span>
                <span>100 km/h (Gale)</span>
              </div>
            </div>

            {/* Slider 4: Storm Duration */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-navy">
                  <Clock className="w-4 h-4 text-purple-500" /> Sustained Storm Duration
                </span>
                <span className="text-purple-600 font-bold">{scenario.stormDuration} hrs</span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                value={scenario.stormDuration}
                onChange={(e) => handleScenarioChange('stormDuration', parseFloat(e.target.value))}
                className="w-full accent-purple-500 h-2 bg-slate-100 rounded-lg cursor-pointer"
              />
            </div>

            {/* Dropdown: Flood Risk */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-navy flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-500" /> Regional Flood / Landslide Risk Level
              </label>
              <select
                value={scenario.floodRisk}
                onChange={(e) => handleScenarioChange('floodRisk', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="Low">Low Risk (Normal drainage)</option>
                <option value="Moderate">Moderate Risk (Localized waterlogging)</option>
                <option value="High">High Risk (River swell & road blockage)</option>
                <option value="Severe">Severe Risk (Flash flood / Landslide alert)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right Column: Probabilistic Prediction Results & Cascade (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {simulation && (
            <>
              {/* Overall Disruption Score Card */}
              <div className="bg-white rounded-2xl p-6 border border-navy/10 shadow-card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      Continuous Operational Estimate
                    </span>
                    <h3 className="text-xl font-bold text-navy">Trip Disruption Probability</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-3xl font-extrabold text-red-600">
                        {simulation.overall.disruptionProbability}%
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        Confidence: {simulation.overall.confidence}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Probabilistic Impact Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  {/* Transportation */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
                      <Car className="w-3.5 h-3.5 text-blue-600" /> Transport
                    </div>
                    <div className="text-lg font-bold text-navy">
                      {simulation.categories.transportation.probability}%
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {simulation.categories.transportation.detail}
                    </div>
                  </div>

                  {/* Hotel */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
                      <Building className="w-3.5 h-3.5 text-amber-600" /> Hotel Check-in
                    </div>
                    <div className="text-lg font-bold text-navy">
                      {simulation.categories.hotel.probability}%
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {simulation.categories.hotel.detail}
                    </div>
                  </div>

                  {/* Activities */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
                      <Compass className="w-3.5 h-3.5 text-purple-600" /> Activities
                    </div>
                    <div className="text-lg font-bold text-navy">
                      {simulation.categories.activities.probability}%
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {simulation.categories.activities.detail}
                    </div>
                  </div>

                  {/* Movement */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Movement
                    </div>
                    <div className="text-lg font-bold text-navy">
                      {simulation.categories.movement.probability}%
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {simulation.categories.movement.detail}
                    </div>
                  </div>
                </div>
              </div>

              {/* Impact Cascade Flowchart */}
              <div className="bg-white rounded-2xl p-6 border border-navy/10 shadow-card space-y-4">
                <h4 className="font-bold text-navy text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Cascading Impact Chain (Primary → Higher-Order Effects)
                </h4>

                <div className="flex flex-col gap-2">
                  {simulation.propagation.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-navy">{item.label}</p>
                          {item.detail && (
                            <p className="text-[11px] text-slate-500">{item.detail}</p>
                          )}
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          item.risk === 'Severe' || item.risk === 'High'
                            ? 'bg-red-100 text-red-700'
                            : item.risk === 'Moderate'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {item.risk} Risk
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Social Signals & Real News Feed */}
          <div className="bg-white rounded-2xl p-6 border border-navy/10 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-navy text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Real-World Social Signals & Community Reports (Reddit / News)
              </h4>
              <span className="text-[11px] text-slate-400 font-medium">Live Feed</span>
            </div>

            {/* News Articles from NewsData.io */}
            {newsArticles.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Travel News — Your Trip Locations</p>
                {newsArticles.slice(0, 4).map((article) => (
                  <div
                    key={article.id}
                    className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-primary">
                        {article.source?.name || 'News'}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatNewsTime(article.publishedAt)}</span>
                    </div>
                    <p className="text-xs font-semibold text-navy leading-snug">{article.title}</p>
                    {article.summary && (
                      <p className="text-[11px] text-slate-500 line-clamp-2">{article.summary}</p>
                    )}
                    <div className="flex items-center gap-2">
                      {article.disruption?.isDisruption && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${
                          article.disruption.severity === 'HIGH' || article.disruption.severity === 'SEVERE'
                            ? 'bg-rose-50 text-rose-700 ring-rose-100'
                            : article.disruption.severity === 'MODERATE'
                            ? 'bg-amber-50 text-amber-700 ring-amber-100'
                            : 'bg-slate-50 text-slate-500 ring-slate-100'
                        }`}>
                          {article.disruption.type.replace('_', ' ')}
                        </span>
                      )}
                      {article.matchedLocation && (
                        <span className="text-[10px] text-slate-400">
                          📍 {article.matchedLocation}
                        </span>
                      )}
                    </div>
                    {article.url && (
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-medium"
                      >
                        Read full article <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Social Signals (Reddit) */}
            {socialSignals.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Community Reports</p>
                {socialSignals.slice(0, 3).map((sig) => (
                  <div
                    key={sig.id}
                    className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-primary">
                        {sig.subreddit || sig.author}
                      </span>
                      <span className="text-[10px] text-slate-400">{sig.timeLabel}</span>
                    </div>
                    <p className="text-xs font-semibold text-navy leading-snug">{sig.title}</p>
                    {sig.url && (
                      <a
                        href={sig.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-medium"
                      >
                        View post <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
