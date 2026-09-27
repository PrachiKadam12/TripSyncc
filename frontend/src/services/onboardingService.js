import { supabase } from './supabase.js';
import { calculateProfileScore } from './profileService.js';

/**
 * Check if the user is a first-time user or if onboarding is pending.
 * Returns: 'not_started' | 'in_progress' | 'completed'
 */
export async function getProfileSetupStatus(user) {
  if (!user || !user.id) return 'not_started';

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('profile_setup_status, date_of_birth, phone, nationality')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data) {
      return 'not_started';
    }

    if (data.profile_setup_status) {
      return data.profile_setup_status;
    }

    // Fallback: If basic details exist in DB, treat as completed
    if (data.phone && (data.date_of_birth || data.nationality)) {
      return 'completed';
    }

    return 'not_started';
  } catch (err) {
    console.warn('Error reading profile setup status:', err);
    return 'not_started';
  }
}

/**
 * Update the profile_setup_status in Supabase profiles table.
 */
export async function updateProfileSetupStatus(userId, status) {
  if (!userId) return false;
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        profile_setup_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.warn('Could not update profile_setup_status directly:', error.message);
    }
    return true;
  } catch (err) {
    console.error('Error updating profile setup status:', err);
    return false;
  }
}

/**
 * Save Personal & Contact Details to Supabase profiles table.
 */
export async function saveProfileDetails(userId, profileData) {
  if (!userId) throw new Error('User ID is required');

  const payload = {
    id: userId,
    first_name: profileData.firstName || '',
    last_name: profileData.lastName || '',
    display_name: profileData.fullName || profileData.firstName || 'Traveler',
    date_of_birth: profileData.dateOfBirth || null,
    nationality: profileData.nationality || null,
    home_city: profileData.city || null,
    home_country: profileData.country || null,
    phone: profileData.phone || null,
    email: profileData.email || null,
    preferred_language: profileData.language || null,
    updated_at: new Date().toISOString(),
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === null || payload[key] === '') delete payload[key];
  });
  payload.id = userId;
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Save Emergency Contact to Supabase emergency_contacts table.
 */
export async function saveEmergencyContact(userId, contact) {
  if (!userId) throw new Error('User ID is required');

  const { data: existing } = await supabase
    .from('emergency_contacts')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  const payload = {
    user_id: userId,
    name: contact.name,
    relationship: contact.relationship || 'Family',
    phone: contact.phone,
    email: contact.email || null,
    is_primary: true,
  };

  if (existing && existing.length > 0) {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .update(payload)
      .eq('id', existing[0].id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

/**
 * Upload Document to Supabase Storage and register in documents table.
 */
export async function uploadTravelDocument(userId, file, docType, metadata = {}) {
  if (!userId) throw new Error('User ID is required');
  if (!file) throw new Error('File is required');

  const fileExt = file.name.split('.').pop();
  const fileName = `${docType}_${Date.now()}.${fileExt}`;
  const filePath = `user_${userId}/${fileName}`;

  const { error: storageError } = await supabase.storage
    .from('trip-documents')
    .upload(filePath, file, { upsert: true });

  if (storageError) {
    console.warn('Storage upload note:', storageError.message);
  }

  const docPayload = {
    uploaded_by: userId,
    document_type: docType,
    file_name: file.name,
    mime_type: file.type,
    file_size_bytes: file.size,
    storage_bucket: 'trip-documents',
    storage_path: filePath,
    is_sensitive: true,
    is_available_offline: true,
    expires_at: metadata.expiryDate || null,
  };

  const { data: docRecord, error: docError } = await supabase
    .from('documents')
    .insert(docPayload)
    .select()
    .single();

  if (docError) {
    console.warn('Documents table insert fallback:', docError.message);
  }

  return { filePath, record: docRecord };
}

const extrasKey = (userId) => `tripsync_profile_extras_${userId}`;

export function saveProfileExtras(userId, extras) {
  if (!userId) return;
  try {
    localStorage.setItem(extrasKey(userId), JSON.stringify(extras || {}));
  } catch {
    /* ignore quota errors */
  }
}

export function loadProfileExtras(userId) {
  if (!userId) return {};
  try {
    return JSON.parse(localStorage.getItem(extrasKey(userId)) || '{}');
  } catch {
    return {};
  }
}

function docTypeKey(doc) {
  return String(doc.document_type || doc.kind || '').toLowerCase().replace(/[\s_-]/g, '');
}

/**
 * Load the same details collected during first-time profile setup.
 */
export async function loadOnboardingData(userId) {
  if (!userId) return { profile: null, emergency: null, documents: [], extras: {} };

  const [profileRes, contactsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('emergency_contacts').select('*').eq('user_id', userId).order('is_primary', { ascending: false }),
  ]);

  let documents = [];
  try {
    const docsRes = await supabase.from('documents').select('id, trip_id, document_type, file_name, is_available_offline, created_at').order('created_at', { ascending: false }).limit(20);
    documents = docsRes.data || [];
  } catch (_) {}

  return {
    profile: profileRes.data || null,
    emergency: (contactsRes.data && contactsRes.data[0]) || null,
    documents,
    extras: loadProfileExtras(userId),
  };
}

export function findDocument(documents, keys) {
  const wanted = keys.map((k) => k.toLowerCase().replace(/[\s_-]/g, ''));
  return (documents || []).find((d) => wanted.includes(docTypeKey(d))) || null;
}