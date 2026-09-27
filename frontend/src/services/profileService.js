import { supabase } from './supabase.js';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

/**
 * Calculate completion status and score from raw profile, contacts, and documents data.
 * Pure logic function that matches backend scoring rules exactly.
 */
export function calculateProfileScore({ profile, user, emergencyContacts = [], documents = [] }) {
  const sections = {
    personal_details: {
      name: 'Personal Details',
      weight: 25,
      score: 0,
      status: 'missing',
      missing_count: 0,
      details: 'Full legal name, date of birth & residence',
      fields: [],
      missingFields: [],
    },
    contact_details: {
      name: 'Contact Details',
      weight: 15,
      score: 0,
      status: 'missing',
      missing_count: 0,
      details: 'Verified email address & mobile number',
      fields: [],
      missingFields: [],
    },
    emergency_contact: {
      name: 'Emergency Contact',
      weight: 15,
      score: 0,
      status: 'missing',
      missing_count: 0,
      details: 'At least one trusted emergency contact',
      fields: [],
      missingFields: [],
    },
    travel_identity: {
      name: 'Travel Identity',
      weight: 20,
      score: 0,
      status: 'missing',
      missing_count: 0,
      details: 'Government Photo ID, passport & nationality',
      fields: [],
      missingFields: [],
    },
    travel_documents: {
      name: 'Travel Documents',
      weight: 15,
      score: 0,
      status: 'missing',
      missing_count: 0,
      details: 'Flight tickets, train passes, or hotel bookings',
      fields: [],
      missingFields: [],
    },
    health_insurance: {
      name: 'Health Insurance',
      weight: 10,
      score: 0,
      status: 'missing',
      missing_count: 0,
      details: 'Active travel medical & health insurance policy',
      fields: [],
      missingFields: [],
    },
  };

  // 1. Personal Details (25%)
  // Needs: first_name (required), last_name, date_of_birth, home_city
  const hasFirstName = Boolean(profile?.first_name || user?.user_metadata?.first_name || profile?.full_name);
  const hasLastName = Boolean(profile?.last_name || user?.user_metadata?.last_name);
  const hasDob = Boolean(profile?.date_of_birth);
  const hasCity = Boolean(profile?.home_city);

  const personalItems = [hasFirstName, hasLastName, hasDob, hasCity];
  const personalFilled = personalItems.filter(Boolean).length;

  if (personalFilled === 4) {
    sections.personal_details.score = 25;
    sections.personal_details.status = 'complete';
  } else if (personalFilled > 0) {
    // Weighted partial score
    sections.personal_details.score = Math.round((personalFilled / 4) * 25);
    sections.personal_details.status = 'partially_complete';
    sections.personal_details.missing_count = 4 - personalFilled;
  } else {
    sections.personal_details.score = 0;
    sections.personal_details.status = 'missing';
    sections.personal_details.missing_count = 4;
  }
  if (!hasFirstName) sections.personal_details.missingFields.push('First Name');
  if (!hasLastName) sections.personal_details.missingFields.push('Last Name');
  if (!hasDob) sections.personal_details.missingFields.push('Date of Birth');
  if (!hasCity) sections.personal_details.missingFields.push('Home City');

  // 2. Contact Details (15%)
  // Needs: email (10%) and phone (5%)
  const email = profile?.email || user?.email;
  const phone = profile?.phone || user?.phone;
  const hasEmail = Boolean(email);
  const hasPhone = Boolean(phone);

  if (hasEmail && hasPhone) {
    sections.contact_details.score = 15;
    sections.contact_details.status = 'complete';
  } else if (hasEmail || hasPhone) {
    sections.contact_details.score = hasEmail ? 10 : 5;
    sections.contact_details.status = 'partially_complete';
    sections.contact_details.missing_count = 1;
    if (!hasPhone) sections.contact_details.missingFields.push('Mobile Phone');
    if (!hasEmail) sections.contact_details.missingFields.push('Email');
  } else {
    sections.contact_details.score = 0;
    sections.contact_details.status = 'missing';
    sections.contact_details.missing_count = 2;
    sections.contact_details.missingFields.push('Email', 'Mobile Phone');
  }

  // 3. Emergency Contact (15%)
  // Needs at least 1 emergency contact with name and phone
  const validContacts = emergencyContacts.filter(c => c.name || c.contact_name);
  if (validContacts.length >= 1) {
    const primary = validContacts[0];
    const hasContactPhone = Boolean(primary.phone);
    if (hasContactPhone) {
      sections.emergency_contact.score = 15;
      sections.emergency_contact.status = 'complete';
    } else {
      sections.emergency_contact.score = 8;
      sections.emergency_contact.status = 'partially_complete';
      sections.emergency_contact.missing_count = 1;
      sections.emergency_contact.missingFields.push('Contact Phone');
    }
  } else {
    sections.emergency_contact.score = 0;
    sections.emergency_contact.status = 'missing';
    sections.emergency_contact.missing_count = 1;
    sections.emergency_contact.missingFields.push('Emergency Contact Person');
  }

  // 4. Travel Identity (20%)
  // Needs: nationality (10%) and passport/ID doc (10%)
  const hasNationality = Boolean(profile?.nationality);
  const hasPassportDoc = documents.some(
    d => (d.document_type === 'passport' || d.kind === 'passport' || d.document_type === 'id')
  ) || Boolean(profile?.passport_last4);

  if (hasNationality && hasPassportDoc) {
    sections.travel_identity.score = 20;
    sections.travel_identity.status = 'complete';
  } else if (hasNationality || hasPassportDoc) {
    sections.travel_identity.score = 10;
    sections.travel_identity.status = 'partially_complete';
    sections.travel_identity.missing_count = 1;
    if (!hasNationality) sections.travel_identity.missingFields.push('Nationality');
    if (!hasPassportDoc) sections.travel_identity.missingFields.push('Passport Document');
  } else {
    sections.travel_identity.score = 0;
    sections.travel_identity.status = 'missing';
    sections.travel_identity.missing_count = 2;
    sections.travel_identity.missingFields.push('Nationality', 'Passport Document');
  }

  // 5. Travel Documents (15%)
  // Needs at least 1 travel booking document (flight, hotel, transport, ticket)
  const travelDocs = documents.filter(
    d => ['flight', 'hotel', 'train', 'bus', 'booking', 'ticket', 'transport'].includes(d.document_type || d.kind)
  );

  if (travelDocs.length > 0) {
    sections.travel_documents.score = 15;
    sections.travel_documents.status = 'complete';
  } else {
    sections.travel_documents.score = 0;
    sections.travel_documents.status = 'missing';
    sections.travel_documents.missing_count = 1;
    sections.travel_documents.missingFields.push('Travel Booking / Ticket');
  }

  // 6. Health Insurance (10%)
  // Needs at least 1 insurance document
  const insuranceDocs = documents.filter(
    d => (d.document_type === 'insurance' || d.kind === 'insurance' || (d.title && d.title.toLowerCase().includes('insurance')))
  );

  if (insuranceDocs.length > 0) {
    sections.health_insurance.score = 10;
    sections.health_insurance.status = 'complete';
  } else {
    sections.health_insurance.score = 0;
    sections.health_insurance.status = 'missing';
    sections.health_insurance.missing_count = 1;
    sections.health_insurance.missingFields.push('Insurance Policy');
  }

  // Calculate Total Percentage
  const totalScore = Math.min(
    100,
    sections.personal_details.score +
    sections.contact_details.score +
    sections.emergency_contact.score +
    sections.travel_identity.score +
    sections.travel_documents.score +
    sections.health_insurance.score
  );

  // Status computation according to prompt specifications:
  // 90–100% = Travel Ready
  // 70–89% = Almost Ready
  // below 70% = Action Required
  let status = 'action_required';
  if (totalScore >= 90) {
    status = 'travel_ready';
  } else if (totalScore >= 70) {
    status = 'almost_ready';
  }

  // Count items remaining (number of categories that are not complete)
  let itemsRemaining = 0;
  Object.values(sections).forEach(s => {
    if (s.status !== 'complete') itemsRemaining += 1;
  });

  return {
    percentage: totalScore,
    status,
    items_remaining: itemsRemaining,
    sections,
    documents,
    emergencyContacts,
  };
}

/**
 * Fetch dynamic profile completion data for authenticated user.
 * Tries FastAPI backend endpoint GET /api/v1/profile/completion first.
 * Falls back to direct Supabase queries for resilient client-side calculation.
 */
export async function fetchProfileCompletion(user) {
  if (!user || !user.id) {
    // Unauthenticated state
    return {
      percentage: 0,
      status: 'action_required',
      items_remaining: 6,
      sections: {},
      documents: [],
      emergencyContacts: [],
    };
  }

  // 1. Attempt to fetch from backend API
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch(`${BACKEND_URL}/api/v1/profile/completion?user_id=${user.id}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.percentage === 'number') {
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend completion endpoint unreachable, using direct Supabase calculation:', err.message);
  }

  // 2. Direct Supabase Query fallback
  try {
    const [profileRes, contactsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('emergency_contacts').select('*').eq('user_id', user.id),
    ]);

    const profile = profileRes.data || null;
    const emergencyContacts = contactsRes.data || [];

    let documents = [];
    try {
      const docsRes = await supabase.from('documents').select('id, document_type, file_name, is_available_offline, created_at').limit(20);
      documents = docsRes?.data || [];
    } catch (_) {}

    return calculateProfileScore({ profile, user, emergencyContacts, documents });
  } catch (err) {
    console.error('Error calculating profile completion from Supabase:', err);
    return calculateProfileScore({ profile: null, user, emergencyContacts: [], documents: [] });
  }
}
