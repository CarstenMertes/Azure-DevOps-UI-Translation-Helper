/**
 * Settings Page Script
 * Verwaltet alle erweiterten Einstellungen der Extension
 */

(async function() {
    'use strict';

    // Default Settings
    const DEFAULT_SETTINGS = {
        storageType: 'local',
        updateInterval: 2000,
        debugMode: false,
        autoTranslate: true,
        panelPosition: 'side',
        panelTheme: 'light',
        autoBackup: false,
        maxCache: 1000,
        experimental: false
    };

    let currentSettings = { ...DEFAULT_SETTINGS };

    /**
     * Initialisierung
     */
    async function init() {
        console.log('[Settings] Initialisiere Settings-Seite...');

        await loadSettings();
        await updateStorageStats();
        setupEventListeners();

        console.log('[Settings] Initialisierung abgeschlossen');
    }

    /**
     * Einstellungen laden
     */
    async function loadSettings() {
        const data = await chrome.storage.local.get(['extensionSettings']);

        if (data.extensionSettings) {
            currentSettings = { ...DEFAULT_SETTINGS, ...data.extensionSettings };
        }

        // UI aktualisieren
        document.getElementById('storage-type').value = currentSettings.storageType;
        document.getElementById('update-interval').value = currentSettings.updateInterval;
        document.getElementById('debug-mode').checked = currentSettings.debugMode;
        document.getElementById('auto-translate').checked = currentSettings.autoTranslate;
        document.getElementById('panel-position').value = currentSettings.panelPosition;
        document.getElementById('panel-theme').value = currentSettings.panelTheme;
        document.getElementById('auto-backup').checked = currentSettings.autoBackup;
        document.getElementById('max-cache').value = currentSettings.maxCache;
        document.getElementById('experimental').checked = currentSettings.experimental;

        console.log('[Settings] Einstellungen geladen:', currentSettings);
    }

    /**
     * Einstellungen speichern
     */
    async function saveSettings() {
        // Werte aus UI lesen
        currentSettings.storageType = document.getElementById('storage-type').value;
        currentSettings.updateInterval = parseInt(document.getElementById('update-interval').value);
        currentSettings.debugMode = document.getElementById('debug-mode').checked;
        currentSettings.autoTranslate = document.getElementById('auto-translate').checked;
        currentSettings.panelPosition = document.getElementById('panel-position').value;
        currentSettings.panelTheme = document.getElementById('panel-theme').value;
        currentSettings.autoBackup = document.getElementById('auto-backup').checked;
        currentSettings.maxCache = parseInt(document.getElementById('max-cache').value);
        currentSettings.experimental = document.getElementById('experimental').checked;

        // Speichern
        await chrome.storage.local.set({ extensionSettings: currentSettings });

        console.log('[Settings] Einstellungen gespeichert:', currentSettings);

        return currentSettings;
    }

    /**
     * Storage-Statistiken aktualisieren
     */
    async function updateStorageStats() {
        try {
            await StorageManager.init();
            const info = await StorageManager.getStorageInfo();

            // Aktuellen Storage-Typ
            document.getElementById('current-storage-type').textContent = info.type.toUpperCase();
            document.getElementById('storage-usage').textContent =
                `${info.sizeFormatted} (${info.percentUsed}% used)`;

            // Statistik-Karten
            document.getElementById('stat-count').textContent = info.count.toLocaleString();
            document.getElementById('stat-size').textContent = info.sizeFormatted;
            document.getElementById('stat-percent').textContent = info.percentUsed + '%';

            // Dropdown aktualisieren
            document.getElementById('storage-type').value = info.type;

            console.log('[Settings] Storage-Statistiken aktualisiert:', info);
        } catch (error) {
            console.error('[Settings] Fehler beim Laden der Statistiken:', error);
            showStatus('storage-status', 'Error loading storage stats: ' + error.message, 'error');
        }
    }

    /**
     * Event Listener einrichten
     */
    function setupEventListeners() {
        // Storage anwenden & migrieren
        document.getElementById('apply-storage').addEventListener('click', async () => {
            const newType = document.getElementById('storage-type').value;
            const currentType = StorageManager.getStorageType();

            if (newType === currentType) {
                showStatus('storage-status', 'This storage type is already active!', 'info');
                return;
            }

            if (!confirm(`Migrate from "${currentType}" to "${newType}"?\n\nYour translations will be automatically copied.`)) {
                return;
            }

            showStatus('storage-status', '⏳ Migration in progress...', 'info');

            try {
                await StorageManager.migrate(currentType, newType);
                await updateStorageStats();

                // Settings aktualisieren
                currentSettings.storageType = newType;
                await chrome.storage.local.set({ extensionSettings: currentSettings });

                showStatus('storage-status', `✅ Successfully migrated to ${newType}!`, 'success');
            } catch (error) {
                console.error('[Settings] Migration failed:', error);
                showStatus('storage-status', '❌ Migration failed: ' + error.message, 'error');
            }
        });

        // Storage testen
        document.getElementById('test-storage').addEventListener('click', async () => {
            showStatus('storage-status', '🧪 Testing storage...', 'info');

            try {
                const testData = { test: 'data', timestamp: Date.now() };
                await StorageManager.save({ '__TEST__': 'test' });
                const loaded = await StorageManager.load();

                if (loaded['__TEST__'] === 'test') {
                    // Delete test data again
                    delete loaded['__TEST__'];
                    await StorageManager.save(loaded);

                    showStatus('storage-status', '✅ Storage is working correctly!', 'success');
                } else {
                    showStatus('storage-status', '⚠️ Storage test failed!', 'warning');
                }
            } catch (error) {
                showStatus('storage-status', '❌ Storage test error: ' + error.message, 'error');
            }
        });

        // Clear cache
        document.getElementById('clear-cache').addEventListener('click', () => {
            if (confirm('Clear all cached data?\n\nThis will force re-translation on next page load.')) {
                // Sende Nachricht an Content Script
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, { action: 'clearCache' }).catch(() => {});
                    });
                });

                showStatus('data-status', '✅ Cache cleared!', 'success');
            }
        });

        // Reset settings
        document.getElementById('reset-settings').addEventListener('click', async () => {
            if (confirm('⚠️ Reset ALL settings to defaults?\n\nThis cannot be undone!')) {
                currentSettings = { ...DEFAULT_SETTINGS };
                await chrome.storage.local.set({ extensionSettings: currentSettings });
                await loadSettings();

                showStatus('data-status', '✅ Settings reset to defaults!', 'success');
            }
        });

        // Export settings
        document.getElementById('export-settings').addEventListener('click', async () => {
            const exportData = {
                settings: currentSettings,
                timestamp: new Date().toISOString(),
                version: '2.1.0'
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `azure-devops-translation-settings-${Date.now()}.json`;
            a.click();

            URL.revokeObjectURL(url);

            showStatus('data-status', '✅ Settings exported!', 'success');
        });

        // Save all
        document.getElementById('save-all').addEventListener('click', async () => {
            showStatus('save-status', '💾 Saving...', 'info');

            try {
                await saveSettings();
                showStatus('save-status', '✅ All settings saved successfully!', 'success');

                // Return to main page after 2 seconds
                setTimeout(() => {
                    window.location.href = 'options.html';
                }, 2000);
            } catch (error) {
                showStatus('save-status', '❌ Error saving: ' + error.message, 'error');
            }
        });

        // Cancel
        document.getElementById('cancel').addEventListener('click', () => {
            if (confirm('Discard changes and go back?')) {
                window.location.href = 'options.html';
            }
        });

        // Update Interval Validierung
        document.getElementById('update-interval').addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            if (value < 500) {
                e.target.value = 500;
                alert('Minimum interval is 500ms to prevent performance issues.');
            } else if (value > 10000) {
                e.target.value = 10000;
                alert('Maximum interval is 10000ms (10 seconds).');
            }
        });

        // Max Cache Validierung
        document.getElementById('max-cache').addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            if (value < 100) {
                e.target.value = 100;
            } else if (value > 10000) {
                e.target.value = 10000;
            }
        });
    }

    /**
     * Status-Nachricht anzeigen
     */
    function showStatus(elementId, message, type = 'info') {
        const element = document.getElementById(elementId);
        element.textContent = message;
        element.className = `status-message ${type}`;
        element.style.display = 'block';

        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                element.style.display = 'none';
            }, 5000);
        }
    }

    // Initialisierung starten
    init();
})();
