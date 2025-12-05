/**
 * UI Mode Handler
 * Handles compact mode for side panel
 */

(function() {
  'use strict';

  // Check if compact mode should be enabled
  function initializeUIMode() {
    const isCompact = window.location.search.includes('compact=true') || window.innerWidth < 400;

    if (isCompact) {
      document.body.classList.add('compact');
      console.log('[UI Mode] Compact mode enabled');
    } else {
      console.log('[UI Mode] Normal mode');
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUIMode);
  } else {
    initializeUIMode();
  }
})();
