/**
 * theme.js — Dark / Light Mode Toggle
 * NOTE: This script is loaded WITHOUT defer so it runs immediately
 * to prevent flash of wrong theme. Button wiring is done on DOMContentLoaded.
 */

(function () {
  const KEY = 'sfp-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
    // Update button emoji if it exists already
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    }
  }

  function toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  // Apply saved preference immediately (prevents flash of wrong theme)
  applyTheme(localStorage.getItem(KEY) || 'dark');

  // Wire up button after DOM is fully loaded
  document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      // Set correct icon for current theme
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      btn.textContent = current === 'dark' ? '☀️' : '🌙';
      btn.addEventListener('click', toggle);
    }
  });
})();
