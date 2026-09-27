import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plane,
  Shield,
  Clock,
  Globe,
  Users,
  Check,
  Play,
  ArrowRight,
  ChevronRight,
  RefreshCw,
  Calendar,
  FileText,
  ShieldCheck,
  Compass,
  MapPin,
  Hotel,
  Camera,
  AlertCircle,
  Menu,
  X,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-navy flex flex-col antialiased">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-md shadow-primary/25 group-hover:scale-105 transition-transform">
              <Plane className="w-5 h-5 transform -rotate-45" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-navy">
              TripSync
            </span>
          </Link>

          {/* Desktop Center Nav Items */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/"
              className="text-sm font-bold text-primary relative py-1 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-primary after:rounded-full"
            >
              Home
            </Link>
            <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-navy transition">
              How It Works
            </a>
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-navy transition">
              Features
            </a>
            <a href="#travelers" className="text-sm font-medium text-slate-600 hover:text-navy transition">
              For Travelers
            </a>
            <a href="#about" className="text-sm font-medium text-slate-600 hover:text-navy transition">
              About
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <Link
                to="/app"
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md shadow-primary/20 transition flex items-center gap-2"
              >
                Go to App <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-semibold text-slate-700 hover:text-navy px-3 py-2 transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/login"
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md shadow-primary/20 transition flex items-center gap-2"
                >
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Nav Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-3">
            <Link to="/" className="block text-sm font-bold text-primary">
              Home
            </Link>
            <a href="#how-it-works" className="block text-sm font-medium text-slate-600">
              How It Works
            </a>
            <a href="#features" className="block text-sm font-medium text-slate-600">
              Features
            </a>
            <a href="#travelers" className="block text-sm font-medium text-slate-600">
              For Travelers
            </a>
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <Link
                to="/login"
                className="w-full text-center py-2 text-sm font-semibold text-slate-700 border border-slate-200 rounded-xl"
              >
                Sign In
              </Link>
              <Link
                to="/login"
                className="w-full text-center py-2.5 text-sm font-bold text-white bg-primary rounded-xl"
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero Section ── */}
      <section className="relative w-full min-h-[660px] lg:min-h-[720px] bg-slate-900 text-white overflow-hidden flex items-center">
        {/* Background Image Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-90 scale-105"
          style={{ backgroundImage: `url('/hero-travel.jpg')` }}
        />
        {/* Light Gradient Fades for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/30 via-transparent to-slate-900/80" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content Column (7 cols) */}
            <div className="lg:col-span-7 space-y-6 text-left">
              {/* Top Tagline Pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/20 backdrop-blur-md border border-primary/30 text-white text-xs font-bold uppercase tracking-wider">
                <Plane className="w-3.5 h-3.5 text-primary-light" />
                <span>Smarter Travel. Stronger Plans.</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12]">
                When Travel Changes, You're{' '}
                <span className="text-primary-light underline decoration-primary/40 underline-offset-8">
                  Still in Control.
                </span>
              </h1>

              {/* Description Paragraph */}
              <p className="text-base sm:text-lg text-slate-200 max-w-xl leading-relaxed font-normal">
                TripSync detects disruptions, finds the best recovery options, protects your entire itinerary, and keeps you informed — so you can travel with confidence.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/login"
                  className="px-7 py-3.5 rounded-2xl bg-primary hover:bg-primary-hover text-white text-base font-bold shadow-xl shadow-primary/30 transition transform hover:-translate-y-0.5 flex items-center gap-2.5"
                >
                  Get Started <ArrowRight className="w-5 h-5" />
                </Link>
                <button
                  onClick={() => navigate('/app/recovery-demo')}
                  className="px-6 py-3.5 rounded-2xl bg-white/90 hover:bg-white text-navy text-base font-bold shadow-lg transition flex items-center gap-2.5 backdrop-blur-md"
                >
                  <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center">
                    <Play className="w-3 h-3 fill-current ml-0.5" />
                  </div>
                  Watch Demo
                </button>
              </div>

              {/* Bullet Features Bar */}
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-x-6 gap-y-3 pt-6 text-xs sm:text-sm font-semibold text-slate-200 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-primary/30 text-primary-light flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Real-Time Alerts</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-primary/30 text-primary-light flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>AI-Powered Recovery</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-primary/30 text-primary-light flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>End-to-End Itinerary</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-primary/30 text-primary-light flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Offline Access</span>
                </div>
              </div>
            </div>

            {/* Right Phone Mockup Column (5 cols) */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="relative w-[320px] sm:w-[350px] bg-slate-900 rounded-[48px] p-3 shadow-2xl border-4 border-slate-700/50 backdrop-blur-md transform lg:rotate-1 hover:rotate-0 transition duration-500">
                {/* iPhone Frame Screen */}
                <div className="bg-white rounded-[38px] overflow-hidden text-navy shadow-inner space-y-3 pb-4">
                  {/* Phone Header / Status Bar */}
                  <div className="bg-slate-50 px-5 pt-3 pb-2 flex items-center justify-between text-xs text-slate-400 border-b border-slate-100">
                    <span className="font-bold text-navy text-[11px]">9:41</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 font-extrabold text-primary text-xs">
                        <Plane className="w-3.5 h-3.5 transform -rotate-45" /> TripSync
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center">
                      <User className="w-3 h-3 text-slate-600" />
                    </div>
                  </div>

                  {/* Red Flight Disruption Banner */}
                  <div className="mx-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-md space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                          <Plane className="w-4 h-4 text-white transform -rotate-45" />
                        </div>
                        <div>
                          <p className="text-xs font-bold leading-none">Flight Disrupted</p>
                          <p className="text-[10px] text-red-100 font-medium mt-0.5">Mumbai → Delhi</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/80" />
                    </div>
                    <p className="text-[10px] text-white/90 pt-1 border-t border-white/20">
                      Your flight has been delayed. 3 recovery options available.
                    </p>
                  </div>

                  {/* Trip Title */}
                  <div className="px-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-navy">Your Trip to Manali</h4>
                      <p className="text-[10px] text-slate-400 font-medium">12 – 18 Sep 2026</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                      In Progress
                    </span>
                  </div>

                  {/* Action Icons Grid */}
                  <div className="px-4 grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                      <Compass className="w-4 h-4 mx-auto" />
                      <span className="text-[9px] font-bold block mt-1">Plan</span>
                    </div>
                    <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                      <Plane className="w-4 h-4 mx-auto" />
                      <span className="text-[9px] font-bold block mt-1">Travel</span>
                    </div>
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                      <Hotel className="w-4 h-4 mx-auto" />
                      <span className="text-[9px] font-bold block mt-1">Stay</span>
                    </div>
                    <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                      <Camera className="w-4 h-4 mx-auto" />
                      <span className="text-[9px] font-bold block mt-1">Explore</span>
                    </div>
                  </div>

                  {/* Recommended Recovery Plan Card */}
                  <div className="px-4 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500">Recommended Recovery Plans</span>
                      <span className="text-primary font-bold">View All →</span>
                    </div>

                    <div className="p-3 rounded-2xl border border-primary/20 bg-primary/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-md bg-primary text-white text-[9px] font-bold">
                          Fastest Option
                        </span>
                        <span className="text-[9px] font-semibold text-primary">Recommended</span>
                      </div>
                      <div className="text-[10px] font-bold text-navy">
                        AI-204 · Air India
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-extrabold text-navy">
                        <span>10:30 BOM</span>
                        <span>✈️</span>
                        <span>12:45 DEL</span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] pt-1 border-t border-primary/10">
                        <span className="text-emerald-600 font-bold">+ ₹2,800</span>
                        <span className="text-slate-500">Arrive 2h earlier</span>
                        <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Highlight Bar ── */}
      <section className="bg-white border-b border-slate-200 shadow-sm relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-x-0 md:divide-x divide-slate-200">
            {/* Stat 1 */}
            <div className="space-y-1 p-2">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Users className="w-6 h-6" />
                <span className="text-2xl sm:text-3xl font-extrabold text-navy">10,000+</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-500">Travelers Supported</p>
            </div>

            {/* Stat 2 */}
            <div className="space-y-1 p-2">
              <div className="flex items-center justify-center gap-2 text-primary">
                <ShieldCheck className="w-6 h-6" />
                <span className="text-2xl sm:text-3xl font-extrabold text-navy">95%</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-500">Disruptions Recovered</p>
            </div>

            {/* Stat 3 */}
            <div className="space-y-1 p-2">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Clock className="w-6 h-6" />
                <span className="text-2xl sm:text-3xl font-extrabold text-navy">Real-Time</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-500">Alerts & Updates</p>
            </div>

            {/* Stat 4 */}
            <div className="space-y-1 p-2">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Globe className="w-6 h-6" />
                <span className="text-2xl sm:text-3xl font-extrabold text-navy">All Your Travel</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-500">In One Place</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Cards Section: "A Complete Travel Companion" ── */}
      <section id="features" className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Section Header */}
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-navy">
              A Complete Travel Companion
            </h2>
            <p className="text-sm sm:text-base text-slate-500 font-medium">
              From planning to safe return, TripSync is with you at every step.
            </p>
          </div>

          {/* 5 Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Card 1: Detect & Alert */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card hover:shadow-lg transition space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Plane className="w-6 h-6 transform -rotate-45" />
                </div>
                <h3 className="font-bold text-navy text-base">Detect & Alert</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  Get real-time updates for disruptions, weather and risks.
                </p>
              </div>
            </div>

            {/* Card 2: Find Recovery Options */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card hover:shadow-lg transition space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-navy text-base">Find Recovery Options</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  AI-powered strategies tailored to your trip and preferences.
                </p>
              </div>
            </div>

            {/* Card 3: Protect Your Itinerary */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card hover:shadow-lg transition space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-navy text-base">Protect Your Itinerary</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  Automatically reschedule downstream bookings and activities.
                </p>
              </div>
            </div>

            {/* Card 4: All Your Documents */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card hover:shadow-lg transition space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-navy text-base">All Your Documents</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  Tickets, hotel vouchers, IDs and more — always with you, even offline.
                </p>
              </div>
            </div>

            {/* Card 5: Travel with Confidence */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card hover:shadow-lg transition space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-navy text-base">Travel with Confidence</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  Deadlines, policies, weather alerts and 24/7 support keep you covered.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Call To Action Banner ── */}
      <section className="bg-gradient-to-r from-navy via-navy/95 to-primary text-white py-16">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold">Ready to Recover Your Journey?</h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
            Experience intelligent travel resilience. One trip, every booking, one intelligent recovery.
          </p>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-primary hover:bg-primary-hover text-white text-base font-bold shadow-xl transition transform hover:scale-105"
            >
              Open TripSync Dashboard <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
              <Plane className="w-4 h-4 transform -rotate-45" />
            </div>
            <span className="text-white font-extrabold text-base">TripSync</span>
            <span className="text-slate-500">| HackCelestial 3.0</span>
          </div>
          <p className="text-slate-500">© 2026 TripSync. Intelligent Travel Resilience Engine.</p>
        </div>
      </footer>
    </div>
  );
}