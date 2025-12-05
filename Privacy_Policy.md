# Privacy Policy

**Azure DevOps UI Translation Helper**

Last Updated: December 5, 2025

## Overview

The Azure DevOps UI Translation Helper ("Extension") is committed to protecting your privacy. This Privacy Policy explains how our Extension collects, uses, and protects your information.

## Data Collection and Usage

### What Data We Collect

Our Extension collects and stores the following data **locally on your device only**:

- **Translation Pairs**: Custom translations you create (English ↔ German or other languages)
- **User Preferences**: Your selected language pair and storage type preferences
- **Storage Location Preference**: Your choice of storage backend (Chrome Storage Sync, Chrome Storage Local, or IndexedDB)

### Where Data is Stored

All data is stored **exclusively on your local machine** using:
- Chrome's `chrome.storage.local` - Local device storage
- Chrome's `chrome.storage.sync` - Synced across your Chrome profile (if you choose this option)
- Browser's `IndexedDB` - Local browser database (if you choose this option)

**Important**: We do NOT send any of your translation data to external servers or third parties.

### What Data We DON'T Collect

- ❌ Personal information (name, email, etc.)
- ❌ Azure DevOps account credentials
- ❌ Azure DevOps project or work item data
- ❌ Browsing history
- ❌ Cookies or tracking pixels
- ❌ Analytics or usage data
- ❌ IP addresses or location data

## Permissions Explanation

This Extension requires the following permissions:

### `storage`
- **Purpose**: To save your custom translations and preferences
- **Data**: Stores translation pairs, language preferences, and settings
- **Storage**: Local to your device, not shared with anyone

### `sidePanel`
- **Purpose**: To display the translation management panel in the Chrome Side Panel
- **Data**: None collected for this permission

### `host_permissions` (https://dev.azure.com/*)
- **Purpose**: To translate text on Azure DevOps pages
- **Data**: No data is sent; translations happen entirely in your browser
- **Scope**: Only affects Azure DevOps pages, no other websites

## Third-Party Services

This Extension **does not use any third-party services** for:
- Analytics
- Crash reporting
- Telemetry
- Translation APIs

All functionality is self-contained within the Extension.

## Data Security

- All data is encrypted by Chrome's storage system
- No data is transmitted over the internet
- You have full control over your data
- You can export your translations as JSON anytime
- You can delete all data by clearing the Extension's storage

## Your Rights

You can:
- **View** all stored translations in the Options page
- **Edit** or delete any translation
- **Export** all translations as a JSON file
- **Reset** all settings to defaults
- **Uninstall** the Extension to remove all data

## Policy Changes

We may update this Privacy Policy from time to time. If we make material changes, we will notify you by updating the "Last Updated" date above.

## Contact

If you have questions about this Privacy Policy, you can:
- Report an issue on GitHub: [azure-devops-translation-edge](https://github.com)
- Open an issue with the "privacy" label

## Compliance

This Extension complies with:
- Chrome Web Store Developer Program Policies
- GDPR (no personal data is collected or transferred)
- CCPA (no personal data is collected or transferred)

---

**Summary**: We don't collect, store, or transmit your personal data. Everything stays on your device.
