import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Phone,
  HeartPulse,
  Fingerprint,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  FileText,
  AlertCircle,
  Clock,
  Eye,
  Camera,
  Check,
  Plane,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  saveProfileDetails,
  saveEmergencyContact,
  uploadTravelDocument,
  updateProfileSetupStatus,
  loadOnboardingData,
  saveProfileExtras,
  findDocument,
} from '../../services/onboardingService.js';
import { calculateProfileScore } from '../../services/profileService.js';

const STEPS = [
  { id: 'personal', name: 'Personal Details', icon: User, weight: 25 },
  { id: 'contact', name: 'Contact Details', icon: Phone, weight: 15 },
  { id: 'emergency', name: 'Emergency Contact', icon: HeartPulse, weight: 15 },
  { id: 'identity', name: 'Travel Identity', icon: Fingerprint, weight: 20 },
  { id: 'insurance', name: 'Health Insurance', icon: ShieldCheck, weight: 10 },
  { id: 'review', name: 'Review & Continue', icon: CheckCircle2, weight: 15 },
];

const STEP_IDS = STEPS.map((s) => s.id);

function formatDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export default function TravelProfileSetupPage() {
  const { user, profile, displayName, fetchProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEdit = searchParams.get('mode') === 'edit';
  const requestedStep = searchParams.get('step');

  const [currentStepIndex, setCurrentStepIndex] = useState(() => {
    const idx = STEP_IDS.indexOf(requestedStep);
    return idx >= 0 ? idx : 0;
  });
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Personal Details State
  const [personal, setPersonal] = useState({
    fullName: profile?.display_name || user?.user_metadata?.full_name || '',
    dateOfBirth: profile?.date_of_birth || '',
    gender: 'Prefer not to say',
    nationality: profile?.nationality || 'Indian',
    country: profile?.home_country || 'India',
    address: '',
    city: profile?.home_city || '',
    state: '',
    postalCode: '',
    photoFile: null,
    photoPreview: null,
  });

  // 2. Contact Details State
  const [contact, setContact] = useState({
    phone: profile?.phone || '',
    email: profile?.email || user?.email || '',
    altPhone: '',
    language: 'English',
    seatPreference: 'Window',
    mealPreference: 'Regular',
    accessibility: '',
    whatsappUpdates: true,
  });

  // 3. Emergency Contact State
  const [emergency, setEmergency] = useState({
    name: '',
    relationship: 'Parent',
    phone: '',
    altPhone: '',
  });

  // 4. Travel Identity Documents State
  const [identityDocs, setIdentityDocs] = useState({
    passport: { uploaded: false, fileName: '', file: null, number: '' },
    aadhaar: { uploaded: false, fileName: '', file: null, number: '' },
    pan: { uploaded: false, fileName: '', file: null, number: '' },
    drivingLicense: { uploaded: false, fileName: '', file: null, number: '' },
  });

  // 5. Health Insurance State
  const [insurance, setInsurance] = useState({
    provider: '',
    policyNumber: '',
    policyType: 'Comprehensive Travel & Medical',
    startDate: '',
    expiryDate: '',
    file: null,
    uploaded: false,
    fileName: '',
  });

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      if (!user?.id) {
        setHydrated(true);
        return;
      }
      try {
        const data = await loadOnboardingData(user.id);
        if (!mounted) return;
        const saved = data.profile || profile || {};
        const extras = data.extras || {};
        const fullName =
          [saved.first_name, saved.last_name].filter(Boolean).join(' ') ||
          saved.display_name ||
          displayName ||
          '';

        setPersonal((prev) => ({
          ...prev,
          fullName: extras.fullName || fullName || prev.fullName,
          dateOfBirth: formatDateInput(saved.date_of_birth) || extras.dateOfBirth || prev.dateOfBirth,
          gender: extras.gender || prev.gender,
          nationality: saved.nationality || extras.nationality || prev.nationality,
          country: saved.home_country || extras.country || prev.country,
          address: extras.address || prev.address,
          city: saved.home_city || extras.city || prev.city,
          state: extras.state || prev.state,
          postalCode: extras.postalCode || prev.postalCode,
        }));

        setContact((prev) => ({
          ...prev,
          phone: saved.phone || extras.phone || prev.phone,
          email: saved.email || user?.email || extras.email || prev.email,
          altPhone: extras.altPhone || prev.altPhone,
          language: saved.preferred_language || extras.language || prev.language,
          seatPreference: extras.seatPreference || prev.seatPreference,
          mealPreference: extras.mealPreference || prev.mealPreference,
          accessibility: extras.accessibility || prev.accessibility,
          whatsappUpdates: extras.whatsappUpdates ?? prev.whatsappUpdates,
        }));

        if (data.emergency) {
          setEmergency((prev) => ({
            ...prev,
            name: data.emergency.name || data.emergency.contact_name || prev.name,
            relationship: data.emergency.relationship || prev.relationship,
            phone: data.emergency.phone || prev.phone,
            altPhone: extras.emergencyAltPhone || prev.altPhone,
          }));
        }

        const passport = findDocument(data.documents, ['passport']);
        const aadhaar = findDocument(data.documents, ['aadhaar', 'aadhaarcard', 'id']);
        const pan = findDocument(data.documents, ['pan', 'pancard']);
        const license = findDocument(data.documents, ['drivinglicense', 'license']);
        setIdentityDocs((prev) => ({
          passport: {
            ...prev.passport,
            uploaded: Boolean(passport),
            fileName: passport?.file_name || prev.passport.fileName,
            number: extras.passportNumber || prev.passport.number || (passport ? 'On file' : ''),
          },
          aadhaar: {
            ...prev.aadhaar,
            uploaded: Boolean(aadhaar),
            fileName: aadhaar?.file_name || prev.aadhaar.fileName,
            number: extras.aadhaarNumber || prev.aadhaar.number || (aadhaar ? 'On file' : ''),
          },
          pan: {
            ...prev.pan,
            uploaded: Boolean(pan),
            fileName: pan?.file_name || prev.pan.fileName,
            number: extras.panNumber || prev.pan.number || (pan ? 'On file' : ''),
          },
          drivingLicense: {
            ...prev.drivingLicense,
            uploaded: Boolean(license),
            fileName: license?.file_name || prev.drivingLicense.fileName,
            number: extras.licenseNumber || prev.drivingLicense.number || (license ? 'On file' : ''),
          },
        }));

        const insuranceDoc = findDocument(data.documents, ['insurance']);
        setInsurance((prev) => ({
          ...prev,
          provider: extras.insuranceProvider || prev.provider,
          policyNumber: extras.policyNumber || prev.policyNumber,
          policyType: extras.policyType || prev.policyType,
          startDate: extras.insuranceStart || prev.startDate,
          expiryDate: formatDateInput(insuranceDoc?.expires_at || extras.expiryDate) || prev.expiryDate,
          uploaded: Boolean(insuranceDoc) || prev.uploaded,
          fileName: insuranceDoc?.file_name || extras.insuranceFileName || prev.fileName,
        }));
      } catch (err) {
        console.warn('Could not load saved profile:', err);
      } finally {
        if (mounted) setHydrated(true);
      }
    }
    hydrate();
    return () => { mounted = false; };
  }, [user?.id]);

  function persistExtras() {
    if (!user?.id) return;
    saveProfileExtras(user.id, {
      fullName: personal.fullName,
      dateOfBirth: personal.dateOfBirth,
      gender: personal.gender,
      nationality: personal.nationality,
      country: personal.country,
      address: personal.address,
      city: personal.city,
      state: personal.state,
      postalCode: personal.postalCode,
      phone: contact.phone,
      email: contact.email,
      altPhone: contact.altPhone,
      language: contact.language,
      seatPreference: contact.seatPreference,
      mealPreference: contact.mealPreference,
      accessibility: contact.accessibility,
      whatsappUpdates: contact.whatsappUpdates,
      emergencyAltPhone: emergency.altPhone,
      passportNumber: identityDocs.passport.number,
      aadhaarNumber: identityDocs.aadhaar.number,
      panNumber: identityDocs.pan.number,
      licenseNumber: identityDocs.drivingLicense.number,
      insuranceProvider: insurance.provider,
      policyNumber: insurance.policyNumber,
      policyType: insurance.policyType,
      insuranceStart: insurance.startDate,
      expiryDate: insurance.expiryDate,
      insuranceFileName: insurance.fileName,
    });
  }

  // Calculate dynamic completion score
  const completionStats = calculateProfileScore({
    profile: {
      first_name: personal.fullName.split(' ')[0] || '',
      last_name: personal.fullName.split(' ').slice(1).join(' ') || '',
      full_name: personal.fullName,
      date_of_birth: personal.dateOfBirth,
      home_city: personal.city,
      nationality: personal.nationality,
      email: contact.email,
      phone: contact.phone,
    },
    user,
    emergencyContacts: emergency.name && emergency.phone ? [emergency] : [],
    documents: [
      ...(identityDocs.passport.uploaded
        ? [{ document_type: 'passport', kind: 'passport' }]
        : []),
      ...(identityDocs.aadhaar.uploaded
        ? [{ document_type: 'id', kind: 'id' }]
        : []),
      ...(insurance.uploaded
        ? [{ document_type: 'insurance', kind: 'insurance', title: insurance.provider }]
        : []),
    ],
  });

  const percentage = completionStats.percentage;
  const itemsRemaining = completionStats.items_remaining;

  const currentStep = STEPS[currentStepIndex];

  // Step Nav Handlers
  const handleNext = async () => {
    setErrorMsg('');
    setSaving(true);

    try {
      if (user?.id) {
        // Save current step data to Supabase
        if (currentStep.id === 'personal') {
          const parts = personal.fullName.trim().split(' ');
          await saveProfileDetails(user.id, {
            firstName: parts[0] || 'Traveler',
            lastName: parts.slice(1).join(' '),
            fullName: personal.fullName,
            dateOfBirth: personal.dateOfBirth,
            nationality: personal.nationality,
            city: personal.city,
            country: personal.country,
          });
        } else if (currentStep.id === 'contact') {
          const parts = personal.fullName.trim().split(' ');
          await saveProfileDetails(user.id, {
            firstName: parts[0] || 'Traveler',
            lastName: parts.slice(1).join(' '),
            fullName: personal.fullName,
            dateOfBirth: personal.dateOfBirth,
            nationality: personal.nationality,
            city: personal.city,
            country: personal.country,
            phone: contact.phone,
            email: contact.email,
            language: contact.language,
          });
        } else if (currentStep.id === 'emergency') {
          if (emergency.name && emergency.phone) {
            await saveEmergencyContact(user.id, emergency);
          }
        }
      }

      persistExtras();

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1500);

      if (currentStepIndex < STEPS.length - 1) {
        setCurrentStepIndex((prev) => prev + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Error saving step:', err);
      setErrorMsg(err.message || 'Could not save data. Continuing to next step...');
      // Still allow progression
      if (currentStepIndex < STEPS.length - 1) {
        setCurrentStepIndex((prev) => prev + 1);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFinishOnboarding = async () => {
    setSaving(true);
    try {
      persistExtras();
      if (user?.id) {
        const parts = personal.fullName.trim().split(' ');
        await saveProfileDetails(user.id, {
          firstName: parts[0] || 'Traveler',
          lastName: parts.slice(1).join(' '),
          fullName: personal.fullName,
          dateOfBirth: personal.dateOfBirth,
          nationality: personal.nationality,
          city: personal.city,
          country: personal.country,
          phone: contact.phone,
          email: contact.email,
          language: contact.language,
        });
        if (emergency.name && emergency.phone) {
          await saveEmergencyContact(user.id, emergency);
        }
        await updateProfileSetupStatus(user.id, 'completed');
        if (fetchProfile) await fetchProfile(user.id);
      }
      navigate(isEdit ? '/app/profile' : '/app', { replace: true });
    } catch (err) {
      console.error('Finalize error:', err);
      navigate(isEdit ? '/app/profile' : '/app', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  // Helper for document upload simulated / real handling
  const handleDocUpload = async (docKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIdentityDocs((prev) => ({
      ...prev,
      [docKey]: {
        ...prev[docKey],
        uploaded: true,
        fileName: file.name,
        file,
        number: prev[docKey].number || '•••• •••• ' + Math.floor(1000 + Math.random() * 9000),
      },
    }));

    if (user?.id) {
      try {
        await uploadTravelDocument(user.id, file, docKey);
      } catch (err) {
        console.warn('Doc upload note:', err.message);
      }
    }
  };

  const handleInsuranceUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setInsurance((prev) => ({
      ...prev,
      file,
      uploaded: true,
      fileName: file.name,
    }));

    if (user?.id) {
      try {
        await uploadTravelDocument(user.id, file, 'insurance', {
          expiryDate: insurance.expiryDate,
        });
      } catch (err) {
        console.warn('Insurance upload note:', err.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-navy/10 py-3.5 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-white shadow-md">
              <Plane size={18} />
            </div>
            <div>
              <p className="text-sm font-black text-navy leading-none">TripSync</p>
              <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest mt-0.5">
                {isEdit ? 'Edit travel profile' : 'Travel Profile Setup'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isEdit && (
              <button
                type="button"
                onClick={() => navigate('/app/profile')}
                className="text-xs font-semibold text-ink-soft hover:text-navy"
              >
                Cancel
              </button>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black text-navy">{percentage}% Complete</p>
              <p className="text-[10px] font-bold text-ink-soft">
                {itemsRemaining === 0 ? 'All sections completed' : `${itemsRemaining} sections remaining`}
              </p>
            </div>

            {/* Quick mini circular progress */}
            <div className="relative w-8 h-8 flex items-center justify-center">
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="13" stroke="#e2e8f0" strokeWidth="3" fill="none" />
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  stroke="#0284c7"
                  strokeWidth="3"
                  strokeDasharray="81.68"
                  strokeDashoffset={81.68 - (percentage / 100) * 81.68}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-8">
        {/* Left Step Sidebar */}
        <aside className="w-full md:w-64 shrink-0 space-y-2">
          <div className="rounded-3xl bg-white border border-navy/10 p-4 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-wider text-ink-soft mb-3 px-2">
              Setup Steps
            </p>
            <nav className="space-y-1">
              {STEPS.map((s, idx) => {
                const Icon = s.icon;
                const isActive = idx === currentStepIndex;
                const isPassed = idx < currentStepIndex;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCurrentStepIndex(idx)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left ${
                      isActive
                        ? 'bg-sky-500 text-white shadow-md'
                        : isPassed
                        ? 'text-navy hover:bg-slate-50'
                        : 'text-slate-400 hover:text-navy'
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : isPassed
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {isPassed ? <Check size={14} /> : <Icon size={14} />}
                    </div>
                    <span className="truncate">{s.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="rounded-3xl bg-sky-50/70 border border-sky-100 p-4 text-xs text-sky-900 hidden md:block">
            <p className="font-bold flex items-center gap-1.5 mb-1 text-sky-800">
              <ShieldAlert size={14} /> Private & Secure
            </p>
            <p className="text-[11px] text-sky-700 leading-relaxed">
              Your identity files are kept in encrypted private storage and never shared without authorization.
            </p>
          </div>
        </aside>

        {/* Right Active Step Content */}
        <main className="flex-1 min-w-0">
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="rounded-3xl bg-white border border-navy/10 p-6 sm:p-8 shadow-sm space-y-6"
          >
            {/* Step Header */}
            <div className="border-b border-navy/5 pb-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-sky-600">
                  Step {currentStepIndex + 1} of {STEPS.length}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                  Weight: {currentStep.weight}%
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-navy mt-1">{currentStep.name}</h2>
            </div>

            {/* Error / Success Toast */}
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* STEP 1: PERSONAL DETAILS */}
            {/* ────────────────────────────────────────────────────────── */}
            {currentStep.id === 'personal' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-navy">Full Legal Name *</label>
                    <input
                      type="text"
                      required
                      value={personal.fullName}
                      onChange={(e) => setPersonal({ ...personal, fullName: e.target.value })}
                      placeholder="e.g. Sneha Mathur"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Date of Birth *</label>
                    <input
                      type="date"
                      required
                      value={personal.dateOfBirth}
                      onChange={(e) => setPersonal({ ...personal, dateOfBirth: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Gender *</label>
                    <select
                      value={personal.gender}
                      onChange={(e) => setPersonal({ ...personal, gender: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Nationality *</label>
                    <input
                      type="text"
                      required
                      value={personal.nationality}
                      onChange={(e) => setPersonal({ ...personal, nationality: e.target.value })}
                      placeholder="e.g. Indian"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Country of Residence *</label>
                    <input
                      type="text"
                      required
                      value={personal.country}
                      onChange={(e) => setPersonal({ ...personal, country: e.target.value })}
                      placeholder="e.g. India"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-navy">Street Address *</label>
                    <input
                      type="text"
                      required
                      value={personal.address}
                      onChange={(e) => setPersonal({ ...personal, address: e.target.value })}
                      placeholder="e.g. 102 Green Heights, Bandra West"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">City *</label>
                    <input
                      type="text"
                      required
                      value={personal.city}
                      onChange={(e) => setPersonal({ ...personal, city: e.target.value })}
                      placeholder="e.g. Mumbai"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">State *</label>
                    <input
                      type="text"
                      required
                      value={personal.state}
                      onChange={(e) => setPersonal({ ...personal, state: e.target.value })}
                      placeholder="e.g. Maharashtra"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Postal Code *</label>
                    <input
                      type="text"
                      required
                      value={personal.postalCode}
                      onChange={(e) => setPersonal({ ...personal, postalCode: e.target.value })}
                      placeholder="e.g. 400050"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  {/* Profile Photo (Optional) */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Profile Photo (Optional)</label>
                    <label className="flex items-center gap-3 p-2 rounded-2xl border border-dashed border-slate-300 hover:border-sky-400 cursor-pointer bg-slate-50">
                      <Camera size={18} className="text-slate-400 ml-2" />
                      <span className="text-xs font-semibold text-slate-500 truncate">
                        {personal.photoFile ? personal.photoFile.name : 'Upload JPEG or PNG'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setPersonal({ ...personal, photoFile: file });
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* STEP 2: CONTACT DETAILS */}
            {/* ────────────────────────────────────────────────────────── */}
            {currentStep.id === 'contact' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Mobile Number *</label>
                    <input
                      type="tel"
                      required
                      value={contact.phone}
                      onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={contact.email}
                      onChange={(e) => setContact({ ...contact, email: e.target.value })}
                      placeholder="you@example.com"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Alternate Phone (Optional)</label>
                    <input
                      type="tel"
                      value={contact.altPhone}
                      onChange={(e) => setContact({ ...contact, altPhone: e.target.value })}
                      placeholder="+91 98220 12345"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Preferred Language</label>
                    <select
                      value={contact.language}
                      onChange={(e) => setContact({ ...contact, language: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="English">English</option>
                      <option value="Hindi">Hindi</option>
                      <option value="Spanish">Spanish</option>
                      <option value="French">French</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Seat Preference</label>
                    <select
                      value={contact.seatPreference}
                      onChange={(e) => setContact({ ...contact, seatPreference: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="Window">Window</option>
                      <option value="Aisle">Aisle</option>
                      <option value="Middle">Middle / Any</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Meal Preference</label>
                    <select
                      value={contact.mealPreference}
                      onChange={(e) => setContact({ ...contact, mealPreference: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="Regular">Regular</option>
                      <option value="Vegetarian">Vegetarian</option>
                      <option value="Vegan">Vegan</option>
                      <option value="Halal">Halal</option>
                      <option value="Gluten-Free">Gluten-Free</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-navy">
                      Accessibility Requirements (Optional)
                    </label>
                    <input
                      type="text"
                      value={contact.accessibility}
                      onChange={(e) => setContact({ ...contact, accessibility: e.target.value })}
                      placeholder="e.g. Wheelchair assistance, ground floor rooms"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {/* WhatsApp Preference Toggle */}
                <div className="pt-2">
                  <label className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={contact.whatsappUpdates}
                      onChange={(e) => setContact({ ...contact, whatsappUpdates: e.target.checked })}
                      className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <div>
                      <p className="text-xs font-bold text-emerald-950">
                        Receive travel updates on WhatsApp
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        Instant notification of flight delays, platform changes, and recovery plans.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* STEP 3: EMERGENCY CONTACT */}
            {/* ────────────────────────────────────────────────────────── */}
            {currentStep.id === 'emergency' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs">
                  <p className="font-bold flex items-center gap-1.5 mb-0.5">
                    <HeartPulse size={15} className="text-amber-600" />
                    Emergency Safety Protocol
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    This contact may be notified in case of an emergency or severe journey disruption during your travels.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Contact Name *</label>
                    <input
                      type="text"
                      required
                      value={emergency.name}
                      onChange={(e) => setEmergency({ ...emergency, name: e.target.value })}
                      placeholder="e.g. Ramesh Mathur"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Relationship *</label>
                    <select
                      value={emergency.relationship}
                      onChange={(e) => setEmergency({ ...emergency, relationship: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="Parent">Parent</option>
                      <option value="Spouse / Partner">Spouse / Partner</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Friend">Friend</option>
                      <option value="Colleague">Colleague</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={emergency.phone}
                      onChange={(e) => setEmergency({ ...emergency, phone: e.target.value })}
                      placeholder="+91 99887 76655"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Alternate Phone (Optional)</label>
                    <input
                      type="tel"
                      value={emergency.altPhone}
                      onChange={(e) => setEmergency({ ...emergency, altPhone: e.target.value })}
                      placeholder="+91 91234 56789"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* STEP 4: TRAVEL IDENTITY */}
            {/* ────────────────────────────────────────────────────────── */}
            {currentStep.id === 'identity' && (
              <div className="space-y-4">
                <p className="text-xs text-ink-soft">
                  Upload government travel identity documents for instant check-in verification and airline rebooking.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: 'passport', name: 'Passport', icon: FileText, required: true },
                    { key: 'aadhaar', name: 'Aadhaar Card', icon: Fingerprint, required: false },
                    { key: 'pan', name: 'PAN Card', icon: FileText, required: false },
                    { key: 'drivingLicense', name: 'Driving License', icon: FileText, required: false },
                  ].map((card) => {
                    const item = identityDocs[card.key];
                    const Icon = card.icon;
                    return (
                      <div
                        key={card.key}
                        className="rounded-3xl border border-navy/10 p-4 bg-slate-50/50 flex flex-col justify-between space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                            <Icon size={18} />
                          </div>
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                              item.uploaded
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {item.uploaded ? 'Uploaded' : 'Pending'}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-xs font-black text-navy">{card.name}</h4>
                          <p className="text-[11px] font-mono text-ink-soft mt-0.5">
                            {item.uploaded ? item.number : 'No document uploaded yet'}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-navy/5 flex items-center justify-between">
                          <label className="btn-secondary py-1.5 px-3 text-[11px] font-bold rounded-xl cursor-pointer inline-flex items-center gap-1.5">
                            <Upload size={12} />
                            {item.uploaded ? 'Replace' : 'Upload'}
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              className="hidden"
                              onChange={(e) => handleDocUpload(card.key, e)}
                            />
                          </label>

                          {item.uploaded && (
                            <span className="text-[11px] font-bold text-sky-600 flex items-center gap-1">
                              <CheckCircle2 size={13} className="text-emerald-500" />
                              Ready
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* STEP 5: HEALTH INSURANCE */}
            {/* ────────────────────────────────────────────────────────── */}
            {currentStep.id === 'insurance' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Insurance Provider</label>
                    <input
                      type="text"
                      value={insurance.provider}
                      onChange={(e) => setInsurance({ ...insurance, provider: e.target.value })}
                      placeholder="e.g. Reliance General / Tata AIG"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Policy Number</label>
                    <input
                      type="text"
                      value={insurance.policyNumber}
                      onChange={(e) => setInsurance({ ...insurance, policyNumber: e.target.value })}
                      placeholder="e.g. TS-99218-IN"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Policy Type</label>
                    <select
                      value={insurance.policyType}
                      onChange={(e) => setInsurance({ ...insurance, policyType: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="Comprehensive Travel & Medical">Comprehensive Travel & Medical</option>
                      <option value="Overseas Mediclaim">Overseas Mediclaim</option>
                      <option value="Domestic Travel Protect">Domestic Travel Protect</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy">Expiry Date</label>
                    <input
                      type="date"
                      value={insurance.expiryDate}
                      onChange={(e) => setInsurance({ ...insurance, expiryDate: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-navy">Upload Insurance Policy PDF / Image</label>
                    <label className="flex items-center justify-between p-3.5 rounded-2xl border border-dashed border-slate-300 hover:border-sky-400 cursor-pointer bg-slate-50">
                      <div className="flex items-center gap-3">
                        <Upload size={18} className="text-sky-600" />
                        <div>
                          <p className="text-xs font-bold text-navy">
                            {insurance.uploaded ? insurance.fileName : 'Choose policy document'}
                          </p>
                          <p className="text-[11px] text-ink-soft">PDF, JPEG, or PNG up to 10MB</p>
                        </div>
                      </div>
                      <span className="btn-secondary py-1 px-3 text-[11px] font-bold rounded-xl">
                        {insurance.uploaded ? 'Replace' : 'Browse'}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={handleInsuranceUpload}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* STEP 6: REVIEW & CONTINUE */}
            {/* ────────────────────────────────────────────────────────── */}
            {currentStep.id === 'review' && (
              <div className="space-y-6">
                <div className="rounded-3xl bg-gradient-to-r from-sky-500 to-indigo-600 p-6 text-white text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6 shadow-lg shadow-sky-500/20">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold mb-2">
                      <Sparkles size={14} /> Profile Verification
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black">
                      {percentage >= 70 ? "🎉 You're Travel Ready!" : "You're Almost Travel-Ready"}
                    </h3>
                    <p className="text-xs text-white/80 mt-1 max-w-md">
                      Your travel profile is now configured in Supabase. You can explore your dashboard or update details anytime.
                    </p>
                  </div>

                  <div className="text-center bg-white/10 px-6 py-4 rounded-2xl backdrop-blur-xs">
                    <p className="text-3xl font-black">{percentage}%</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Readiness Score</p>
                  </div>
                </div>

                {/* Section Summary Checklist */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-black text-navy uppercase tracking-wider">
                    Category Breakdown
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(completionStats.sections).map(([key, sec]) => {
                      const isComplete = sec.status === 'complete';
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between p-3.5 rounded-2xl border border-navy/10 bg-slate-50/60 text-xs"
                        >
                          <span className="font-bold text-navy">{sec.name}</span>
                          <span
                            className={`font-black text-[11px] px-2.5 py-0.5 rounded-full ${
                              isComplete
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isComplete ? 'Complete' : 'Pending'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Form Actions */}
            <div className="pt-6 border-t border-navy/5 flex items-center justify-between">
              {currentStepIndex > 0 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="btn-secondary px-4 py-2.5 text-xs font-bold rounded-2xl flex items-center gap-1.5"
                >
                  <ArrowLeft size={14} /> Back
                </button>
              ) : (
                <div />
              )}

              {currentStepIndex === STEPS.length - 1 ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleFinishOnboarding}
                  className="btn-primary px-6 py-3 text-xs font-black rounded-2xl flex items-center gap-2 shadow-lg shadow-sky-500/25 active:scale-95 transition-all"
                >
                  {saving ? 'Saving…' : isEdit ? 'Save profile' : 'Go to Dashboard →'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleNext}
                  className="btn-primary px-6 py-2.5 text-xs font-black rounded-2xl flex items-center gap-2 shadow-md active:scale-95 transition-all"
                >
                  {saving ? 'Saving…' : isEdit ? 'Save & continue' : 'Save & Continue'}
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
