/**
 * IndexedDB Service for TripSync Offline Document Storage & Notification Cache
 * 
 * Database: TripSyncOfflineDB
 * Version: 2 (safely upgraded from version 1)
 * ObjectStores:
 *   - offline_documents (keyPath: document_id)
 *   - notifications (keyPath: id, indexed by user_id, event_type, read, sync_status, created_at)
 */

const DB_NAME = 'TripSyncOfflineDB';
const DB_VERSION = 2;
const STORE_NAME = 'offline_documents';
const NOTIFICATION_STORE = 'notifications';

/**
 * Open or upgrade the IndexedDB database.
 */
export function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // 1. Maintain existing offline_documents object store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'document_id' });
      }

      // 2. Safe addition of notifications object store
      if (!db.objectStoreNames.contains(NOTIFICATION_STORE)) {
        const notifStore = db.createObjectStore(NOTIFICATION_STORE, { keyPath: 'id' });
        notifStore.createIndex('user_id', 'user_id', { unique: false });
        notifStore.createIndex('event_type', 'event_type', { unique: false });
        notifStore.createIndex('read', 'read', { unique: false });
        notifStore.createIndex('sync_status', 'sync_status', { unique: false });
        notifStore.createIndex('created_at', 'created_at', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* =========================================================================
   DOCUMENT STORAGE (ORIGINAL & UNCHANGED)
   ========================================================================= */

/**
 * Save or update a document file blob and metadata in IndexedDB.
 */
export async function saveDocumentOffline(documentId, fileName, mimeType, blob, extraMetadata = {}) {
  if (!documentId || !blob) {
    throw new Error('Document ID and file blob are required for offline storage.');
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const docRecord = {
      document_id: String(documentId),
      file_name: fileName || 'document',
      mime_type: mimeType || blob.type || 'application/octet-stream',
      blob: blob,
      saved_at: new Date().toISOString(),
      ...extraMetadata,
    };

    const request = store.put(docRecord);

    request.onsuccess = () => resolve(docRecord);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve a single document record by ID.
 */
export async function getOfflineDocument(documentId) {
  if (!documentId) return null;

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(String(documentId));

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to read offline document from IndexedDB:', err);
    return null;
  }
}

/**
 * Retrieve all offline document records.
 */
export async function getAllOfflineDocuments() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to read offline documents from IndexedDB:', err);
    return [];
  }
}

/**
 * Delete a document from offline storage by ID.
 */
export async function deleteOfflineDocument(documentId) {
  if (!documentId) return;

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(String(documentId));

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to delete document from IndexedDB:', err);
  }
}

/* =========================================================================
   NOTIFICATION STORAGE (PHASE 2 - INDEXEDDB NOTIFICATION LAYER)
   ========================================================================= */

/**
 * Save or update a notification in IndexedDB.
 * Ensures no sensitive document credentials/numbers are stored.
 */
export async function saveOfflineNotification(notification) {
  if (!notification || !notification.id) {
    throw new Error('Valid notification object with ID is required.');
  }

  // Sanitize record to prevent sensitive info storage
  const record = {
    id: String(notification.id),
    user_id: String(notification.user_id || ''),
    event_type: String(notification.event_type || ''),
    title: String(notification.title || ''),
    message: String(notification.message || ''),
    related_id: notification.related_id ? String(notification.related_id) : null,
    related_type: notification.related_type ? String(notification.related_type) : null,
    channels: notification.channels || {
      in_app: true,
      sms: false,
      whatsapp: false,
    },
    read: Boolean(notification.read),
    created_at: notification.created_at || new Date().toISOString(),
    expires_at: notification.expires_at || null,
    sync_status: notification.sync_status || 'pending', // 'pending' | 'synced' | 'failed'
    metadata: notification.metadata || {},
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTIFICATION_STORE, 'readwrite');
    const store = tx.objectStore(NOTIFICATION_STORE);
    const request = store.put(record);

    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all notifications for a specific user, ordered newest first.
 */
export async function getOfflineNotifications(userId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(NOTIFICATION_STORE, 'readonly');
      const store = tx.objectStore(NOTIFICATION_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        let items = request.result || [];
        if (userId) {
          items = items.filter(n => !n.user_id || n.user_id === String(userId));
        }
        // Sort newest first
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to read notifications from IndexedDB:', err);
    return [];
  }
}

/**
 * Get unread notifications for a specific user.
 */
export async function getOfflineUnreadNotifications(userId) {
  const all = await getOfflineNotifications(userId);
  return all.filter(n => !n.read);
}

/**
 * Get a single notification by ID.
 */
export async function getOfflineNotificationById(id) {
  if (!id) return null;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(NOTIFICATION_STORE, 'readonly');
      const store = tx.objectStore(NOTIFICATION_STORE);
      const request = store.get(String(id));

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to get notification by ID from IndexedDB:', err);
    return null;
  }
}

/**
 * Mark a single notification as read in IndexedDB and flag for sync.
 */
export async function markOfflineNotificationRead(id) {
  if (!id) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTIFICATION_STORE, 'readwrite');
    const store = tx.objectStore(NOTIFICATION_STORE);
    const getReq = store.get(String(id));

    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) {
        resolve(null);
        return;
      }
      record.read = true;
      record.sync_status = 'pending';
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Mark all notifications as read for a given user in IndexedDB.
 */
export async function markAllOfflineNotificationsRead(userId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTIFICATION_STORE, 'readwrite');
    const store = tx.objectStore(NOTIFICATION_STORE);
    const getAllReq = store.getAll();

    getAllReq.onsuccess = () => {
      const items = getAllReq.result || [];
      const updated = [];
      for (const item of items) {
        if (!userId || item.user_id === String(userId)) {
          if (!item.read) {
            item.read = true;
            item.sync_status = 'pending';
            store.put(item);
            updated.push(item);
          }
        }
      }
      resolve(updated);
    };
    getAllReq.onerror = () => reject(getAllReq.error);
  });
}

/**
 * Delete a notification by ID from IndexedDB.
 */
export async function deleteOfflineNotification(id) {
  if (!id) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(NOTIFICATION_STORE, 'readwrite');
      const store = tx.objectStore(NOTIFICATION_STORE);
      const request = store.delete(String(id));

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to delete notification from IndexedDB:', err);
  }
}

/**
 * Get all notifications pending synchronization with Supabase.
 */
export async function getPendingOfflineNotifications(userId) {
  const all = await getOfflineNotifications(userId);
  return all.filter(n => n.sync_status === 'pending');
}

/**
 * Remove expired notifications from IndexedDB.
 */
export async function clearExpiredOfflineNotifications(userId) {
  const now = new Date().getTime();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTIFICATION_STORE, 'readwrite');
    const store = tx.objectStore(NOTIFICATION_STORE);
    const getAllReq = store.getAll();

    getAllReq.onsuccess = () => {
      const items = getAllReq.result || [];
      let removedCount = 0;
      for (const item of items) {
        if (!userId || item.user_id === String(userId)) {
          if (item.expires_at && new Date(item.expires_at).getTime() < now) {
            store.delete(item.id);
            removedCount++;
          }
        }
      }
      resolve(removedCount);
    };
    getAllReq.onerror = () => reject(getAllReq.error);
  });
}

/**
 * Bulk save notifications into IndexedDB (e.g. from Supabase sync).
 */
export async function bulkPutOfflineNotifications(notifications) {
  if (!Array.isArray(notifications) || notifications.length === 0) return [];
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTIFICATION_STORE, 'readwrite');
    const store = tx.objectStore(NOTIFICATION_STORE);

    for (const notif of notifications) {
      if (notif && notif.id) {
        store.put(notif);
      }
    }

    tx.oncomplete = () => resolve(notifications);
    tx.onerror = () => reject(tx.error);
  });
}
