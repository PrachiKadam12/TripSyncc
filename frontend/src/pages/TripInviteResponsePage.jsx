/**
 * TripInviteResponsePage.jsx — Public invitation response screen.
 * Accessible via /invite/:token.
 * Allows invited travelers to explicitly Accept or Decline a group trip invitation.
 */

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Compass,
  CheckCircle2,
  XCircle,
  Calendar,
  MapPin,
  User,
  Loader2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { getInvitationByToken, respondToInvitation } from '../services/groupService.js';
import { notifyMemberResponse } from '../services/notificationService.js';

export default function TripInviteResponsePage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [invitation, setInvitation] = useState(null);
  const [responseStatus, setResponseStatus] = useState(null); // 'accepted' | 'declined' | null

  const actionParam = searchParams.get('action'); // 'accept' or 'decline'

  useEffect(() => {
    let isMounted = true;
    async function loadInvite() {
      if (!token) {
        setError('Missing invitation token.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const data = await getInvitationByToken(token);
        if (!isMounted) return;

        setInvitation(data);
        if (data.status && data.status !== 'invited') {
          setResponseStatus(data.status);
        } else if (actionParam === 'accept' || actionParam === 'decline') {
          // Auto-respond if action is embedded in the link from the email button
          handleRespond(actionParam, data);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Unable to find or validate this invitation.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInvite();
    return () => {
      isMounted = false;
    };
  }, [token, actionParam]);

  const handleRespond = async (action, invData = invitation) => {
    if (!token) return;
    setSubmitting(true);
    setError('');

    try {
      const result = await respondToInvitation(token, action);
      setResponseStatus(result.status || (action === 'accept' ? 'accepted' : 'declined'));
      
      // Trigger Event 2: Member accepted / declined
      if (invData && invData.trip && invData.trip.organizer_id) {
        notifyMemberResponse({
          userId: invData.trip.organizer_id,
          senderId: invData.member_id,
          tripId: invData.trip.id,
          memberName: invData.name,
          action: action
        }).catch(err => console.warn('Failed to notify organizer:', err));
      }
    } catch (err) {
      setError(err.message || 'Failed to submit your response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 text-sm font-bold text-primary">
          <Loader2 className="animate-spin" size={24} />
          <span>Verifying invitation security token…</span>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-navy/10 p-8 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle size={28} />
          </div>
          <h1 className="text-xl font-black text-navy">Invalid Invitation</h1>
          <p className="text-xs text-ink-soft leading-relaxed">
            {error || 'This invitation link is invalid or has expired. Please ask the organizer to resend your invite.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary w-full py-2.5 text-xs font-bold"
          >
            Go to TripSync Home
          </button>
        </div>
      </div>
    );
  }

  const { trip, email, name } = invitation;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/60 to-slate-100 flex flex-col items-center justify-center p-4 py-12">
      <div className="max-w-lg w-full">
        {/* Brand header */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-md">
            <Compass size={20} />
          </div>
          <span className="text-xl font-black tracking-tight text-navy">TripSync</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-navy/10 shadow-lg overflow-hidden"
        >
          {/* Hero Banner */}
          <div className="bg-gradient-to-r from-primary to-sky-700 text-white p-6 sm:p-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-[11px] font-bold mb-3">
              <ShieldCheck size={14} /> Group Trip Invitation
            </div>
            <h1 className="text-2xl font-black leading-tight mb-1">{trip.name}</h1>
            <p className="text-xs text-white/80 font-medium">
              Organized by <strong className="text-white">{trip.organizer_name}</strong>
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Trip Details Card */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-3">
              <div className="flex items-start gap-3 text-xs">
                <MapPin size={16} className="text-primary mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-ink-faint text-[10px] uppercase tracking-wider font-bold block">Route</span>
                  <p className="font-bold text-navy truncate">
                    {trip.origin} &rarr; {trip.destination}
                  </p>
                </div>
              </div>

              {(trip.start_date || trip.end_date) && (
                <div className="flex items-start gap-3 text-xs pt-2 border-t border-slate-200/60">
                  <Calendar size={16} className="text-sky-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-ink-faint text-[10px] uppercase tracking-wider font-bold block">Dates</span>
                    <p className="font-bold text-navy">
                      {trip.start_date || 'TBD'} to {trip.end_date || 'TBD'}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 text-xs pt-2 border-t border-slate-200/60">
                <User size={16} className="text-violet-600 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-ink-faint text-[10px] uppercase tracking-wider font-bold block">Invited Guest</span>
                  <p className="font-bold text-navy truncate">{email || name}</p>
                </div>
              </div>
            </div>

            {/* Response Section */}
            {responseStatus === 'accepted' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center space-y-2"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-1">
                  <CheckCircle2 size={26} />
                </div>
                <h3 className="text-base font-black text-emerald-950">You're on the Trip!</h3>
                <p className="text-xs text-emerald-800 leading-relaxed max-w-sm mx-auto">
                  You've successfully accepted the invitation. {trip.organizer_name} will be notified and will manage group tickets and itinerary updates.
                </p>
                <div className="pt-3">
                  <button
                    onClick={() => navigate('/app')}
                    className="btn-primary text-xs font-bold px-5 py-2 inline-flex items-center gap-1.5"
                  >
                    Go to TripSync App <ArrowRight size={14} />
                  </button>
                </div>
              </motion.div>
            ) : responseStatus === 'declined' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl bg-slate-100 border border-slate-200 p-5 text-center space-y-2"
              >
                <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center mx-auto mb-1">
                  <XCircle size={26} />
                </div>
                <h3 className="text-base font-black text-navy">Invitation Declined</h3>
                <p className="text-xs text-ink-soft leading-relaxed max-w-sm mx-auto">
                  You have declined this trip invitation. You will not be included in the group, and no tickets will be requested from you.
                </p>
                <div className="pt-3">
                  <button
                    onClick={() => navigate('/')}
                    className="btn-secondary text-xs font-bold px-5 py-2"
                  >
                    Return Home
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="text-center">
                  <h2 className="text-base font-extrabold text-navy">Do you want to join this trip?</h2>
                  <p className="text-xs text-ink-soft mt-0.5">Please confirm your response to the organizer.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleRespond('accept')}
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> Yes, I want to join
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRespond('decline')}
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <XCircle size={16} /> No, I decline
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <p className="text-center text-[11px] text-ink-faint mt-6">
          TripSync • One trip. Every booking. One intelligent recovery.
        </p>
      </div>
    </div>
  );
}
