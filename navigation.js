(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  function showSection(name) {
    const map = { profile: 'profilePanel', orders: 'ordersPanel', home: 'homePanel', live: 'liveSection', shop: 'shopPanel', used: 'usedPanel', venues: 'venuesPanel', business: 'businessPanel' };
    Object.values(map).forEach(id => { const node = $(id); if (node) node.hidden = true; });
    const target = $(map[name] || map.home);
    if (target) target.hidden = false;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-open-section]').forEach(button => {
      button.addEventListener('click', () => showSection(button.dataset.openSection));
    });
    document.querySelectorAll('[data-go-home]').forEach(button => {
      button.addEventListener('click', () => showSection('home'));
    });
    document.querySelectorAll('[data-demo-action]').forEach(button => {
      button.addEventListener('click', () => {
        const toast = $('toast');
        if (toast) { toast.textContent = 'This is a preview. This feature will be connected in a later milestone.'; toast.classList.add('show'); window.setTimeout(() => toast.classList.remove('show'), 2300); }
      });
    });
    // Shared spectator links open directly into Live Sports. Normal visits open the dashboard.
    showSection(new URLSearchParams(window.location.search).has('match') ? 'live' : 'home');
  });
})();
