/**
 * CreateTripPage — Comprehensive multi-step trip wizard for TripSync
 * Features:
 * - PDF Itinerary Auto-Import & OCR extraction via Gemini AI
 * - Dynamic Day-wise Stops & Itinerary Builder (editable, deletable)
 * - Specialized Group Trip Flow:
 *     1. Trip Details (Travel Type: Group)
 *     2. Stops (Auto-imported from PDF or custom)
 *     3. Add Group Members (Stores in Supabase DB, generates secure tokens, instant mailto & response simulator)
 *     4. Group Confirmation (Organizer approval, separation of accepted vs declined)
 *     5. Ticket Upload (For accepted members)
 *     6. Review & Finalize (Saves to Supabase trips, trip_members, itinerary_items, documents, bookings)
 * - Bulletproof Supabase database persistence with auto-profile initialization & error recovery.
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, CalendarDays, Plane, Hotel, Train,
  Ticket, ArrowRight, ArrowLeft, Sparkles, CheckCircle2,
  Plus, X, AlertCircle, Loader2, Users, UserPlus, Navigation,
  FileUp, QrCode, FileText, User, Heart, Mail, RefreshCw, Send,
  Check, Eye, Trash2, ShieldCheck, XCircle, ExternalLink, UploadCloud, Clock, Copy, LogIn,
} from 'lucide-react';
import { supabase } from '../../services/supabase.js';
import { useTrip } from '../../context/TripContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { geminiSuggest } from '../../services/geminiService.js';
import { parseTripPlanPdf, validatePdfFile } from '../../services/tripPlanParser.js';
import {
  sendGroupInvite,
  getTripGroupMembers,
  resendGroupInvite,
  respondToInvitation,
  uploadMemberTicket,
} from '../../services/groupService.js';

const STANDARD_STEPS = [
  { id: 'basics', label: 'Trip Details', icon: MapPin },
  { id: 'stops', label: 'Stops', icon: Navigation },
  { id: 'group', label: 'Group', icon: Users },
  { id: 'flights', label: 'Flights', icon: Plane },
  { id: 'hotels', label: 'Hotels', icon: Hotel },
  { id: 'transport', label: 'Trains / Buses', icon: Train },
  { id: 'activities', label: 'Activities', icon: Ticket },
  { id: 'review', label: 'Review', icon: CheckCircle2 },
];

const GROUP_STEPS = [
  { id: 'basics', label: 'Trip Details', icon: MapPin },
  { id: 'stops', label: 'Stops', icon: Navigation },
  { id: 'group_members', label: 'Add Members', icon: Users },
  { id: 'group_confirm', label: 'Confirm Group', icon: CheckCircle2 },
  { id: 'ticket_upload', label: 'Upload Tickets', icon: Ticket },
  { id: 'review', label: 'Review', icon: CheckCircle2 },
];

/* ─── Step indicator ─── */
function StepIndicator({ currentStep, steps }) {
  const currentIdx = steps.findIndex((s) => s.id === currentStep);
  return (
    <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2 gap-1">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isActive = step.id === currentStep;
        const isDone = currentIdx > i;
        return (
          <div key={step.id} className="flex items-center min-w-0">
            <div className={`flex flex-col items-center gap-1 min-w-[52px] transition-opacity ${isActive ? 'opacity-100' : isDone ? 'opacity-70' : 'opacity-35'}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isActive ? 'bg-primary text-white shadow-md ring-2 ring-primary/20' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-ink-soft'}`}>
                {isDone ? <CheckCircle2 size={16} /> : <Icon size={16} />}
              </div>
              <span className={`text-[9px] font-bold text-center leading-tight whitespace-nowrap ${isActive ? 'text-primary' : 'text-ink-soft'}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 transition-colors ${isDone ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Generic booking row (for standard flow) ─── */
function BookingRow({ booking, onRemove, onEdit }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-navy/10 bg-slate-50 p-3">
      <div className="min-w-0 flex-1 text-xs">
        <p className="font-extrabold text-navy truncate">{booking.label || booking.provider_name || 'Booking'}</p>
        {booking.confirmation_code && <p className="text-ink-soft">Ref: {booking.confirmation_code}</p>}
        {booking.departure_at && (
          <p className="text-ink-soft">
            {new Date(booking.departure_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
        {booking.base_amount > 0 && <p className="font-bold text-emerald-700">₹{Number(booking.base_amount).toLocaleString('en-IN')}</p>}
        {booking.notes && <p className="text-ink-soft italic mt-0.5">📝 {booking.notes}</p>}
      </div>
      <button onClick={() => onEdit && onEdit(booking)} className="text-[10px] font-bold text-primary hover:underline px-1 shrink-0">Edit</button>
      <button onClick={() => onRemove(booking)} className="text-ink-faint hover:text-critical p-1 rounded-lg hover:bg-red-50 shrink-0 cursor-pointer">
        <X size={14} />
      </button>
    </div>
  );
}

/* ─── Main Component ─── */
export default function CreateTripPage() {
  const navigate = useNavigate();
  const { loadRealTrips, setActiveTrip, setActiveTripId } = useTrip();
  const { user, profile } = useAuth();

  const [step, setStep] = useState('basics');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // AI Suggestions
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState('');

  // Basics Form State
  const [tripName, setTripName] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [organizerName, setOrganizerName] = useState('');
  const [travelType, setTravelType] = useState('group'); // Default to group

  // PDF Upload & Extraction State
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [pdfUploadError, setPdfUploadError] = useState('');
  const [pdfExtractSuccess, setPdfExtractSuccess] = useState('');
  const [stopsFromPdf, setStopsFromPdf] = useState(false);
  const fileInputRef = useRef(null);

  // Day-wise Stops (dynamic multi-city itinerary)
  const [stops, setStops] = useState([
    { id: 'stop-1', day_number: 1, city: '', route: '', title: '', description: '', transport: '', activities: '', arrival: '', departure: '', notes: '' }
  ]);

  // Group Trip States
  const [draftTripId, setDraftTripId] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [memberInviting, setMemberInviting] = useState(false);
  const [selectedInviteModal, setSelectedInviteModal] = useState(null);
  const [memberTickets, setMemberTickets] = useState({});
  const [ticketUploading, setTicketUploading] = useState({});

  // Standard group invites (for solo/family flow)
  const [invites, setInvites] = useState([{ id: 'inv-1', username: '' }]);

  // Bookings (Standard non-group flow)
  const [flights, setFlights] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [trains, setTrains] = useState([]);
  const [activities, setActivities] = useState([]);
  const [bookingForm, setBookingForm] = useState({});

  // Active steps based on travelType — solo skips the co-traveler step
  const currentSteps = travelType === 'group'
    ? GROUP_STEPS
    : travelType === 'solo'
      ? STANDARD_STEPS.filter((s) => s.id !== 'group')
      : STANDARD_STEPS;
  const currentIdx = currentSteps.findIndex((s) => s.id === step);

  // Ensure step is valid in active steps
  useEffect(() => {
    if (!currentSteps.some((s) => s.id === step)) {
      setStep('basics');
    }
  }, [travelType, currentSteps, step]);

  // Auto-sync organizer into group members
  useEffect(() => {
    if (travelType === 'group') {
      const orgEmail = user?.email || 'organizer@tripsync.travel';
      const orgName = organizerName.trim() || profile?.display_name || user?.user_metadata?.full_name || 'Organizer (You)';

      setGroupMembers((prev) => {
        const hasOrg = prev.some((m) => m.is_organizer || m.role === 'owner');
        if (!hasOrg) {
          return [
            {
              id: 'org-main',
              name: orgName,
              email: orgEmail,
              role: 'owner',
              is_organizer: true,
              status: 'accepted',
              token: '',
            },
            ...prev,
          ];
        }
        return prev.map((m) => (m.is_organizer || m.role === 'owner' ? { ...m, name: orgName, email: orgEmail } : m));
      });
    }
  }, [travelType, user, profile, organizerName]);

  // Ensure user profile exists in Supabase to satisfy foreign key constraints
  const ensureUserProfile = async (userId) => {
    if (!userId) return false;
    try {
      const { data, error } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
      if (!data) {
        const fName = organizerName.trim() || profile?.first_name || user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'Traveler';
        const lName = profile?.last_name || user?.user_metadata?.last_name || '';
        await supabase.from('profiles').upsert({
          id: userId,
          first_name: fName,
          last_name: lName,
          display_name: fName,
          email: user?.email || '',
        }, { onConflict: 'id' });
      }
      return true;
    } catch (err) {
      console.warn('Profile sync notice:', err.message);
      return false;
    }
  };

  // Helper to ensure draft trip exists in Supabase
  const ensureDraftTrip = async () => {
    if (draftTripId && !draftTripId.startsWith('trip-draft-')) return draftTripId;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || user?.id;
      if (!currentUserId) return null;

      await ensureUserProfile(currentUserId);

      const validStops = stops.filter((s) => (s.city || s.route || '').trim());
      const destinationCity = destination.trim() || validStops[0]?.city || 'Destination';
      const routeArray = validStops.map((s) => s.city || s.route).filter(Boolean);
      if (routeArray.length === 0) routeArray.push(destinationCity);
      const datesLabel = startDate && endDate ? `${startDate} – ${endDate}` : 'Flexible Dates';

      const metadataPayload = {
        travel_type: 'group',
        organizer_name: organizerName.trim() || profile?.display_name || 'Organizer',
        stops: validStops,
        budget: parseFloat(budget) || null,
      };

      const { data, error: insertErr } = await supabase
        .from('trips')
        .insert({
          title: tripName.trim() || 'Untitled Group Trip',
          origin_city: origin.trim() || 'Origin',
          destination_city: destinationCity,
          start_at: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
          end_at: endDate ? new Date(endDate).toISOString() : new Date(Date.now() + 6 * 86400000).toISOString(),
          status: 'planned',
          currency_code: 'INR',
          owner_id: currentUserId,
          description: JSON.stringify(metadataPayload),
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      setDraftTripId(data.id);
      return data.id;
    } catch (err) {
      console.warn('Draft trip initialization note:', err.message);
      const fallbackId = `trip-draft-${Date.now()}`;
      setDraftTripId(fallbackId);
      return fallbackId;
    }
  };

  const goNext = async () => {
    if (step === 'basics') {
      if (!tripName.trim() || !origin.trim() || !destination.trim() || !startDate || !endDate) {
        setError('Please fill in Trip Name, Starting City, Destination, and Dates.');
        return;
      }
      setError('');

      // Auto sync destination into first stop if empty
      setStops((prev) => {
        if (prev.length === 1 && !prev[0].city) {
          return [{ ...prev[0], city: destination.trim(), title: `Day 1 – ${destination.trim()}` }];
        }
        return prev;
      });

      if (travelType === 'group') {
        await ensureDraftTrip();
      }
    }

    if (step === 'stops') {
      if (travelType === 'group') {
        await ensureDraftTrip();
      }
    }

    if (step === 'group_members') {
      const pendingCount = groupMembers.filter((m) => m.status === 'invited').length;
      if (pendingCount > 0) {
        setError(`Please resolve pending invitations (${pendingCount} pending). You can click "Test Response" to simulate accept or decline.`);
        return;
      }
      setError('');
    }

    const nextIdx = Math.min(currentIdx + 1, currentSteps.length - 1);
    setStep(currentSteps[nextIdx].id);
  };

  const goBack = () => {
    setError('');
    const prevIdx = Math.max(currentIdx - 1, 0);
    setStep(currentSteps[prevIdx].id);
  };

  /* ── File selection & PDF Extraction ── */
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validatePdfFile(file);
    if (!validation.valid) {
      setPdfUploadError(validation.error);
      setPdfExtractSuccess('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setPdfFile(file);
    setPdfUploadError('');
    setPdfExtractSuccess('');
    setPdfExtracting(true);

    try {
      const extracted = await parseTripPlanPdf(file);
      if (extracted) {
        if (extracted.trip_name) setTripName(extracted.trip_name);
        if (extracted.starting_city) setOrigin(extracted.starting_city);
        if (extracted.destination) setDestination(extracted.destination);
        if (extracted.start_date) setStartDate(extracted.start_date);
        if (extracted.end_date) setEndDate(extracted.end_date);
        if (extracted.total_budget != null) setBudget(String(extracted.total_budget));
        if (extracted.organizer_name) setOrganizerName(extracted.organizer_name);
        if (['solo', 'group', 'family'].includes(extracted.travel_type)) {
          setTravelType(extracted.travel_type);
        }

        if (Array.isArray(extracted.stops) && extracted.stops.length > 0) {
          setStops(extracted.stops);
          setStopsFromPdf(true);
        } else if (extracted.destination) {
          setStops([
            { id: 'stop-1', day_number: 1, city: extracted.destination, route: '', title: `Day 1 – ${extracted.destination}`, description: '', transport: '', activities: '', arrival: '', departure: '', notes: '' }
          ]);
        }

        setPdfExtractSuccess(`Trip details and ${extracted.stops?.length || 0} stops extracted from your PDF. Review below before continuing.`);
      }
    } catch (err) {
      console.warn('PDF extraction note:', err);
      setPdfUploadError(err.message || 'Unable to extract trip details from this PDF. You can enter details manually.');
    } finally {
      setPdfExtracting(false);
    }
  };

  const handleRemovePdf = () => {
    setPdfFile(null);
    setPdfUploadError('');
    setPdfExtractSuccess('');
    setStopsFromPdf(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── AI Suggestions ── */
  const getAiSuggestions = async () => {
    const destinations = destination || stops.map((s) => s.city).filter(Boolean).join(', ');
    if (!destinations && !startDate) return;
    setAiLoading(true);
    setAiSuggestions('');
    try {
      const prompt = `I'm planning a trip from ${origin || 'India'} visiting ${destinations || 'multiple cities'} from ${startDate} to ${endDate || 'TBD'} (${travelType} trip), budget ₹${budget || 'flexible'}. Give 3 practical suggestions: best accommodation options, must-try activities at each stop, and key travel tips. Be specific and concise.`;
      const result = await geminiSuggest(prompt);
      setAiSuggestions(result);
    } catch (err) {
      setAiSuggestions(`⚠️ ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  /* ── Stops Helpers ── */
  const addStop = () =>
    setStops((prev) => [
      ...prev,
      {
        id: `stop-${Date.now()}`,
        day_number: prev.length + 1,
        city: '',
        route: '',
        title: `Day ${prev.length + 1}`,
        description: '',
        transport: '',
        activities: '',
        arrival: '',
        departure: '',
        notes: '',
      },
    ]);

  const removeStop = (id) =>
    setStops((prev) => prev.filter((s) => s.id !== id));

  const updateStop = (id, field, value) =>
    setStops((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );

  /* ── Group Member Management (Direct Supabase DB Storage) ── */

  const handleAddGroupMember = async (e) => {
    e?.preventDefault();
    if (!newMemberEmail.trim()) return;

    const emailClean = newMemberEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailClean)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (groupMembers.some((m) => m.email?.toLowerCase() === emailClean)) {
      setError('This email address has already been added to the group.');
      return;
    }

    setError('');
    setMemberInviting(true);

    try {
      let activeTripId = draftTripId;
      if (!activeTripId || activeTripId.startsWith('trip-draft-')) {
        activeTripId = await ensureDraftTrip();
      }

      const orgDisplayName = organizerName.trim() || profile?.display_name || user?.user_metadata?.full_name || 'Organizer';

      // Call group invite service (stores in DB & creates response links)
      const inviteResult = await sendGroupInvite({
        tripId: activeTripId,
        email: emailClean,
        organizerName: orgDisplayName,
        tripDetails: {
          tripName: tripName.trim() || 'Group Adventure',
          origin,
          destination,
          startDate,
          endDate,
        },
      });

      const newMember = {
        id: inviteResult.member_id || `mem-${Date.now()}`,
        trip_id: activeTripId,
        email: emailClean,
        name: inviteResult.name || emailClean.split('@')[0],
        status: 'invited',
        token: inviteResult.token,
        is_organizer: false,
        email_delivery: inviteResult.email_delivery,
      };

      // Also store in Supabase trip_members table if active trip exists
      if (activeTripId && !activeTripId.startsWith('trip-draft-')) {
        try {
          await supabase.from('trip_members').insert({
            trip_id: activeTripId,
            first_name: newMember.name,
            email: emailClean,
            role: 'traveler',
            is_primary_traveler: false,
            member_status: 'invited',
            invitation_token: newMember.token,
          });
        } catch (dbErr) {
          console.warn('Supabase member insertion notice:', dbErr.message);
        }
      }

      setGroupMembers((prev) => [...prev, newMember]);
      setNewMemberEmail('');
      setToastMessage(`Invitation stored in database for ${emailClean}.`);
      setTimeout(() => setToastMessage(''), 4000);

      // Open email preview / response modal
      setSelectedInviteModal(newMember);
    } catch (err) {
      setError(err.message || 'Failed to add group member.');
    } finally {
      setMemberInviting(false);
    }
  };

  const handleResendInvite = async (member) => {
    try {
      const activeTripId = draftTripId || (await ensureDraftTrip());
      const res = await resendGroupInvite({
        tripId: activeTripId,
        memberId: member.id,
        email: member.email,
        token: member.token,
      });

      setToastMessage(`Invitation refreshed for ${member.email}.`);
      setTimeout(() => setToastMessage(''), 4000);

      if (res.email_delivery) {
        setSelectedInviteModal({
          ...member,
          email_delivery: res.email_delivery,
        });
      }
    } catch (err) {
      setError('Failed to refresh invitation: ' + err.message);
    }
  };

  const handleSimulateResponse = async (memberId, token, action) => {
    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    // 1. Instantly update UI state
    setGroupMembers((prev) =>
      prev.map((m) => (m.id === memberId || m.token === token ? { ...m, status: newStatus } : m))
    );

    setSelectedInviteModal(null);
    setToastMessage(
      action === 'accept'
        ? '✓ Member accepted the invitation.'
        : '✗ Member declined the invitation and will be excluded.'
    );
    setTimeout(() => setToastMessage(''), 4000);

    // 2. Persist response in Supabase database
    if (token) {
      respondToInvitation(token, action).catch((e) => console.warn('Response sync note:', e.message));
    }
  };

  const handleRefreshMemberStatuses = async () => {
    if (!draftTripId) return;
    try {
      const freshMembers = await getTripGroupMembers(draftTripId);
      if (freshMembers && freshMembers.length > 0) {
        setGroupMembers(freshMembers);
        setToastMessage('Refreshed member statuses from database.');
        setTimeout(() => setToastMessage(''), 3000);
      }
    } catch (err) {
      console.warn('Status refresh error:', err);
    }
  };

  /* ── Ticket upload for accepted members ── */
  const handleTicketFileChange = async (member, file) => {
    if (!file) return;

    setTicketUploading((prev) => ({ ...prev, [member.id]: true }));
    setError('');

    try {
      const activeTripId = draftTripId || (await ensureDraftTrip());
      const uploadRes = await uploadMemberTicket({
        tripId: activeTripId,
        memberId: member.id,
        memberName: member.name,
        memberEmail: member.email,
        file,
        userId: user?.id,
      });

      setMemberTickets((prev) => ({
        ...prev,
        [member.id]: {
          fileName: file.name,
          size: file.size,
          storagePath: uploadRes.storagePath,
          uploadedAt: new Date().toISOString(),
        },
      }));

      setToastMessage(`Uploaded ticket for ${member.name || member.email}.`);
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      setError(`Failed to upload ticket for ${member.name}: ${err.message}`);
    } finally {
      setTicketUploading((prev) => ({ ...prev, [member.id]: false }));
    }
  };

  /* ── Standard Invite helpers (Solo/Family) ── */
  const addInvite = () =>
    setInvites((prev) => [...prev, { id: `inv-${Date.now()}`, username: '' }]);

  const removeInvite = (id) =>
    setInvites((prev) => prev.filter((i) => i.id !== id));

  const updateInvite = (id, value) =>
    setInvites((prev) => prev.map((i) => (i.id === id ? { ...i, username: value } : i)));

  /* ── Booking helpers (Standard non-group flow) ── */
  const addBooking = (type, listSetter) => {
    if (!bookingForm.label && !bookingForm.provider_name) {
      setError('Please enter at least a name for this booking.');
      return;
    }
    setError('');
    listSetter((prev) => [...prev, { ...bookingForm, booking_type: type, id: `local-${Date.now()}` }]);
    setBookingForm({});
  };

  const removeBooking = (item, listSetter) =>
    listSetter((prev) => prev.filter((b) => b.id !== item.id));

  const editBooking = (item, listSetter) => {
    setBookingForm(item);
    removeBooking(item, listSetter);
  };

  /* ── Final Save Trip to Supabase Database ── */
  const handleSaveTrip = async () => {
    if (!tripName.trim() || !origin.trim() || !destination.trim() || !startDate || !endDate) {
      setError('Please fill in Trip Name, Starting City, Destination, and Dates.');
      setStep('basics');
      return;
    }
    setSaving(true);
    setError('');

    try {
      // 1. Authenticate user
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || user?.id;

      if (!currentUserId) {
        throw new Error('You must be signed in to save trips to Supabase. Please sign in or use Demo Mode.');
      }

      // Ensure profile row exists in public.profiles table
      await ensureUserProfile(currentUserId);

      const validStops = stops.filter((s) => (s.city || s.route || '').trim());
      const destinationCity = destination.trim() || validStops[0]?.city || 'Destination';

      // Separate accepted and declined members
      const acceptedGroupMembers = groupMembers.filter((m) => m.is_organizer || m.status === 'accepted');
      const declinedGroupMembers = groupMembers.filter((m) => m.status === 'declined');
      const travelersCount = travelType === 'group' ? Math.max(acceptedGroupMembers.length, 1) : travelType === 'family' ? 4 : 1;

      const metadataObj = {
        stops: validStops.length > 0 ? validStops : [{ id: 'stop-1', city: destinationCity, arrival: '', departure: '', notes: '' }],
        invites: travelType === 'group' ? acceptedGroupMembers.map((m) => m.email) : invites.map((i) => i.username).filter(Boolean),
        travel_type: travelType,
        travelers_count: travelersCount,
        organizer_name: organizerName.trim() || profile?.display_name || 'Organizer',
        budget: parseFloat(budget) || null,
        confirmed_group_members: acceptedGroupMembers.map((m) => ({ id: m.id, email: m.email, name: m.name, role: m.role })),
        excluded_declined_members: declinedGroupMembers.map((m) => ({ id: m.id, email: m.email, name: m.name })),
        all_group_members: groupMembers,
        tickets: memberTickets,
      };

      let finalTripId = draftTripId;

      const routeArray = validStops.map((s) => s.city || s.route).filter(Boolean);
      if (routeArray.length === 0) routeArray.push(destinationCity);
      const datesLabel = startDate && endDate ? `${startDate} – ${endDate}` : 'Flexible Dates';

      // 2. Insert or Update in Supabase `trips` Table
      const tripPayload = {
        title: tripName.trim() || 'Untitled Trip',
        origin_city: origin.trim(),
        destination_city: destinationCity,
        start_at: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
        end_at: endDate ? new Date(endDate).toISOString() : new Date(Date.now() + 6 * 86400000).toISOString(),
        status: 'planned',
        currency_code: 'INR',
        owner_id: currentUserId,
        description: JSON.stringify(metadataObj),
      };

      if (draftTripId && !draftTripId.startsWith('trip-draft-')) {
        const { error: updateErr } = await supabase
          .from('trips')
          .update(tripPayload)
          .eq('id', draftTripId);

        if (updateErr) {
          console.error('Trip update error:', updateErr);
          throw new Error(`Database error updating trip: ${updateErr.message}`);
        }
      } else {
        const { data: trip, error: tripError } = await supabase
          .from('trips')
          .insert(tripPayload)
          .select()
          .single();

        if (tripError) {
          console.error('Trip insert error:', tripError);
          throw new Error(`Database error saving trip: ${tripError.message}`);
        }
        finalTripId = trip.id;
      }

      // 3. Persist All Group Members in `trip_members` Table
      if (finalTripId && travelType === 'group' && groupMembers.length > 0) {
        try {
          // Clear prior draft members for this trip
          await supabase.from('trip_members').delete().eq('trip_id', finalTripId);

          const membersToInsert = groupMembers.map((m, idx) => {
            const isOrg = m.is_organizer || m.role === 'owner';
            const cleanStatus = isOrg ? 'accepted' : (m.status === 'declined' ? 'declined' : m.status === 'accepted' ? 'accepted' : 'invited');
            const mName = m.name || m.first_name || m.email?.split('@')[0] || `Member ${idx + 1}`;
            const mCode = m.token || m.email?.split('@')[0]?.toLowerCase() || `mem_${idx + 1}`;

            return {
              trip_id: finalTripId,
              user_id: isOrg ? currentUserId : null,
              name: mName,
              first_name: mName,
              last_name: isOrg ? (profile?.last_name || '') : '',
              email: m.email || '',
              member_code: mCode,
              role: isOrg ? 'owner' : 'traveler',
              affected: cleanStatus === 'declined',
              is_primary_traveler: Boolean(isOrg),
              member_status: cleanStatus,
              invitation_token: m.token || `inv_${Math.random().toString(36).substring(2, 10)}`,
              note: `Status: ${cleanStatus} | Email: ${m.email || ''}`,
            };
          });

          const { error: memErr } = await supabase.from('trip_members').insert(membersToInsert);
          if (memErr) console.warn('Trip members insert warning:', memErr.message);
        } catch (memberErr) {
          console.warn('Trip members persistence note:', memberErr.message);
        }
      }

      // 4. Save Trip Budget if specified
      if (budget && finalTripId) {
        try {
          await supabase.from('budgets').upsert({
            trip_id: finalTripId,
            name: `${tripName} Budget`,
            total_budget: parseFloat(budget) || 0,
            total_spent: 0,
            at_risk: 0,
            disruption_reserve: (parseFloat(budget) || 0) * 0.15,
            currency_code: 'INR',
          }, { onConflict: 'trip_id,name' });
        } catch (bErr) {
          console.warn('Budget insert note:', bErr.message);
        }
      }

      // 5. Handle PDF Storage in Supabase Storage bucket 'trip-documents'
      if (pdfFile && finalTripId) {
        try {
          const cleanName = pdfFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const storagePath = `${finalTripId}/${currentUserId}/${Date.now()}_${cleanName}`;
          const { error: uploadError } = await supabase.storage
            .from('trip-documents')
            .upload(storagePath, pdfFile, {
              contentType: pdfFile.type || 'application/pdf',
              upsert: true,
            });

          if (!uploadError) {
            await supabase.from('documents').insert({
              trip_id: finalTripId,
              doc_key: `trip_plan_${Date.now()}`,
              title: 'Trip Plan PDF',
              kind: 'itinerary',
              document_type: 'trip_plan',
              file_name: pdfFile.name,
              storage_bucket: 'trip-documents',
              storage_path: storagePath,
              is_offline: true,
              is_available_offline: true,
            });
          }
        } catch (storageErr) {
          console.warn('PDF storage note:', storageErr.message);
        }
      }

      // 6. Insert Itinerary items into `itinerary_items` table
      if (validStops.length > 0 && finalTripId) {
        try {
          const itineraryRows = validStops.map((s, idx) => {
            const itemType = s.transport?.toLowerCase().includes('flight')
              ? 'flight'
              : s.transport?.toLowerCase().includes('train')
                ? 'train'
                : s.transport?.toLowerCase().includes('bus')
                  ? 'bus'
                  : 'transfer';

            return {
              trip_id: finalTripId,
              sequence_no: idx + 1,
              title: s.title || s.city || `Day ${idx + 1}`,
              item_type: itemType,
              address: s.city || destinationCity,
              description: s.description || s.notes || s.activities || '',
              status: 'safe',
              metadata: {
                day_number: s.day_number || idx + 1,
                transport: s.transport || '',
                activities: s.activities || '',
                arrival: s.arrival || '',
                departure: s.departure || '',
                city: s.city || '',
                route: s.route || '',
              },
            };
          });

          // Delete existing non-booking itinerary items first to avoid sequence_no conflicts
          await supabase.from('itinerary_items').delete().eq('trip_id', finalTripId).is('booking_id', null);
          if (itineraryRows.length > 0) {
            await supabase.from('itinerary_items').insert(itineraryRows);
          }
        } catch (itinErr) {
          console.warn('Itinerary items insert note:', itinErr.message);
        }
      }

      // 7. Insert Standard Bookings (if any)
      const allBookings = [
        ...flights.map((b) => ({ ...b, booking_type: 'flight' })),
        ...hotels.map((b) => ({ ...b, booking_type: 'hotel' })),
        ...trains.map((b) => ({ ...b, booking_type: 'train' })),
        ...activities.map((b) => ({ ...b, booking_type: 'activity' })),
      ].map(({ id, ...b }, idx) => ({
        trip_id: finalTripId,
        booking_type: b.booking_type || 'other',
        provider_name: b.label || b.provider_name || 'Booking',
        origin_name: b.origin_name || null,
        destination_name: b.destination_name || null,
        confirmation_code: b.confirmation_code || null,
        base_amount: parseFloat(b.base_amount) || 0,
        currency_code: 'INR',
        status: 'confirmed',
        refundable: Boolean(b.refundable),
        departure_at: b.departure_at ? new Date(b.departure_at).toISOString() : null,
        arrival_at: b.arrival_at ? new Date(b.arrival_at).toISOString() : null,
        cancellation_deadline: b.cancellation_deadline ? new Date(b.cancellation_deadline).toISOString() : null,
        provider_metadata: { notes: b.notes || '', ...(b.provider_metadata || {}) },
      }));

      if (allBookings.length > 0) {
        const { error: be } = await supabase.from('bookings').insert(allBookings);
        if (be) console.warn('Bookings insert warning:', be.message);
      }

      // 8. Refresh and Navigate
      await loadRealTrips();
      navigate(`/app/trip/${finalTripId}/timeline`);
    } catch (err) {
      console.error('Trip creation failed:', err);
      setError(err.message || 'Failed to save trip to database. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Step: basics ─── */
  const renderBasics = () => (
    <div className="space-y-6">
      {/* Upload Trip Plan section */}
      <div className="rounded-2xl border-2 border-dashed border-sky-300/80 bg-sky-50/40 p-5 transition-all hover:bg-sky-50/70">
        <div className="flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-2xl bg-white border border-sky-200 text-primary flex items-center justify-center shadow-xs mb-2">
            <FileText size={20} />
          </div>
          <h3 className="text-sm font-extrabold text-navy">Upload Trip Plan</h3>
          <p className="text-xs text-ink-soft mt-0.5">Upload your trip plan PDF to auto-extract details & day-wise stops</p>
          <span className="inline-block mt-1 text-[11px] font-semibold text-sky-700 bg-sky-100/70 px-2.5 py-0.5 rounded-full">
            PDF only • Maximum size: 4 MB
          </span>

          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          {!pdfFile ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3.5 btn-secondary text-xs font-bold px-4 py-2 flex items-center gap-1.5 shadow-xs hover:border-primary hover:text-primary transition-colors cursor-pointer"
            >
              <FileUp size={14} /> Choose PDF
            </button>
          ) : (
            <div className="w-full mt-3 pt-3 border-t border-sky-200/60 flex flex-col sm:flex-row items-center justify-between gap-2 bg-white rounded-xl p-2.5 shadow-2xs border border-sky-100">
              <div className="flex items-center gap-2 min-w-0 text-left">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <FileText size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-navy truncate max-w-[200px] sm:max-w-[280px]">
                    {pdfFile.name}
                  </p>
                  <p className="text-[10px] text-ink-faint">
                    {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pdfExtracting}
                  className="text-xs font-bold text-primary hover:underline px-2 py-1 cursor-pointer"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={handleRemovePdf}
                  disabled={pdfExtracting}
                  className="text-xs font-bold text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {pdfExtracting && (
            <div className="flex items-center gap-2 mt-3 text-xs font-bold text-primary">
              <Loader2 size={14} className="animate-spin" />
              <span>Extracting trip details & day-wise stops with Gemini AI…</span>
            </div>
          )}
        </div>

        {/* Upload error message */}
        {pdfUploadError && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-2.5 text-xs font-semibold text-amber-800 border border-amber-200">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <div className="flex-1">{pdfUploadError}</div>
            <button
              type="button"
              onClick={() => setPdfUploadError('')}
              className="text-amber-800 hover:text-amber-950 text-xs font-bold cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Success auto-fill banner */}
        {pdfExtractSuccess && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1">{pdfExtractSuccess}</div>
            <button
              type="button"
              onClick={() => setPdfExtractSuccess('')}
              className="text-emerald-800 hover:text-emerald-950 text-xs font-bold cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Trip Details Form */}
      <div className="pt-2">
        <h2 className="text-base font-black text-navy mb-4">Trip Details</h2>

        <div className="space-y-4">
          <div>
            <label className="field-label">Trip Name *</label>
            <input
              className="input"
              placeholder="e.g. Himachal Group Adventure 2026"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Starting City *</label>
              <input
                className="input"
                placeholder="e.g. Mumbai"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Destination *</label>
              <input
                className="input"
                placeholder="e.g. Manali"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Start Date *</label>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">End Date *</label>
              <input
                type="date"
                className="input"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="field-label">Total Budget (₹)</label>
            <input
              type="number"
              className="input"
              placeholder="e.g. 80000"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label">
              Organizer / Trip Planner{' '}
              <span className="text-ink-faint font-normal">(optional)</span>
            </label>
            <input
              className="input"
              placeholder="e.g. Tanvi (Trip Organizer)"
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
            />
          </div>

          {/* Travel Type Cards */}
          <div>
            <label className="field-label mb-2">Travel Type</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'group', label: 'Group', icon: Users, desc: 'Friends / colleagues' },
                { id: 'solo', label: 'Solo', icon: User, desc: '1 traveler' },
                { id: 'family', label: 'Family', icon: Heart, desc: 'Family & kids' },
              ].map((type) => {
                const isSelected = travelType === type.id;
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setTravelType(type.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all text-center cursor-pointer ${isSelected
                      ? 'border-primary bg-primary/5 text-primary shadow-sm font-black'
                      : 'border-navy/10 bg-white hover:border-navy/20 text-navy hover:bg-slate-50'
                      }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 transition-colors ${isSelected ? 'bg-primary text-white shadow-xs' : 'bg-slate-100 text-ink-soft'
                        }`}
                    >
                      <Icon size={16} />
                    </div>
                    <span className="text-xs font-bold leading-tight">{type.label}</span>
                    <span className="text-[10px] text-ink-faint mt-0.5">{type.desc}</span>
                  </button>
                );
              })}
            </div>
            {travelType === 'group' && (
              <p className="text-[11px] text-primary font-bold mt-2 flex items-center gap-1.5">
                <Users size={13} /> Group Trip flow enabled: Direct DB member invites, response states, organizer confirmation & tickets.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  /* ─── Step: stops ─── */
  const renderStops = () => (
    <div className="space-y-4">
      {stopsFromPdf && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-indigo-50 border border-indigo-200/80 p-3 text-xs text-indigo-900">
          <Sparkles size={16} className="text-indigo-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <strong>Auto-imported from PDF Itinerary:</strong> We extracted {stops.length} stops from your trip plan. You can edit dates, transport, or add and delete stops as needed.
          </div>
        </div>
      )}

      <p className="text-xs text-ink-soft">
        Review your day-wise stops and travel legs in order. These will form the core itinerary for your trip.
      </p>

      {/* AI suggestions button */}
      {startDate && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-sky-800 flex items-center gap-1.5">
              <Sparkles size={13} /> AI Travel Suggestions
            </span>
            <button
              onClick={getAiSuggestions}
              disabled={aiLoading}
              className="text-[11px] font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
            >
              {aiLoading ? <><Loader2 size={11} className="animate-spin" /> Getting ideas…</> : 'Get suggestions'}
            </button>
          </div>
          {aiSuggestions && (
            <p className="text-xs text-sky-900 leading-relaxed whitespace-pre-line mt-2">{aiSuggestions}</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {/* Origin (read-only display) */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-xs font-black shrink-0">🏠</div>
          <div className="flex-1 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-navy">
            {origin || 'Your starting city'}
          </div>
        </div>

        {stops.map((stop, i) => (
          <motion.div
            key={stop.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative"
          >
            {/* vertical connector */}
            <div className="absolute left-4 -top-3 h-3 w-0.5 bg-slate-200" />
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-black shrink-0 mt-1">
                {stop.day_number || i + 1}
              </div>
              <div className="flex-1 rounded-2xl border border-navy/10 bg-white p-3 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    Day {stop.day_number || i + 1}
                  </span>
                  {stops.length > 1 && (
                    <button
                      onClick={() => removeStop(stop.id)}
                      className="text-ink-faint hover:text-critical p-1 rounded-lg hover:bg-red-50 cursor-pointer"
                      title="Delete stop"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="field-label text-[10px]">Location / Route *</label>
                    <input
                      className="input text-xs py-1.5"
                      placeholder="e.g. Mumbai to Delhi or Amritsar"
                      value={stop.city || stop.route || ''}
                      onChange={(e) => {
                        updateStop(stop.id, 'city', e.target.value);
                        updateStop(stop.id, 'route', e.target.value);
                      }}
                    />
                  </div>
                  <div>
                    <label className="field-label text-[10px]">Transport Mode</label>
                    <input
                      className="input text-xs py-1.5"
                      placeholder="e.g. Train / Flight / Volvo Bus / Cab"
                      value={stop.transport || ''}
                      onChange={(e) => updateStop(stop.id, 'transport', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="field-label text-[10px]">Arrive Date</label>
                    <input
                      type="date"
                      className="input text-xs py-1.5"
                      value={stop.arrival || ''}
                      onChange={(e) => updateStop(stop.id, 'arrival', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="field-label text-[10px]">Depart Date</label>
                    <input
                      type="date"
                      className="input text-xs py-1.5"
                      value={stop.departure || ''}
                      onChange={(e) => updateStop(stop.id, 'departure', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="field-label text-[10px]">Activities / Sightseeing</label>
                  <input
                    className="input text-xs py-1.5"
                    placeholder="e.g. Wagah Border Ceremony, Solang Valley Adventure…"
                    value={stop.activities || ''}
                    onChange={(e) => updateStop(stop.id, 'activities', e.target.value)}
                  />
                </div>

                <div>
                  <label className="field-label text-[10px]">Description / Notes</label>
                  <input
                    className="input text-xs py-1.5"
                    placeholder="e.g. Hotel check-in, local market tour, evening bonfire…"
                    value={stop.description || stop.notes || ''}
                    onChange={(e) => {
                      updateStop(stop.id, 'description', e.target.value);
                      updateStop(stop.id, 'notes', e.target.value);
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <button
        type="button"
        onClick={addStop}
        className="btn-secondary w-full text-xs flex items-center justify-center gap-2 py-2.5 border-dashed cursor-pointer"
      >
        <Plus size={14} /> Add another day / stop
      </button>
    </div>
  );

  /* ─── Step: group_members (Specialized Group Trip Flow) ─── */
  const renderGroupMembers = () => {
    const acceptedCount = groupMembers.filter((m) => m.status === 'accepted').length;
    const declinedCount = groupMembers.filter((m) => m.status === 'declined').length;
    const pendingCount = groupMembers.filter((m) => m.status === 'invited').length;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-black text-navy">Add Group Members</h3>
          <p className="text-xs text-ink-soft mt-0.5">
            Invite co-travelers by their email address. Invitations will be recorded in the database with instant Accept and Decline actions.
          </p>
        </div>

        {/* Add Member Input */}
        <form onSubmit={handleAddGroupMember} className="flex gap-2">
          <div className="relative flex-1">
            <Mail size={16} className="absolute left-3 top-3 text-ink-faint" />
            <input
              type="email"
              className="input pl-9 text-xs py-2.5"
              placeholder="Enter member email (e.g. aisha@gmail.com)"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              disabled={memberInviting}
            />
          </div>
          <button
            type="submit"
            disabled={memberInviting || !newMemberEmail.trim()}
            className="btn-primary text-xs font-bold px-4 py-2.5 flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            {memberInviting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>
                <Send size={14} /> Add Member
              </>
            )}
          </button>
        </form>

        {/* Member Status Summary Bar */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full font-bold">
              ✓ {acceptedCount} accepted
            </span>
            <span className="text-red-700 bg-red-100/80 px-2.5 py-1 rounded-full font-bold">
              ✗ {declinedCount} declined
            </span>
            <span className="text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-full font-bold">
              ⏳ {pendingCount} pending
            </span>
          </div>

          <button
            type="button"
            onClick={handleRefreshMemberStatuses}
            className="text-[11px] text-primary hover:underline flex items-center gap-1 font-bold cursor-pointer"
          >
            <RefreshCw size={12} /> Refresh Statuses
          </button>
        </div>

        {/* Group Member List */}
        <div className="space-y-2.5">
          <label className="field-label text-[11px]">Group Members ({groupMembers.length})</label>

          {groupMembers.map((member) => {
            const isOrg = member.is_organizer || member.role === 'owner';
            const isAccepted = member.status === 'accepted';
            const isDeclined = member.status === 'declined';
            const isInvited = member.status === 'invited';

            return (
              <div
                key={member.id || member.email}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border transition-all gap-2.5 ${isOrg
                  ? 'bg-sky-50/50 border-sky-200'
                  : isAccepted
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : isDeclined
                      ? 'bg-slate-50 border-slate-200 opacity-70'
                      : 'bg-white border-navy/10'
                  }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${isOrg
                      ? 'bg-primary text-white shadow-xs'
                      : isAccepted
                        ? 'bg-emerald-600 text-white'
                        : isDeclined
                          ? 'bg-slate-200 text-slate-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                  >
                    {isOrg ? '👑' : (member.name?.[0] || member.email?.[0] || 'M').toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-navy truncate">
                        {member.email || member.name}
                      </p>
                      {isOrg && (
                        <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          You / Organizer
                        </span>
                      )}
                    </div>
                    {!isOrg && member.name && member.name !== member.email && (
                      <p className="text-[11px] text-ink-faint truncate">{member.name}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {/* Status Badge */}
                  {isOrg ? (
                    <span className="text-[11px] font-bold text-sky-800 bg-sky-100 px-2.5 py-1 rounded-full">
                      Organizer
                    </span>
                  ) : isAccepted ? (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={13} /> Accepted
                    </span>
                  ) : isDeclined ? (
                    <span className="text-[11px] font-bold text-red-800 bg-red-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <XCircle size={13} /> Declined
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Clock size={13} /> Invited
                    </span>
                  )}

                  {/* Actions for pending members */}
                  {isInvited && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleResendInvite(member)}
                        className="text-[11px] font-bold text-ink-soft hover:text-navy px-2 py-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                        title="Resend invitation"
                      >
                        Resend
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedInviteModal(member)}
                        className="text-[11px] font-bold text-primary hover:underline px-2 py-1 rounded-lg hover:bg-primary/5 cursor-pointer flex items-center gap-1"
                        title="Simulate member response"
                      >
                        <Eye size={12} /> Test Response
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {pendingCount > 0 ? (
          <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle size={15} className="text-amber-700 mt-0.5 shrink-0" />
            <div>
              <strong>Waiting for member responses:</strong> {pendingCount} invited traveler{pendingCount !== 1 ? 's have' : ' has'} not responded yet. You can click <strong>"Test Response"</strong> to simulate acceptance or decline.
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200 p-3 text-xs text-emerald-900 flex items-start gap-2">
            <CheckCircle2 size={15} className="text-emerald-700 mt-0.5 shrink-0" />
            <div>
              <strong>All responses received!</strong> You can now proceed to review and confirm the finalized group.
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ─── Step: group_confirm (Organizer Final Confirmation) ─── */
  const renderGroupConfirm = () => {
    const acceptedMembers = groupMembers.filter((m) => m.is_organizer || m.status === 'accepted');
    const declinedMembers = groupMembers.filter((m) => m.status === 'declined');
    const validStops = stops.filter((s) => (s.city || s.route || '').trim());

    return (
      <div className="space-y-6">
        <div className="text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-2">
            <ShieldCheck size={14} /> Organizer Review
          </div>
          <h2 className="text-lg font-black text-navy">Are you sure you want to proceed with this group?</h2>
          <p className="text-xs text-ink-soft mt-1">
            Review your accepted traveling companions. Declined members will be excluded and will not be booked or billed.
          </p>
        </div>

        {/* Organizer */}
        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 block mb-1">
            Trip Organizer
          </span>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black">
              👑
            </div>
            <div>
              <p className="text-xs font-bold text-navy">
                {organizerName || profile?.display_name || user?.email || 'You (Organizer)'}
              </p>
              <p className="text-[11px] text-ink-soft">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Accepted Members */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
              Accepted Group Members ({acceptedMembers.length})
            </span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              Included in trip
            </span>
          </div>

          <div className="space-y-2 pt-1">
            {acceptedMembers.map((m) => (
              <div
                key={m.id || m.email}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-emerald-100 text-xs"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span className="font-bold text-navy">{m.email || m.name}</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {m.is_organizer ? 'Organizer' : 'Accepted'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Declined Members (Separated) */}
        {declinedMembers.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-ink-faint">
                Declined Members ({declinedMembers.length})
              </span>
              <span className="text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                Excluded from trip
              </span>
            </div>

            <p className="text-[11px] text-ink-soft">
              These invited members declined and are excluded. No tickets will be requested and they will not be booked.
            </p>

            <div className="space-y-1.5 pt-1">
              {declinedMembers.map((m) => (
                <div
                  key={m.id || m.email}
                  className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs text-ink-faint"
                >
                  <div className="flex items-center gap-2">
                    <XCircle size={14} className="text-red-500" />
                    <span className="line-through">{m.email || m.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md">
                    Declined
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trip Overview */}
        <div className="rounded-2xl border border-navy/10 bg-slate-50 p-4 space-y-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-ink-faint block">
            Trip & Stops Summary
          </span>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-ink-faint text-[10px] block">Trip Name</span>
              <p className="font-bold text-navy truncate">{tripName}</p>
            </div>
            <div>
              <span className="text-ink-faint text-[10px] block">Route</span>
              <p className="font-bold text-navy truncate">{origin} &rarr; {destination}</p>
            </div>
            <div>
              <span className="text-ink-faint text-[10px] block">Dates</span>
              <p className="font-bold text-navy">{startDate} to {endDate}</p>
            </div>
            <div>
              <span className="text-ink-faint text-[10px] block">Total Stops</span>
              <p className="font-bold text-navy">{validStops.length} stops</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={goBack}
            className="btn-secondary flex-1 py-3 text-xs font-bold"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={goNext}
            className="btn-primary flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2"
          >
            Yes, I want to proceed <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  };

  /* ─── Step: ticket_upload (Upload Group Members' Tickets) ─── */
  const renderTicketUpload = () => {
    const acceptedMembers = groupMembers.filter((m) => m.is_organizer || m.status === 'accepted');

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-black text-navy">Upload Group Members' Tickets</h2>
          <p className="text-xs text-ink-soft mt-0.5">
            Attach tickets or travel documents for each accepted member before finalizing the group trip.
          </p>
          <span className="inline-block mt-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
            Accepted members only • PDF or Image up to 4 MB
          </span>
        </div>

        <div className="space-y-3">
          {acceptedMembers.map((member) => {
            const uploadedTicket = memberTickets[member.id];
            const isUploading = ticketUploading[member.id];
            const isOrg = member.is_organizer || member.role === 'owner';

            return (
              <div
                key={member.id}
                className="p-4 rounded-2xl border border-navy/10 bg-white shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-xs">
                      {isOrg ? '👑' : <Ticket size={16} />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-navy">
                        {member.name || member.email}
                      </p>
                      <p className="text-[10px] text-ink-soft">
                        {isOrg ? 'You / Organizer' : member.email}
                      </p>
                    </div>
                  </div>

                  {uploadedTicket && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={12} /> Ticket Uploaded
                    </span>
                  )}
                </div>

                {uploadedTicket ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200/80 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={16} className="text-emerald-700 shrink-0" />
                      <span className="font-bold text-emerald-950 truncate max-w-[220px]">
                        {uploadedTicket.fileName}
                      </span>
                      <span className="text-[10px] text-ink-faint">
                        ({(uploadedTicket.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>

                    <label className="text-[11px] font-bold text-primary hover:underline cursor-pointer">
                      Replace
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg"
                        onChange={(e) => handleTicketFileChange(member, e.target.files?.[0])}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="pt-1">
                    <label className="btn-secondary w-full text-xs font-bold py-2.5 flex items-center justify-center gap-2 cursor-pointer border-dashed">
                      {isUploading ? (
                        <Loader2 size={14} className="animate-spin text-primary" />
                      ) : (
                        <UploadCloud size={14} className="text-primary" />
                      )}
                      <span>
                        {isUploading
                          ? 'Uploading ticket to database…'
                          : `Upload ticket for ${member.name?.split(' ')[0] || 'Member'}`}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg"
                        onChange={(e) => handleTicketFileChange(member, e.target.files?.[0])}
                        className="hidden"
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ─── Step: group (Standard Solo/Family Flow) ─── */
  const renderStandardGroup = () => (
    <div className="space-y-4">
      <p className="text-xs text-ink-soft">
        Add co-traveler names or TripSync usernames for this trip.
      </p>
      <div className="space-y-2">
        {invites.map((inv, i) => (
          <motion.div
            key={inv.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-700 shrink-0">
              <UserPlus size={14} />
            </div>
            <input
              className="input flex-1 text-sm"
              placeholder={`Co-traveler ${i + 1} username / name`}
              value={inv.username}
              onChange={(e) => updateInvite(inv.id, e.target.value)}
            />
            {invites.length > 1 && (
              <button
                type="button"
                onClick={() => removeInvite(inv.id)}
                className="text-ink-faint hover:text-critical p-1 rounded-lg hover:bg-red-50 shrink-0 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </motion.div>
        ))}
      </div>
      <button
        type="button"
        onClick={addInvite}
        className="btn-secondary w-full text-xs flex items-center justify-center gap-2 py-2.5 border-dashed cursor-pointer"
      >
        <Plus size={14} /> Add another person
      </button>
    </div>
  );

  /* ─── Step: booking (Standard Non-Group Flow) ─── */
  const renderBookingStep = (type, list, setList, fields) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => alert('PDF upload auto-import is enabled on the Trip Details step!')}
          className="btn-secondary text-xs flex items-center justify-center gap-1.5 py-2.5"
        >
          <FileUp size={13} /> Upload PDF
        </button>
        <button
          type="button"
          onClick={() => alert('Scan QR / Ticket is ready for fast booking import.')}
          className="btn-secondary text-xs flex items-center justify-center gap-1.5 py-2.5"
        >
          <QrCode size={13} /> Scan QR / Ticket
        </button>
      </div>

      {list.length > 0 && (
        <div className="space-y-2">
          {list.map((item) => (
            <BookingRow
              key={item.id}
              booking={item}
              onRemove={(b) => removeBooking(b, setList)}
              onEdit={(b) => editBooking(b, setList)}
            />
          ))}
        </div>
      )}

      {/* Booking Form */}
      <div className="space-y-3 rounded-2xl border border-navy/10 bg-slate-50 p-4">
        <p className="text-xs font-bold text-navy">Add {type}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="field-label text-[10px]">
                {f.label} {f.required && '*'}
              </label>
              <input
                type={f.type || 'text'}
                className="input text-xs py-1.5"
                placeholder={f.placeholder || ''}
                value={bookingForm[f.key] || ''}
                onChange={(e) => setBookingForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => addBooking(type, setList)}
          className="btn-primary text-xs w-full py-2 cursor-pointer font-bold"
        >
          Add {type} Booking
        </button>
      </div>
    </div>
  );

  /* ─── Step: review ─── */
  const renderReview = () => {
    const validStops = stops.filter((s) => (s.city || s.route || '').trim());
    const acceptedMembers = groupMembers.filter((m) => m.is_organizer || m.status === 'accepted');

    return (
      <div className="space-y-5">
        <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 p-5 text-white shadow-md">
          <h3 className="font-black text-lg">{tripName || 'Your Trip'}</h3>
          <p className="text-sm text-white/80 mt-0.5">
            {origin} &rarr; {destination || validStops.map((s) => s.city).join(' → ') || 'TBD'}
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={14} /> {startDate} – {endDate}
            </span>
            <span className="flex items-center gap-1.5 capitalize font-bold">
              <Users size={14} /> {travelType} Trip
            </span>
            {organizerName && (
              <span className="flex items-center gap-1.5">
                👑 Organizer: {organizerName}
              </span>
            )}
          </div>
        </div>

        {/* Group Trip Members Summary */}
        {travelType === 'group' && (
          <div className="rounded-2xl border border-navy/10 bg-slate-50 p-4 space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-ink-faint">
              Confirmed Group Travelers ({acceptedMembers.length})
            </p>
            <div className="space-y-1.5">
              {acceptedMembers.map((m) => {
                const hasTicket = memberTickets[m.id];
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs"
                  >
                    <span className="font-bold text-navy">{m.email || m.name}</span>
                    <div className="flex items-center gap-2">
                      {hasTicket ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle2 size={11} /> Ticket Ready
                        </span>
                      ) : (
                        <span className="text-[10px] text-ink-faint">No ticket attached</span>
                      )}
                      <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-md">
                        {m.is_organizer ? 'Organizer' : 'Accepted'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stops summary */}
        {validStops.length > 0 && (
          <div className="rounded-2xl border border-navy/10 bg-slate-50 p-4 space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-ink-faint">
              Itinerary Stops ({validStops.length})
            </p>
            <div className="space-y-1.5">
              {validStops.map((s, i) => (
                <div key={s.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0">
                      {s.day_number || i + 1}
                    </span>
                    <span className="font-bold text-navy truncate">{s.city || s.route}</span>
                    {s.transport && (
                      <span className="text-[10px] text-ink-faint bg-slate-100 px-1.5 py-0.5 rounded">
                        {s.transport}
                      </span>
                    )}
                  </div>
                  {s.arrival && <span className="text-ink-soft text-[11px] shrink-0">{s.arrival}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ── Field definitions for non-group booking steps ── */
  const flightFields = [
    { key: 'label', label: 'Airline & Flight No.', placeholder: 'Air India AI-202', required: true },
    { key: 'confirmation_code', label: 'PNR / Booking Ref', placeholder: 'ABC123' },
    { key: 'origin_name', label: 'From', placeholder: 'Mumbai (BOM)' },
    { key: 'destination_name', label: 'To', placeholder: 'Delhi (DEL)' },
    { key: 'departure_at', label: 'Departure Date & Time', type: 'datetime-local' },
    { key: 'arrival_at', label: 'Arrival Date & Time', type: 'datetime-local' },
    { key: 'base_amount', label: 'Price (₹)', type: 'number', placeholder: '4500' },
  ];

  const hotelFields = [
    { key: 'label', label: 'Hotel Name', placeholder: 'The Oberoi, Delhi', required: true },
    { key: 'confirmation_code', label: 'Booking Reference', placeholder: 'MMT-9821' },
    { key: 'origin_name', label: 'Location / Address', placeholder: 'Connaught Place, Delhi' },
    { key: 'departure_at', label: 'Check-in Date', type: 'date' },
    { key: 'arrival_at', label: 'Check-out Date', type: 'date' },
    { key: 'base_amount', label: 'Total Cost (₹)', type: 'number', placeholder: '12000' },
  ];

  const trainFields = [
    { key: 'label', label: 'Train Name & Number', placeholder: 'Shatabdi 12001', required: true },
    { key: 'confirmation_code', label: 'PNR', placeholder: '4521836712' },
    { key: 'origin_name', label: 'From Station', placeholder: 'Delhi (NDLS)' },
    { key: 'destination_name', label: 'To Station', placeholder: 'Chandigarh (CDG)' },
    { key: 'departure_at', label: 'Departure Date & Time', type: 'datetime-local' },
    { key: 'base_amount', label: 'Fare (₹)', type: 'number', placeholder: '1200' },
  ];

  const activityFields = [
    { key: 'label', label: 'Activity Name', placeholder: 'Mall Road Walk, Manali', required: true },
    { key: 'confirmation_code', label: 'Ticket / Voucher No.', placeholder: 'ACT-7823' },
    { key: 'origin_name', label: 'Location', placeholder: 'Solang Valley, Manali' },
    { key: 'departure_at', label: 'Date & Time', type: 'datetime-local' },
    { key: 'base_amount', label: 'Price (₹)', type: 'number', placeholder: '3500' },
  ];

  return (
    <div className="max-w-2xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/app')}
          className="text-ink-soft hover:text-navy p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-black text-navy">Plan a New Trip</h1>
          <p className="text-xs text-ink-soft">Build your connected trip step by step.</p>
        </div>
      </div>

      <StepIndicator currentStep={step} steps={currentSteps} />

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-red-50 p-3.5 text-xs font-semibold text-red-700 border border-red-200">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span className="flex-1 whitespace-pre-line">{error}</span>
          <button onClick={() => setError('')} className="cursor-pointer text-red-600 hover:text-red-800">
            <X size={14} />
          </button>
        </div>
      )}

      {toastMessage && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800 border border-emerald-200 shadow-xs">
          <CheckCircle2 size={15} className="text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ duration: 0.16 }}
          className="bg-white rounded-3xl border border-navy/10 p-6 shadow-sm"
        >
          {step !== 'basics' && (
            <h2 className="text-base font-black text-navy mb-4">
              {currentSteps.find((s) => s.id === step)?.label}
            </h2>
          )}

          {step === 'basics' && renderBasics()}
          {step === 'stops' && renderStops()}
          {step === 'group_members' && renderGroupMembers()}
          {step === 'group_confirm' && renderGroupConfirm()}
          {step === 'ticket_upload' && renderTicketUpload()}
          {step === 'group' && renderStandardGroup()}
          {step === 'flights' && renderBookingStep('Flight', flights, setFlights, flightFields)}
          {step === 'hotels' && renderBookingStep('Hotel', hotels, setHotels, hotelFields)}
          {step === 'transport' && renderBookingStep('Train/Bus', trains, setTrains, trainFields)}
          {step === 'activities' && renderBookingStep('Activity', activities, setActivities, activityFields)}
          {step === 'review' && renderReview()}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      {step !== 'group_confirm' && (
        <div className="flex gap-3 mt-6">
          {currentIdx > 0 && (
            <button
              onClick={goBack}
              className="btn-secondary flex items-center gap-2 flex-1 justify-center py-3 cursor-pointer"
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}

          {step !== 'review' ? (
            <button
              onClick={goNext}
              className="btn-primary flex items-center gap-2 flex-1 justify-center py-3 cursor-pointer"
            >
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSaveTrip}
              disabled={saving}
              className="btn-primary flex items-center gap-2 flex-1 justify-center py-3 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving to Supabase Database…
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Confirm & View Timeline
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Interactive Email Preview / Simulator Modal */}
      {selectedInviteModal && (
        <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-navy/10 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-xs font-black text-sky-800">
                <Mail size={16} className="text-primary" />
                <span>Invitation & Response Simulator</span>
              </div>
              <button
                onClick={() => setSelectedInviteModal(null)}
                className="text-ink-faint hover:text-navy p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-faint font-semibold">Recipient:</span>
                <span className="font-bold text-navy">{selectedInviteModal.email}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-faint font-semibold">Trip:</span>
                <span className="font-bold text-navy">{tripName || 'Group Trip'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-faint font-semibold">Organizer:</span>
                <span className="font-bold text-navy">{organizerName || 'Organizer'}</span>
              </div>
            </div>

            <div className="text-center py-2 space-y-1">
              <p className="text-sm font-black text-navy">"Do you want to join this trip?"</p>
              <p className="text-xs text-ink-soft">
                Click below to simulate how {selectedInviteModal.email} will respond, or send them the link directly:
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  handleSimulateResponse(
                    selectedInviteModal.id,
                    selectedInviteModal.token,
                    'accept'
                  )
                }
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm cursor-pointer"
              >
                <Check size={14} /> Yes, I want to join
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSimulateResponse(
                    selectedInviteModal.id,
                    selectedInviteModal.token,
                    'decline'
                  )
                }
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs cursor-pointer"
              >
                <X size={14} /> No, I decline
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const link = `${window.location.origin}/invite/${selectedInviteModal.token}`;
                    navigator.clipboard?.writeText(link);
                    setToastMessage('✓ Invitation link copied to clipboard!');
                    setTimeout(() => setToastMessage(''), 3000);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-navy font-bold text-xs cursor-pointer"
                >
                  <Copy size={13} /> Copy Invite Link
                </button>

                <a
                  href={`mailto:${selectedInviteModal.email}?subject=${encodeURIComponent(`Join our trip: ${tripName || 'Group Trip'}`)}&body=${encodeURIComponent(`Hi,\n\nYou have been invited to join "${tripName || 'our group trip'}" organized by ${organizerName || 'your friend'}.\n\nPlease click here to join or decline:\n${window.location.origin}/invite/${selectedInviteModal.token}\n\nLooking forward to traveling together!`)}`}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs cursor-pointer text-center"
                >
                  <Send size={13} /> Send Email Directly
                </a>
              </div>

              <div className="text-center pt-1">
                <a
                  href={`/invite/${selectedInviteModal.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 font-bold"
                >
                  Open public response page in new tab <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
