// Load default translations from JSON (not from presets!)
let defaultTranslations = {};

async function loadDefaultTranslations() {
  try {
    console.log('[Options] Loading default translations from data/azure-devops-translations.json...');
    const response = await fetch(chrome.runtime.getURL('data/azure-devops-translations.json'));
    if (!response.ok) throw new Error('Failed to load JSON: ' + response.status);
    const data = await response.json();

    // Handle both formats: { translations: {...} } or { ... }
    defaultTranslations = data.translations || data;

    console.log('[Options] Default translations loaded:', Object.keys(defaultTranslations).length, 'entries');
    return defaultTranslations;
  } catch (error) {
    console.error('[Options] Error loading default translations:', error);
    return {};
  }
}// ✨ Use Storage Manager
let currentStorageType = 'local';

// i18n: Translate UI texts
function translateUI() {
  // Translate texts
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = chrome.i18n.getMessage(key) || el.textContent;
  });

  // Translate HTML content (for <kbd> tags etc.)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    el.innerHTML = chrome.i18n.getMessage(key) || el.innerHTML;
  });

  // Translate option elements in select dropdowns
  document.querySelectorAll('[data-i18n-option]').forEach(el => {
    const key = el.getAttribute('data-i18n-option');
    el.textContent = chrome.i18n.getMessage(key) || el.textContent;
  });
}

// ✨ Load translations from storage (with Storage Manager)
async function loadTranslations() {
  try {
    // 1. Initialize Storage Manager first
    await StorageManager.init();
    currentStorageType = StorageManager.getStorageType();
    console.log('[Options] Storage Manager initialized, type:', currentStorageType);

    // 2. Load from storage
    const translations = await StorageManager.load();
    console.log('[Options] Loaded from storage:', Object.keys(translations).length, 'entries');

    // 3. Get language pair preference
    const data = await chrome.storage.local.get(['selectedLanguagePair']);
    const languagePair = data.selectedLanguagePair || 'en-de';

    // 4. Check if storage is empty - if yes, initialize with defaults
    if (Object.keys(translations).length === 0) {
      console.log('[Options] Storage empty, initializing with defaults...');
      // Save defaults to storage
      await StorageManager.save(defaultTranslations);
      console.log('[Options] Defaults saved to storage');
      return {
        translations: defaultTranslations,
        languagePair: languagePair
      };
    }

    return {
      translations: translations,
      languagePair: languagePair
    };
  } catch (error) {
    console.error('[Options] Error loading translations:', error);
    return {
      translations: defaultTranslations,
      languagePair: 'en-de'
    };
  }
}

// Save language pair
async function saveLanguagePair(pair) {
  await chrome.storage.local.set({ selectedLanguagePair: pair });
  console.log('[Options] Language pair saved:', pair);
}

// Save translations to storage (with Storage Manager)
async function saveTranslations(translations) {
  const count = Object.keys(translations).length;

  console.log('[Options] Saving', count, 'translations');

  try {
    await StorageManager.save(translations);
    const info = await StorageManager.getStorageInfo();
    console.log('[Options] Successfully saved:', info.sizeFormatted, '(' + info.percentUsed + '% of limit)');
  } catch (error) {
    console.error('[Options] Error saving:', error);
    throw error;
  }
}

// UI render
async function renderTranslations() {
  const { translations, languagePair } = await loadTranslations();
  const container = document.getElementById('translations-container');
  const selector = document.getElementById('language-pair');

  // Update language pair selector
  selector.value = languagePair;

  // ✨ Show statistics
  updateStats(translations);

  // Clear container
  container.innerHTML = '';

  // Labels based on language pair
  const sourceLabel = chrome.i18n.getMessage('sourceLanguageLabel') || 'Source';
  const targetLabel = chrome.i18n.getMessage('targetLanguageLabel') || 'Target';

  Object.entries(translations).forEach(([source, target]) => {
    const entry = document.createElement('div');
    entry.className = 'translation-entry';
    entry.innerHTML = `
      <input type="text" class="source" value="${escapeHtml(source)}" placeholder="${sourceLabel}">
      <input type="text" class="target" value="${escapeHtml(target)}" placeholder="${targetLabel}">
      <button class="remove-btn">🗑️</button>
    `;

    entry.querySelector('.remove-btn').addEventListener('click', () => {
      entry.remove();
      // Update statistics after deletion
      updateStatsFromDOM();
    });

    container.appendChild(entry);
  });
}

// ✨ NEU: Statistiken anzeigen
function updateStats(translations) {
  const count = Object.keys(translations).length;
  const jsonString = JSON.stringify(translations);
  const sizeBytes = new Blob([jsonString]).size;
  const sizeKB = (sizeBytes / 1024).toFixed(2);

  // Limits je nach Storage-Typ
  let maxSizeMB, percentUsed;

  switch (currentStorageType) {
    case 'sync':
      maxSizeMB = 0.1; // 100 KB
      percentUsed = ((sizeBytes / 1024) / (maxSizeMB * 1024) * 100).toFixed(1);
      break;
    case 'local':
      maxSizeMB = 10; // 10 MB
      percentUsed = ((sizeBytes / 1024) / (maxSizeMB * 1024) * 100).toFixed(1);
      break;
    case 'indexeddb':
      maxSizeMB = 1024; // 1 GB (symbolisch)
      percentUsed = ((sizeBytes / (1024 * 1024)) / maxSizeMB * 100).toFixed(1);
      break;
    default:
      maxSizeMB = 10;
      percentUsed = ((sizeBytes / 1024) / (maxSizeMB * 1024) * 100).toFixed(1);
  }

  const statsBox = document.getElementById('stats-box');
  const countElement = document.getElementById('translation-count');
  const sizeElement = document.getElementById('storage-size');

  if (count > 0) {
    statsBox.style.display = 'block';
    countElement.textContent = count;

    const limitText = currentStorageType === 'indexeddb' ? `${maxSizeMB} MB` : `${maxSizeMB} MB`;
    sizeElement.textContent = `(${sizeKB} KB / ${limitText} = ${percentUsed}% used) - Type: ${currentStorageType}`;

    // Warnung bei hoher Auslastung
    if (percentUsed > 80) {
      sizeElement.style.color = 'red';
      sizeElement.textContent += ' ⚠️ Nearly full!';
    } else if (percentUsed > 50) {
      sizeElement.style.color = 'orange';
    } else {
      sizeElement.style.color = 'green';
    }
  } else {
    statsBox.style.display = 'none';
  }
}

// ✨ Update statistics from DOM (after manual changes)
function updateStatsFromDOM() {
  const entries = document.querySelectorAll('.translation-entry');
  const translations = {};

  entries.forEach(entry => {
    const source = entry.querySelector('.source').value.trim();
    const target = entry.querySelector('.target').value.trim();
    if (source && target) {
      translations[source] = target;
    }
  });

  updateStats(translations);
}

// HTML escapen
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Voreinstellung laden
document.getElementById('load-preset').addEventListener('click', async () => {
  const selector = document.getElementById('language-pair');
  const pair = selector.value;

  if (!pair) {
    alert('Please select a language pair first!');
    return;
  }

  const preset = translationPresets[pair];
  if (!preset) {
    alert('Preset not found!');
    return;
  }

  if (confirm(`Load preset "${preset.name}"? This will replace your current translations.`)) {
    await saveTranslations(preset.translations);
    await saveLanguagePair(pair);
    await renderTranslations();

    const status = document.getElementById('status');
    status.textContent = `✅ Preset "${preset.name}" loaded!`;
    setTimeout(() => status.textContent = '', 3000);
  }
});

// Add new translation
document.getElementById('add-translation').addEventListener('click', () => {
  const container = document.getElementById('translations-container');
  const sourceLabel = chrome.i18n.getMessage('sourceLanguageLabel') || 'Source';
  const targetLabel = chrome.i18n.getMessage('targetLanguageLabel') || 'Target';

  const entry = document.createElement('div');
  entry.className = 'translation-entry';
  entry.innerHTML = `
    <input type="text" class="source" placeholder="${sourceLabel} (e.g. Work Items)">
    <input type="text" class="target" placeholder="${targetLabel} (e.g. Arbeitselemente)">
    <button class="remove-btn">🗑️</button>
  `;

  entry.querySelector('.remove-btn').addEventListener('click', () => {
    entry.remove();
  });

  container.appendChild(entry);
});

// Speichern
document.getElementById('save').addEventListener('click', async () => {
  const entries = document.querySelectorAll('.translation-entry');
  const translations = {};

  entries.forEach(entry => {
    const source = entry.querySelector('.source').value.trim();
    const target = entry.querySelector('.target').value.trim();
    if (source && target) {
      translations[source] = target;
    }
  });

  const status = document.getElementById('status');

  try {
    await saveTranslations(translations);

    const count = Object.keys(translations).length;
    status.style.color = 'green';
    status.textContent = chrome.i18n.getMessage('savedMessage') || `✅ Saved ${count} translations!`;
    setTimeout(() => status.textContent = '', 3000);
  } catch (error) {
    status.style.color = 'red';
    status.textContent = '❌ Error: ' + error.message;
    setTimeout(() => {
      status.textContent = '';
      status.style.color = 'green';
    }, 5000);
  }
});

// Standard wiederherstellen
document.getElementById('reset').addEventListener('click', async () => {
  const confirmMsg = chrome.i18n.getMessage('resetConfirm') || 'Reset to defaults?';
  if (confirm(confirmMsg)) {
    await saveTranslations(defaultTranslations);
    await renderTranslations();

    const status = document.getElementById('status');
    status.textContent = chrome.i18n.getMessage('resetSuccess') || '✅ Defaults restored!';
    setTimeout(() => status.textContent = '', 3000);
  }
});

// ✨ NEU: Export als JSON
document.getElementById('export').addEventListener('click', async () => {
  const { translations, languagePair } = await loadTranslations();

  // Export format: contains both translations AND languagePair
  const exportData = {
    translations: translations,
    languagePair: languagePair
  };

  // Pretty-formatted JSON
  const jsonString = JSON.stringify(exportData, null, 2);

  // Create blob
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // Download triggern
  const a = document.createElement('a');
  a.href = url;
  a.download = 'azure-devops-translations.json';
  a.click();

  // Cleanup
  URL.revokeObjectURL(url);

  const status = document.getElementById('status');
  status.textContent = chrome.i18n.getMessage('exportSuccess') || '✅ Exported!';
  setTimeout(() => status.textContent = '', 3000);
});

// ✨ NEU: Import aus JSON
document.getElementById('import').addEventListener('click', () => {
  // File Input erstellen (unsichtbar)
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';

  input.onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;

      // Datei lesen
      const text = await file.text();

      // JSON parsen
      const data = JSON.parse(text);

      // Validierung: Ist es ein Objekt?
      if (typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Ungültiges Format! Erwartet: JSON-Objekt.');
      }

      // Check format: New format { translations: {...}, languagePair: "..." }
      let translations;
      let languagePair;

      if (data.translations && typeof data.translations === 'object') {
        // New format with translations key
        translations = data.translations;
        languagePair = data.languagePair || 'en-de';
      } else {
        // Old format: direct object with translations
        translations = data;
        languagePair = 'en-de';
      }

      // Validation: at least one translation
      if (Object.keys(translations).length === 0) {
        throw new Error('No translations found!');
      }

      // Save
      await saveTranslations(translations);
      await saveLanguagePair(languagePair);

      // UI aktualisieren
      await renderTranslations();

      const status = document.getElementById('status');
      const count = Object.keys(translations).length;
      status.textContent = chrome.i18n.getMessage('importSuccess', [count]) || `✅ ${count} imported!`;
      setTimeout(() => status.textContent = '', 3000);

    } catch (error) {
      const status = document.getElementById('status');
      status.style.color = 'red';
      status.textContent = chrome.i18n.getMessage('importError', [error.message]) || `❌ Error: ${error.message}`;
      setTimeout(() => {
        status.textContent = '';
        status.style.color = 'green';
      }, 5000);
    }
  };

  // File Dialog öffnen
  input.click();
});

// Initial: Translate UI and render
translateUI();

// ✨ Initialize storage type and translations
async function initializeStorageType() {
  try {
    // 1. Load default translations first
    await loadDefaultTranslations();
    console.log('[Options] Defaults loaded');

    // 2. Initialize Storage Manager
    await StorageManager.init();
    currentStorageType = StorageManager.getStorageType();
    console.log('[Options] Storage type:', currentStorageType);

    // 3. Load and render translations after storage is initialized
    await renderTranslations();
  } catch (error) {
    console.error('[Options] Error during initialization:', error);
  }
}

// Initialize storage type and translations
initializeStorageType();
