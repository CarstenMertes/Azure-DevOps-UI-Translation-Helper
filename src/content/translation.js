(function() {
  'use strict';

  console.log('[Azure DevOps Translation] Extension started');

  let translations = {}; // Loaded from storage
  let isTranslating = false; // Prevents multiple simultaneous translations
  let processedNodes = new WeakSet(); // Marks already translated nodes
  let defaultTranslations = {}; // Will be loaded from JSON

  // Load default translations from JSON file
  async function loadDefaultTranslations() {
    try {
      console.log('[Azure DevOps Translation] Loading default translations from data/azure-devops-translations.json...');
      const response = await fetch(chrome.runtime.getURL('data/azure-devops-translations.json'));
      if (!response.ok) {
        throw new Error('Failed to load JSON: ' + response.status);
      }
      const data = await response.json();

      // Handle both formats: { translations: {...} } or { ... }
      const translations = data.translations || data;

      console.log('[Azure DevOps Translation] Default translations loaded:', Object.keys(translations).length, 'entries');
      return translations;
    } catch (error) {
      console.error('[Azure DevOps Translation] Error loading default translations:', error);
      return {};
    }
  }  // ✨ Initialize Storage Manager and load translations
  async function initializeTranslations() {
    try {
      // 0. Load default translations from JSON first
      await loadDefaultTranslations();

      // 1. Load translations from storage
      console.log('[Azure DevOps Translation] Initializing Storage Manager...');
      await StorageManager.init();
      console.log('[Azure DevOps Translation] Loading translations from storage...');
      translations = await StorageManager.load();

      console.log('[Azure DevOps Translation] Loaded from storage:', Object.keys(translations).length, 'entries');

      // 2. If empty, use and save defaults
      if (Object.keys(translations).length === 0) {
        console.log('[Azure DevOps Translation] Storage empty! Using default translations...');
        translations = { ...defaultTranslations };
        await StorageManager.save(translations);
        console.log('[Azure DevOps Translation] ✅ Default translations saved to storage!');
      }

      const info = await StorageManager.getStorageInfo();
      console.log('[Azure DevOps Translation] Translations loaded:', info.count, 'entries');
      console.log('[Azure DevOps Translation] Storage:', info.type, '(' + info.sizeFormatted + ', ' + info.percentUsed + '% used)');
      console.log('[Azure DevOps Translation] First 5 translations:', Object.keys(translations).slice(0, 5));

      // Start translation after loading
      startTranslation();
    } catch (error) {
      console.error('[Azure DevOps Translation] Error loading:', error);
      console.log('[Azure DevOps Translation] Using default translations as fallback');
      translations = { ...defaultTranslations };
      startTranslation();
    }
  }

  // Initialize
  initializeTranslations();

  // Observe storage changes (for all storage types)
  chrome.storage.onChanged.addListener(async function(changes, namespace) {
    if (changes.customTranslations || changes.storageType) {
      console.log('[Azure DevOps Translation] Storage change detected');

      // Reload with current Storage Manager
      try {
        await StorageManager.init();
        translations = await StorageManager.load();
        console.log('[Azure DevOps Translation] Translations updated:', Object.keys(translations).length, 'entries');

        // Reset the processed nodes cache
        processedNodes = new WeakSet();

        translateDocument();
      } catch (error) {
        console.error('[Azure DevOps Translation] Error updating:', error);
      }
    }
  });

  function startTranslation() {
    console.log('[Azure DevOps Translation] Starting translation');

    // MutationObserver for dynamic content
    const observer = new MutationObserver(function(mutations) {
      let shouldTranslate = false;

      mutations.forEach(function(mutation) {
        // Check for new or changed nodes
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldTranslate = true;
        } else if (mutation.type === 'characterData') {
          shouldTranslate = true;
        }
      });

      if (shouldTranslate && !isTranslating) {
        translateDocument();
      }
    });

    // Observe the entire document
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: false
    });

    // Initial translation
    translateDocument();

    // Periodic translation as backup (every 2 seconds)
    setInterval(function() {
      if (!isTranslating) {
        translateDocument();
      }
    }, 2000);
  }

  function translateDocument() {
    if (isTranslating) return;

    isTranslating = true;

    try {
      const startTime = performance.now();

      // Translate all text nodes in document
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            // Ignore script and style tags
            const parent = node.parentElement;
            if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') {
              return NodeFilter.FILTER_REJECT;
            }

            // Ignore empty texts
            const text = node.textContent.trim();
            if (!text) {
              return NodeFilter.FILTER_REJECT;
            }

            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      let node;
      let translatedCount = 0;
      let nodeCount = 0;

      while (node = walker.nextNode()) {
        nodeCount++;
        if (translateTextNode(node)) {
          translatedCount++;
        }
      }

      const duration = (performance.now() - startTime).toFixed(2);

      if (translatedCount > 0) {
        console.log('[Azure DevOps Translation] ' + translatedCount + ' of ' + nodeCount + ' texts translated (' + duration + 'ms)');
      }
    } catch (error) {
      console.error('[Azure DevOps Translation] Error:', error);
    } finally {
      isTranslating = false;
    }
  }

  function translateTextNode(textNode) {
    // Check if already translated
    if (processedNodes.has(textNode)) {
      return false;
    }

    const originalText = textNode.textContent.trim();

    // EXACT MATCH ONLY!
    // Check if entire text exactly matches a translation key
    if (translations.hasOwnProperty(originalText)) {
      const translatedText = translations[originalText];

      // Keep leading/trailing whitespaces
      const leadingWhitespace = textNode.textContent.match(/^\s*/)[0];
      const trailingWhitespace = textNode.textContent.match(/\s*$/)[0];

      textNode.textContent = leadingWhitespace + translatedText + trailingWhitespace;
      processedNodes.add(textNode);

      console.log('[Azure DevOps Translation] Translated: "' + originalText + '" → "' + translatedText + '"');
      return true;
    }

    return false;
  }

  console.log('[Azure DevOps Translation] Extension loaded');
})();
