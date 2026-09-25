-- TripSync Supabase PostgreSQL Schema & Seed Data

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    home_city TEXT DEFAULT 'Mumbai',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Trips Table
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    route TEXT[] NOT NULL DEFAULT '{}',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    dates_label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'normal', -- normal, disrupted, recovery-options, plan-selected, recovered
    travelers_count INT NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Trip Members Table
CREATE TABLE IF NOT EXISTS public.trip_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    member_code TEXT NOT NULL, -- e.g. tanvi, aisha, rahul, riya, karan
    role TEXT DEFAULT 'traveler',
    affected BOOLEAN DEFAULT FALSE,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    booking_key TEXT NOT NULL, -- outboundFlight, transfer, hotel, activity, returnFlight
    type TEXT NOT NULL, -- flight, transfer, hotel, activity
    label TEXT NOT NULL,
    subtitle TEXT,
    origin TEXT,
    destination TEXT,
    location TEXT,
    carrier_or_provider TEXT,
    pnr TEXT,
    booking_date DATE,
    booking_time TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'confirmed',
    refund_potential NUMERIC(10, 2) DEFAULT 0.00,
    links JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Itinerary Items Table
CREATE TABLE IF NOT EXISTS public.itinerary_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    location TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'scheduled',
    booking_ref TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Budgets Table
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE UNIQUE,
    total_budget NUMERIC(10, 2) NOT NULL DEFAULT 40000.00,
    total_spent NUMERIC(10, 2) NOT NULL DEFAULT 31200.00,
    at_risk NUMERIC(10, 2) NOT NULL DEFAULT 6500.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category TEXT NOT NULL, -- flight, transfer, hotel, activity, food, miscellaneous
    amount NUMERIC(10, 2) NOT NULL,
    paid_by TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Documents Table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    doc_key TEXT NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL, -- flight, hotel, insurance, passport
    meta TEXT,
    file_url TEXT,
    is_offline BOOLEAN DEFAULT TRUE,
    relevant_on_disruption BOOLEAN DEFAULT FALSE,
    expiry_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Emergency Contacts Table
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    contact_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access for hackathon API queries (or configure authenticated user policies)
CREATE POLICY "Allow public read access on trips" ON public.trips FOR SELECT USING (true);
CREATE POLICY "Allow public read access on trip_members" ON public.trip_members FOR SELECT USING (true);
CREATE POLICY "Allow public read access on bookings" ON public.bookings FOR SELECT USING (true);
CREATE POLICY "Allow public read access on itinerary_items" ON public.itinerary_items FOR SELECT USING (true);
CREATE POLICY "Allow public read access on budgets" ON public.budgets FOR SELECT USING (true);
CREATE POLICY "Allow public read access on expenses" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "Allow public read access on documents" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Allow public read access on emergency_contacts" ON public.emergency_contacts FOR SELECT USING (true);

------------------------------------------------------------------
-- SEED DATA (TripSync Hackathon Demo Trip: Mumbai -> Delhi -> Manali)
------------------------------------------------------------------

-- Fixed UUID for current demo trip
INSERT INTO public.trips (id, title, origin, destination, route, start_date, end_date, dates_label, status, travelers_count)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Mumbai → Delhi → Manali',
    'Mumbai',
    'Manali',
    ARRAY['Mumbai', 'Delhi', 'Manali'],
    '2026-09-12',
    '2026-09-18',
    '12 – 18 Sep 2026',
    'normal',
    5
) ON CONFLICT (id) DO NOTHING;

-- Seed Trip Members
INSERT INTO public.trip_members (trip_id, name, member_code, role, affected, note) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Tanvi', 'tanvi', 'Lead Traveler', true, 'On the cancelled flight — needs a recovery plan'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Aisha', 'aisha', 'Traveler', false, null),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Rahul', 'rahul', 'Traveler', false, null),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Riya', 'riya', 'Traveler', false, null),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Karan', 'karan', 'Traveler', false, null)
ON CONFLICT DO NOTHING;

-- Seed Bookings
INSERT INTO public.bookings (trip_id, booking_key, type, label, subtitle, origin, destination, location, carrier_or_provider, pnr, booking_date, booking_time, price, status, refund_potential, links) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'outboundFlight', 'flight', 'Air India AI-123', 'Mumbai → Delhi', 'Mumbai', 'Delhi', 'Delhi Airport T3', 'Air India', 'AI9X4K2', '2026-09-12', '8:30 AM', 4200.00, 'confirmed', 0.00, '[{"label": "Air India · manage PNR", "url": "https://www.airindia.in/"}]'::jsonb),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'transfer', 'transfer', 'Delhi Airport → Hotel', 'Airport transfer', 'Delhi Airport (T3)', 'Interstate Bus Terminus → Manali road', 'Delhi', 'Uber Intercity', null, '2026-09-12', '10:30 AM', 1200.00, 'confirmed', 0.00, '[{"label": "Book cab on Uber", "url": "https://www.uber.com/"}]'::jsonb),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'hotel', 'hotel', 'Mountain View Residency', 'Manali · Old Manali Road', null, null, 'Manali', 'Mountain View Residency', null, '2026-09-12', '2:00 PM', 18000.00, 'confirmed', 6500.00, '[{"label": "View on MakeMyTrip", "url": "https://www.makemytrip.com/"}]'::jsonb),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'activity', 'activity', 'Solang Valley Adventure', 'Paragliding + zipline', null, null, 'Solang Valley, Manali', 'Thrillophilia', null, '2026-09-14', '9:00 AM', 2500.00, 'confirmed', 0.00, '[{"label": "Book on Thrillophilia", "url": "https://www.thrillophilia.com/"}]'::jsonb),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'returnFlight', 'flight', 'Air India AI-224', 'Delhi → Mumbai', 'Delhi', 'Mumbai', 'Delhi Airport T3', 'Air India', 'AI7H3Q1', '2026-09-18', '4:00 PM', 4800.00, 'confirmed', 0.00, '[{"label": "Air India · manage PNR", "url": "https://www.airindia.in/"}]'::jsonb)
ON CONFLICT DO NOTHING;

-- Seed Itinerary Items
INSERT INTO public.itinerary_items (trip_id, title, type, location, start_time, end_time, status, booking_ref, sort_order) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Outbound Flight AI-123', 'flight', 'Mumbai (BOM) → Delhi (DEL)', '2026-09-12T08:30:00+05:30', '2026-09-12T10:30:00+05:30', 'scheduled', 'AI9X4K2', 1),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Airport Transfer to Bus Terminal', 'transfer', 'Delhi Airport (T3) → Kashmiri Gate ISBT', '2026-09-12T10:45:00+05:30', '2026-09-12T11:45:00+05:30', 'scheduled', 'UBER-9821', 2),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Overnight Volvo Bus to Manali', 'bus', 'Delhi ISBT → Manali Bus Stand', '2026-09-12T19:00:00+05:30', '2026-09-13T08:00:00+05:30', 'scheduled', 'HRTC-7819', 3),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Check-in Mountain View Residency', 'hotel', 'Old Manali Road, Manali', '2026-09-13T12:00:00+05:30', '2026-09-17T11:00:00+05:30', 'scheduled', 'MVR-2026', 4),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Solang Valley Adventure Sports', 'activity', 'Solang Valley, Manali', '2026-09-14T09:00:00+05:30', '2026-09-14T14:00:00+05:30', 'scheduled', 'THRILL-4410', 5)
ON CONFLICT DO NOTHING;

-- Seed Budget Summary
INSERT INTO public.budgets (trip_id, total_budget, total_spent, at_risk) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 40000.00, 31200.00, 6500.00)
ON CONFLICT (trip_id) DO NOTHING;

-- Seed Expenses
INSERT INTO public.expenses (trip_id, description, category, amount, paid_by, date) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Outbound Flight (Air India AI-123)', 'flight', 4200.00, 'Tanvi', '2026-09-01'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Mountain View Residency (Advance)', 'hotel', 18000.00, 'Tanvi', '2026-09-02'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Delhi Airport Transfer', 'transfer', 1200.00, 'Aisha', '2026-09-05'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Solang Adventure Booking', 'activity', 2500.00, 'Rahul', '2026-09-06'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Return Flight (Air India AI-224)', 'flight', 4800.00, 'Tanvi', '2026-09-08')
ON CONFLICT DO NOTHING;

-- Seed Documents
INSERT INTO public.documents (trip_id, doc_key, title, kind, meta, is_offline, relevant_on_disruption) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'doc-flight', 'Air India E-Ticket (AI-123)', 'flight', 'BOM → DEL · PNR AI9X4K2', true, true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'doc-hotel', 'Hotel Voucher — Mountain View', 'hotel', 'Check-in 12 Sep · Old Manali', true, true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'doc-insurance', 'Travel Insurance Policy', 'insurance', 'Policy #TS-99218-IN · Reliance General', true, true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'doc-passport', 'Government Photo ID / Passport', 'passport', 'Tanvi · Verified on device', true, true)
ON CONFLICT DO NOTHING;

-- Seed Emergency Contacts
INSERT INTO public.emergency_contacts (trip_id, contact_name, phone, category) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Air India Helpline', '+91 124 2641407', 'Airline'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Delhi Airport T3 Emergency Desk', '+91 11 61234567', 'Airport'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Manali Tourist Helpline', '+91 1902 252116', 'Helpline')
ON CONFLICT DO NOTHING;
