/**
 * Storage Manager für Azure DevOps Translation Extension
 * Unterstützt: chrome.storage.sync, chrome.storage.local, IndexedDB
 */

const StorageManager = (function() {
  'use strict';

  const DB_NAME = 'AzureDevOpsTranslationDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'translations';

  // Storage-Typ aus Settings laden (default: local)
  let currentStorageType = 'local';
  let indexedDB_instance = null;

  /**
   * Initialisierung des Storage Managers
   */
  async function init() {
    // Lade gespeicherten Storage-Typ
    return new Promise((resolve) => {
      chrome.storage.local.get(['storageType'], function(data) {
        currentStorageType = data.storageType || 'local';
        console.log('[Storage Manager] Initialisiert mit:', currentStorageType);
        resolve(currentStorageType);
      });
    });
  }

  /**
   * Storage-Typ ändern
   */
  async function setStorageType(type) {
    if (!['sync', 'local', 'indexeddb'].includes(type)) {
      throw new Error('Ungültiger Storage-Typ: ' + type);
    }

    currentStorageType = type;

    // Speichere Auswahl in local storage (meta-setting)
    return new Promise((resolve) => {
      chrome.storage.local.set({ storageType: type }, function() {
        console.log('[Storage Manager] Storage-Typ geändert zu:', type);
        resolve();
      });
    });
  }

  /**
   * Aktuellen Storage-Typ abrufen
   */
  function getStorageType() {
    return currentStorageType;
  }

  /**
   * IndexedDB initialisieren
   */
  function initIndexedDB() {
    return new Promise((resolve, reject) => {
      if (indexedDB_instance) {
        resolve(indexedDB_instance);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[IndexedDB] Fehler beim Öffnen:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        indexedDB_instance = request.result;
        console.log('[IndexedDB] Erfolgreich geöffnet');
        resolve(indexedDB_instance);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Object Store erstellen (falls nicht existiert)
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          objectStore.createIndex('source', 'source', { unique: true });
          objectStore.createIndex('target', 'target', { unique: false });
          console.log('[IndexedDB] Object Store erstellt');
        }
      };
    });
  }

  /**
   * Daten speichern (universell)
   */
  async function save(translations) {
    console.log('[Storage Manager] Speichere', Object.keys(translations).length, 'Einträge in:', currentStorageType);

    switch (currentStorageType) {
      case 'sync':
        return saveToChromeSync(translations);

      case 'local':
        return saveToChromeLocal(translations);

      case 'indexeddb':
        return saveToIndexedDB(translations);

      default:
        throw new Error('Unbekannter Storage-Typ: ' + currentStorageType);
    }
  }

  /**
   * Daten laden (universell)
   */
  async function load() {
    console.log('[Storage Manager] Lade Daten von:', currentStorageType);

    switch (currentStorageType) {
      case 'sync':
        return loadFromChromeSync();

      case 'local':
        return loadFromChromeLocal();

      case 'indexeddb':
        return loadFromIndexedDB();

      default:
        throw new Error('Unbekannter Storage-Typ: ' + currentStorageType);
    }
  }

  /**
   * CHROME STORAGE SYNC
   */
  function saveToChromeSync(translations) {
    return new Promise((resolve, reject) => {
      // Size check
      const jsonString = JSON.stringify(translations);
      const sizeKB = new Blob([jsonString]).size / 1024;

      if (sizeKB > 100) {
        reject(new Error('Data too large for chrome.storage.sync! Limit: 100 KB, Current: ' + sizeKB.toFixed(2) + ' KB'));
        return;
      }

      chrome.storage.sync.set({ customTranslations: translations }, function() {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log('[Chrome Sync] Saved:', sizeKB.toFixed(2), 'KB');
          resolve();
        }
      });
    });
  }

  function loadFromChromeSync() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['customTranslations'], function(data) {
        const translations = data.customTranslations || {};
        console.log('[Chrome Sync] Loaded:', Object.keys(translations).length, 'entries');
        resolve(translations);
      });
    });
  }

  /**
   * CHROME STORAGE LOCAL
   */
  function saveToChromeLocal(translations) {
    return new Promise((resolve, reject) => {
      // Size check
      const jsonString = JSON.stringify(translations);
      const sizeMB = new Blob([jsonString]).size / (1024 * 1024);

      if (sizeMB > 10) {
        reject(new Error('Data too large for chrome.storage.local! Limit: 10 MB, Current: ' + sizeMB.toFixed(2) + ' MB'));
        return;
      }

      chrome.storage.local.set({ customTranslations: translations }, function() {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log('[Chrome Local] Saved:', sizeMB.toFixed(2), 'MB');
          resolve();
        }
      });
    });
  }

  function loadFromChromeLocal() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['customTranslations'], function(data) {
        const translations = data.customTranslations || {};
        console.log('[Chrome Local] Loaded:', Object.keys(translations).length, 'entries');
        resolve(translations);
      });
    });
  }

  /**
   * INDEXEDDB
   */
  async function saveToIndexedDB(translations) {
    const db = await initIndexedDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);

      // Delete old entries
      objectStore.clear();

      // Add new entries
      let count = 0;
      Object.entries(translations).forEach(([source, target]) => {
        objectStore.add({
          id: count++,
          source: source,
          target: target
        });
      });

      transaction.oncomplete = () => {
        console.log('[IndexedDB] Saved:', count, 'entries');
        resolve();
      };

      transaction.onerror = () => {
        console.error('[IndexedDB] Fehler beim Speichern:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  async function loadFromIndexedDB() {
    const db = await initIndexedDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const entries = request.result;
        const translations = {};

        entries.forEach(entry => {
          translations[entry.source] = entry.target;
        });

        console.log('[IndexedDB] Geladen:', Object.keys(translations).length, 'Einträge');
        resolve(translations);
      };

      request.onerror = () => {
        console.error('[IndexedDB] Fehler beim Laden:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Daten migrieren von einem Storage zum anderen
   */
  async function migrate(fromType, toType) {
    console.log('[Storage Manager] Migration:', fromType, '→', toType);

    // Lade Daten vom alten Storage
    const oldType = currentStorageType;
    currentStorageType = fromType;
    const translations = await load();

    // Speichere in neuem Storage
    currentStorageType = toType;
    await save(translations);

    // Aktualisiere Settings
    await setStorageType(toType);

    console.log('[Storage Manager] Migration abgeschlossen:', Object.keys(translations).length, 'Einträge');
    return translations;
  }

  /**
   * Storage-Informationen abrufen
   */
  async function getStorageInfo() {
    const translations = await load();
    const jsonString = JSON.stringify(translations);
    const sizeBytes = new Blob([jsonString]).size;
    const count = Object.keys(translations).length;

    let limit, percentUsed, sizeFormatted;

    switch (currentStorageType) {
      case 'sync':
        limit = 100 * 1024; // 100 KB
        sizeFormatted = (sizeBytes / 1024).toFixed(2) + ' KB';
        break;

      case 'local':
        limit = 10 * 1024 * 1024; // 10 MB
        sizeFormatted = (sizeBytes / 1024).toFixed(2) + ' KB';
        break;

      case 'indexeddb':
        // IndexedDB hat theoretisch GB-Limit, wir zeigen MB
        limit = 1 * 1024 * 1024 * 1024; // 1 GB (symbolisch)
        sizeFormatted = (sizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
        break;
    }

    percentUsed = (sizeBytes / limit * 100).toFixed(1);

    return {
      type: currentStorageType,
      count: count,
      sizeBytes: sizeBytes,
      sizeFormatted: sizeFormatted,
      limit: limit,
      percentUsed: parseFloat(percentUsed)
    };
  }

  /**
   * Öffentliche API
   */
  return {
    init: init,
    save: save,
    load: load,
    setStorageType: setStorageType,
    getStorageType: getStorageType,
    migrate: migrate,
    getStorageInfo: getStorageInfo
  };
})();

// For module system
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
