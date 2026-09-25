/**
 * IndexedDB Service for TripSync Offline Document Storage
 * 
 * Database: TripSyncOfflineDB
 * ObjectStore: offline_documents (keyPath: document_id)
 */

const DB_NAME = 'TripSyncOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_documents';

/**
 * Open or upgrade the IndexedDB database.
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'document_id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

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
