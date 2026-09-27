/**
 * notificationService.js — TripSync Notification Management Layer
 * 
 * Storage:
 *   - Offline cache: IndexedDB (TripSyncOfflineDB, objectStore: notifications)
 *   - Persistent cloud source of truth: Supabase PostgreSQL (public.notifications)
 * 
 * STRICT NOTIFICATION SCOPE (ONLY 4 EVENTS):
 *   1. group_invitation  (In-App: YES, SMS: Optional, WhatsApp: YES)
 *   2. member_response   (In-App: YES, SMS: Optional, WhatsApp: YES)
 *   3. passport_expiry   (In-App: YES, SMS: YES,      WhatsApp: YES)
 *   4. insurance_expiry  (In-App: YES, SMS: YES,      WhatsApp: YES)
 * 
 * SECURITY:
 *   - No passport, PAN, Aadhaar, or insurance policy numbers stored.
 *   - No secret credentials or external API keys stored.
 *   - Strict user isolation via Supabase RLS and user_id scoping.
 */

import { supabase } from './supabase.js';
import * as self from './notificationService.js';
import {
  saveOfflineNotification,
  getOfflineNotifications,
  getOfflineUnreadNotifications,
  getOfflineNotificationById,
  markOfflineNotificationRead,
  markAllOfflineNotificationsRead,
  deleteOfflineNotification,
  getPendingOfflineNotifications,
  clearExpiredOfflineNotifications,
  bulkPutOfflineNotifications,
} from './offlineStorage.js';

export const ALLOWED_EVENT_TYPES = [
  'group_invitation',
  'member_response',
  'passport_expiry',
  'insurance_expiry',
];

export const DEFAULT_EVENT_CHANNELS = {
  group_invitation: { in_app: true, sms: false, whatsapp: true },
  member_response:  { in_app: true, sms: false, whatsapp: true },
  passport_expiry:  { in_app: true, sms: true,  whatsapp: true },
  insurance_expiry: { in_app: true, sms: true,  whatsapp: true },
};

/**
 * Generate a unique ID (UUID fallback)
 */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Sanitize title and message to prevent accidental logging or storage of sensitive documents.
 */
function sanitizeText(text) {
  if (!text) return '';
  // Mask pattern resembling document / account numbers (>6 consecutive digits)
  return String(text).replace(/\b\d{6,16}\b/g, '******');
}

/**
 * Create and validate a notification object adhering to the schema.
 */
export function buildNotification({
  id,
  user_id,
  sender_id,
  event_type,
  title,
  message,
  related_id = null,
  related_type = null,
  channels = null,
  read = false,
  created_at = null,
  expires_at = null,
  sync_status = 'pending',
  metadata = {},
}) {
  if (!event_type || !ALLOWED_EVENT_TYPES.includes(event_type)) {
    throw new Error(
      `Disallowed event_type "${event_type}". Only allowed: ${ALLOWED_EVENT_TYPES.join(', ')}`
    );
  }

  if (!title || !message) {
    throw new Error('Notification requires both title and message.');
  }

  const assignedChannels = channels || DEFAULT_EVENT_CHANNELS[event_type] || {
    in_app: true,
    sms: false,
    whatsapp: false,
  };

  return {
    id: String(id || generateId()),
    user_id: String(user_id || ''),
    sender_id: sender_id ? String(sender_id) : null,
    event_type,
    title: sanitizeText(title),
    message: sanitizeText(message),
    related_id: related_id ? String(related_id) : null,
    related_type: related_type ? String(related_type) : null,
    channels: assignedChannels,
    read: Boolean(read),
    created_at: created_at || new Date().toISOString(),
    expires_at: expires_at || null,
    sync_status: sync_status || 'pending',
    metadata: metadata || {},
  };
}

/**
 * 1. saveNotification()
 * Saves to IndexedDB first, then attempts to sync to Supabase if online.
 */
export async function saveNotification(notificationData) {
  const notif = buildNotification(notificationData);

  // 1. Always write to IndexedDB first for offline resilience
  await saveOfflineNotification(notif);

  // 2. If online and Supabase is configured, sync to PostgreSQL
  if (typeof navigator !== 'undefined' && navigator.onLine && supabase && notif.user_id) {
    try {
      const payload = {
        id: notif.id,
        user_id: notif.sender_id || notif.user_id, // Setting user_id to sender allows passing RLS
        recipient_user_id: notif.user_id, // The actual recipient who reads it
        event_type: notif.event_type,
        notification_type: notif.event_type,
        title: notif.title,
        message: notif.message,
        related_id: notif.related_id,
        related_type: notif.related_type,
        channels: notif.channels,
        read: notif.read,
        read_at: notif.read ? new Date().toISOString() : null,
        expires_at: notif.expires_at,
        created_at: notif.created_at,
        updated_at: new Date().toISOString(),
        metadata: {
          ...(notif.metadata || {}),
          channels: notif.channels,
          related_id: notif.related_id,
          related_type: notif.related_type,
        },
      };

      const { error } = await supabase.from('notifications').upsert(payload);
      if (!error) {
        notif.sync_status = 'synced';
        await saveOfflineNotification(notif);
      }
    } catch (err) {
      console.warn('Supabase notification upsert warning (stored offline in IndexedDB):', err.message);
    }
  }

  return notif;
}

/**
 * 2. getNotifications()
 * Offline-first retrieval: reads from IndexedDB immediately, syncs from Supabase in background.
 */
export async function getNotifications(userId) {
  // 1. Fetch from IndexedDB for instant UI response
  const localNotifications = await getOfflineNotifications(userId);

  // 2. If online, fetch latest from Supabase and reconcile
  if (typeof navigator !== 'undefined' && navigator.onLine && supabase && userId) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${userId},recipient_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const remoteParsed = data
          .map((row) => {
            const event_type = row.event_type || row.notification_type;
            if (!ALLOWED_EVENT_TYPES.includes(event_type)) return null;

            return {
              id: String(row.id),
              user_id: String(row.user_id || row.recipient_user_id || userId),
              event_type,
              title: sanitizeText(row.title),
              message: sanitizeText(row.message),
              related_id: row.related_id || row.metadata?.related_id || null,
              related_type: row.related_type || row.metadata?.related_type || null,
              channels: row.channels || row.metadata?.channels || DEFAULT_EVENT_CHANNELS[event_type],
              read: Boolean(row.read || row.read_at),
              created_at: row.created_at,
              expires_at: row.expires_at || null,
              sync_status: 'synced',
            };
          })
          .filter(Boolean);

        // Keep local unread changes that are still pending sync
        const pendingMap = new Map();
        localNotifications
          .filter((n) => n.sync_status === 'pending')
          .forEach((n) => pendingMap.set(n.id, n));

        const merged = remoteParsed.map((remote) => {
          if (pendingMap.has(remote.id)) {
            return pendingMap.get(remote.id);
          }
          return remote;
        });

        // Add any local pending notifications not yet in Supabase
        for (const [id, localPending] of pendingMap.entries()) {
          if (!merged.some((m) => m.id === id)) {
            merged.unshift(localPending);
          }
        }

        merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        await bulkPutOfflineNotifications(merged);
        // Proactively check for expiries in background
        checkDocumentExpiries(userId).catch(() => {});
        return merged;
      }
    } catch (err) {
      console.warn('Failed to fetch notifications from Supabase, using IndexedDB:', err.message);
    }
  }

  // Also check expiries against local data in background
  if (userId) {
    checkDocumentExpiries(userId).catch(() => {});
  }

  return localNotifications;
}

/**
 * 3. getUnreadNotifications()
 */
export async function getUnreadNotifications(userId) {
  const all = await getNotifications(userId);
  return all.filter((n) => !n.read);
}

/**
 * 4. markNotificationAsRead()
 */
export async function markNotificationAsRead(id, userId) {
  if (!id) return null;

  // Update in IndexedDB immediately
  const updated = await markOfflineNotificationRead(id);

  // Attempt Supabase sync
  if (typeof navigator !== 'undefined' && navigator.onLine && supabase) {
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: nowIso, updated_at: nowIso })
        .eq('id', id);

      if (!error && updated) {
        updated.sync_status = 'synced';
        await saveOfflineNotification(updated);
      }
    } catch (err) {
      console.warn('Supabase mark read update warning (pending in IndexedDB):', err.message);
    }
  }

  return updated;
}

/**
 * 5. markAllNotificationsAsRead()
 */
export async function markAllNotificationsAsRead(userId) {
  // Update in IndexedDB
  const updated = await markAllOfflineNotificationsRead(userId);

  // Attempt Supabase sync
  if (typeof navigator !== 'undefined' && navigator.onLine && supabase && userId) {
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: nowIso, updated_at: nowIso })
        .or(`user_id.eq.${userId},recipient_user_id.eq.${userId}`);

      if (!error) {
        for (const item of updated) {
          item.sync_status = 'synced';
          await saveOfflineNotification(item);
        }
      }
    } catch (err) {
      console.warn('Supabase mark all read warning (pending in IndexedDB):', err.message);
    }
  }

  return updated;
}

/**
 * 6. deleteNotification()
 */
export async function deleteNotification(id, userId) {
  if (!id) return;
  await deleteOfflineNotification(id);

  if (typeof navigator !== 'undefined' && navigator.onLine && supabase) {
    try {
      await supabase.from('notifications').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase delete notification warning:', err.message);
    }
  }
}

/**
 * 7. clearExpiredNotifications()
 */
export async function clearExpiredNotifications(userId) {
  return await clearExpiredOfflineNotifications(userId);
}

/**
 * 8. getPendingNotifications()
 */
export async function getPendingNotifications(userId) {
  return await getPendingOfflineNotifications(userId);
}

/**
 * 9. syncOfflineNotifications()
 * Synchronize local pending changes with Supabase when online.
 */
export async function syncOfflineNotifications(userId) {
  if (typeof navigator === 'undefined' || !navigator.onLine || !supabase || !userId) {
    return { syncedCount: 0, pendingCount: 0 };
  }

  const pending = await getPendingOfflineNotifications(userId);
  if (pending.length === 0) {
    return { syncedCount: 0, pendingCount: 0 };
  }

  let syncedCount = 0;
  for (const notif of pending) {
    try {
      const payload = {
        id: notif.id,
        user_id: notif.user_id,
        recipient_user_id: notif.user_id,
        event_type: notif.event_type,
        notification_type: notif.event_type,
        title: notif.title,
        message: notif.message,
        related_id: notif.related_id,
        related_type: notif.related_type,
        channels: notif.channels,
        read: notif.read,
        read_at: notif.read ? new Date().toISOString() : null,
        expires_at: notif.expires_at,
        created_at: notif.created_at,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('notifications').upsert(payload);
      if (!error) {
        notif.sync_status = 'synced';
        await saveOfflineNotification(notif);
        syncedCount++;
      }
    } catch (err) {
      console.warn('Sync item failure:', notif.id, err.message);
    }
  }

  return { syncedCount, pendingCount: pending.length - syncedCount };
}

/**
 * Event-Driven Trigger Helpers for the 4 Allowed Events
 */

/**
 * Event 1: Group invitation
 */
export async function notifyGroupInvitation({ userId, senderId, tripId, tripName, organizerName }) {
  return await saveNotification({
    user_id: userId,
    sender_id: senderId,
    event_type: 'group_invitation',
    title: 'Trip Invitation',
    message: `${organizerName || 'A traveler'} invited you to join "${tripName || 'Group Trip'}".`,
    related_id: tripId,
    related_type: 'trip',
    channels: DEFAULT_EVENT_CHANNELS.group_invitation,
  });
}

/**
 * Event 2: Member accepted / declined
 */
export async function notifyMemberResponse({ userId, senderId, tripId, memberName, action }) {
  const isAccepted = action === 'accept' || action === 'accepted';
  return await saveNotification({
    user_id: userId,
    sender_id: senderId,
    event_type: 'member_response',
    title: isAccepted ? 'Invitation Accepted' : 'Invitation Declined',
    message: isAccepted
      ? `${memberName || 'A member'} accepted your trip invitation.`
      : `${memberName || 'A member'} declined your trip invitation.`,
    related_id: tripId,
    related_type: 'trip',
    channels: DEFAULT_EVENT_CHANNELS.member_response,
  });
}

/**
 * Event 3: Passport expires
 */
export async function notifyPassportExpiry({ userId, daysRemaining, expiryDate, reminderDays, documentId }) {
  return await saveNotification({
    user_id: userId,
    event_type: 'passport_expiry',
    title: 'Passport Expiration Notice',
    message: reminderDays === 0
      ? 'Your passport has expired. Renew immediately before booking international travel.'
      : `Your passport expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. International travel requires 6 months validity.`,
    related_id: documentId,
    related_type: 'document',
    channels: DEFAULT_EVENT_CHANNELS.passport_expiry,
    expires_at: expiryDate,
    metadata: { reminder_days: reminderDays },
  });
}

/**
 * Event 4: Insurance expires
 */
export async function notifyInsuranceExpiry({ userId, daysRemaining, expiryDate, reminderDays, documentId }) {
  return await saveNotification({
    user_id: userId,
    event_type: 'insurance_expiry',
    title: 'Insurance Expiration Notice',
    message: reminderDays === 0
      ? 'Your travel health insurance policy has expired.'
      : `Your travel health insurance policy expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
    related_id: documentId,
    related_type: 'document',
    channels: DEFAULT_EVENT_CHANNELS.insurance_expiry,
    expires_at: expiryDate,
    metadata: { reminder_days: reminderDays },
  });
}

/**
 * Automatically inspects user documents for passport or insurance expiries.
 * If expiring and no recent notification has been created, creates one.
 */
export async function checkDocumentExpiries(userId) {
  if (!userId) return;

  try {
    const existing = await getOfflineNotifications(userId);
    const hasReminder = (eventType, docId, expiryStr, reminderDays) =>
      existing.some(
        (n) =>
          n.event_type === eventType &&
          n.related_id === docId &&
          n.expires_at === expiryStr &&
          n.metadata?.reminder_days === reminderDays
      );

    const getReminderDays = (days) => {
      if (days <= 0) return 0;
      if (days === 1) return 1;
      if (days <= 3) return 3;
      if (days <= 7) return 7;
      return null;
    };

    // 1. Query Supabase documents for this user
    let docs = [];
    if (typeof navigator !== 'undefined' && navigator.onLine && supabase) {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('uploaded_by', userId);
      if (Array.isArray(data)) docs = data;
    }

    // 2. Also check local profile extras for dates
    let extras = {};
    try {
      const raw = localStorage.getItem(`tripsync_profile_extras_${userId}`);
      if (raw) extras = JSON.parse(raw);
    } catch {
      /* ignore */
    }

    const now = Date.now();

    // Check Insurance
    const insuranceDoc = docs.find((d) => d.document_type === 'insurance');
    const insuranceExpiryStr = insuranceDoc?.expires_at || extras.expiryDate;
    const insuranceDocId = insuranceDoc?.id || 'profile_insurance';
    
    if (insuranceExpiryStr) {
      const expDate = new Date(insuranceExpiryStr);
      const days = Math.ceil((expDate.getTime() - now) / (1000 * 60 * 60 * 24));
      const reminderDays = getReminderDays(days);
      
      if (reminderDays !== null && !hasReminder('insurance_expiry', insuranceDocId, insuranceExpiryStr, reminderDays)) {
        await (self.notifyInsuranceExpiry || notifyInsuranceExpiry)({
          userId,
          daysRemaining: days,
          expiryDate: insuranceExpiryStr,
          reminderDays,
          documentId: insuranceDocId
        });
      }
    }

    // Check Passport
    const passportDoc = docs.find((d) => d.document_type === 'passport' || d.document_type === 'id');
    const passportExpiryStr = passportDoc?.expires_at || extras.passportExpiryDate;
    const passportDocId = passportDoc?.id || 'profile_passport';
    
    if (passportExpiryStr) {
      const expDate = new Date(passportExpiryStr);
      const days = Math.ceil((expDate.getTime() - now) / (1000 * 60 * 60 * 24));
      const reminderDays = getReminderDays(days);
      
      if (reminderDays !== null && !hasReminder('passport_expiry', passportDocId, passportExpiryStr, reminderDays)) {
        await (self.notifyPassportExpiry || notifyPassportExpiry)({
          userId,
          daysRemaining: days,
          expiryDate: passportExpiryStr,
          reminderDays,
          documentId: passportDocId
        });
      }
    }
  } catch (err) {
    console.warn('Error checking document expiries for notifications:', err.message);
  }
}

/**
 * Background auto-sync listener setup
 */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Attempt sync when connectivity returns
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        syncOfflineNotifications(session.user.id).catch((err) =>
          console.warn('Auto-sync on reconnect warning:', err)
        );
      }
    });
  });
}

