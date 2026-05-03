/**
 * theme.js — Theme persistence helper
 * Applies saved theme from localStorage before any render to avoid flash.
 * This script is intentionally tiny and loads synchronously.
 */

(function () {
  const saved = localStorage.getItem('sfp-theme');
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.setAttribute('data-theme', saved);
  }
})();
