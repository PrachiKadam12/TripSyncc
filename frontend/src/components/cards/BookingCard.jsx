import { useState } from 'react';
import { CalendarDays, Clock, MapPin, Plane, Bus, Hotel, Ticket, Car, ChevronDown, ChevronUp } from 'lucide-react';
import StatusChip from '../StatusChip.jsx';
import ExternalLink from '../ExternalLink.jsx';
import { formatInr } from '../../utils/finance.js';
import { shortDateRange } from '../../utils/date.js';

const TYPE_ICON = {
  flight: { Icon: Plane, className: 'bg-primary-soft text-primary' },
  train: { Icon: Bus, className: 'bg-primary-soft text-primary' },
  transfer: { Icon: Car, className: 'bg-attention-light text-attention' },
  hotel: { Icon: Hotel, className: 'bg-success-light text-success' },
  activity: { Icon: Ticket, className: 'bg-emerald-light text-emerald' },
};

export default function BookingCard({ booking, replacement }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_ICON[booking.type] || TYPE_ICON.activity;
  const { Icon } = meta;

  return (
    <div
      onClick={() => setExpanded((v) => !v)}
      className="card p-3.5 sm:p-4 cursor-pointer transition-all hover:border-primary/30"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-9 w-9 shrink-0 flex items-center justify-center rounded-xl text-xs ${meta.className}`}>
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-extrabold text-navy truncate">{booking.label}</h4>
              <StatusChip status={booking.status} />
              {replacement && (
                <span className="chip bg-primary-soft text-primary text-[10px]">
                  <Plane size={11} className="inline mr-0.5" /> Now {replacement}
                </span>
              )}
            </div>
            <p className="text-xs text-ink-soft truncate mt-0.5">
              {booking.subtitle || booking.location || `${booking.origin || ''} → ${booking.destination || ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-navy block">{formatInr(booking.price)}</span>
            <span className="text-[10px] text-ink-faint">
              {shortDateRange(booking.checkIn || booking.date, booking.checkOut)}
            </span>
          </div>
          <button
            type="button"
            className="p-1 rounded-lg text-ink-soft hover:bg-navy/5"
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded progressive disclosure view */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-navy/5 text-xs text-ink-soft space-y-2 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={13} /> {shortDateRange(booking.checkIn || booking.date, booking.checkOut)}
              </span>
              {booking.time && (
                <span className="inline-flex items-center gap-1">
                  <Clock size={13} /> {booking.time}
                </span>
              )}
              {booking.origin && booking.destination && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} /> {booking.origin} → {booking.destination}
                </span>
              )}
            </div>
            <span className="font-extrabold text-navy sm:hidden">{formatInr(booking.price)}</span>
          </div>

          {booking.pnr && (
            <p className="text-xs font-semibold text-navy">
              Reference / PNR: <span className="font-mono text-primary bg-primary-soft/50 px-1.5 py-0.5 rounded">{booking.pnr}</span>
            </p>
          )}

          {booking.links?.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {booking.links.map((l) => (
                <ExternalLink key={l.label} href={l.url} className="text-xs">
                  {l.label}
                </ExternalLink>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}