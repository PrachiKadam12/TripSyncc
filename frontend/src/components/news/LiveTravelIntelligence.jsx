/**
 * LiveTravelIntelligence — compact news + weather signal card for Dashboard.
 * Shows relevant disruption signals without becoming a news portal.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudRain, Newspaper, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { useTrip } from '../../context/TripContext.jsx';
import { getTripNews, formatNewsTime } from '../../services/newsService.js';

export default function LiveTravelIntelligence() {
  const navigate = useNavigate();
  const { activeTrip } = useTrip();
  const [newsData, setNewsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTrip?.id) { setLoading(false); return; }
    let mounted = true;
    setLoading(true);
    getTripNews(activeTrip.id, { hours: 24, limit: 5 }).then((data) => {
      if (!mounted) return;
      setNewsData(data);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [activeTrip?.id]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-navy/5 bg-white shadow-card p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-3 bg-slate-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  const articles = newsData?.articles || [];
  const disruptions = articles.filter((a) => a.disruption?.isDisruption);
  const highRisk = disruptions.filter((a) => a.disruption?.severity === 'HIGH' || a.disruption?.severity === 'SEVERE');
  const summary = newsData?.summary || {};

  return (
    <div className="rounded-2xl border border-navy/5 bg-white shadow-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Live Travel Intelligence</p>
          <h3 className="mt-1 text-sm font-semibold text-navy">Travel Signals</h3>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-ink-faint">
          <span className={`w-1.5 h-1.5 rounded-full ${newsData?.sourceStatus === 'LIVE' ? 'bg-emerald-400' : newsData?.sourceStatus === 'CACHED' ? 'bg-amber-400' : 'bg-slate-300'}`} />
          {newsData?.sourceStatus || 'N/A'}
        </span>
      </div>

      {articles.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-faint">No disruption signals for your trip.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {articles.slice(0, 3).map((article) => (
            <div key={article.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 text-sm">
                {article.disruption?.type === 'WEATHER' ? '🌧' : '📰'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-navy truncate">{article.title}</p>
                <p className="text-[11px] text-ink-faint">
                  {article.source?.name} · {formatNewsTime(article.publishedAt)}
                </p>
              </div>
              {article.disruption?.severity === 'HIGH' || article.disruption?.severity === 'SEVERE' ? (
                <span className="shrink-0 inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-100">
                  HIGH
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => navigate('/app/twin')}
        className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:underline"
      >
        View Travel Intelligence <ArrowRight size={12} />
      </button>
    </div>
  );
}
