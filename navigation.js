(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const routeKey = 'quickcricket.section.v1';
  function showSection(name) {
    const map = { profile: 'profilePanel', orders: 'ordersPanel', home: 'homePanel', live: 'liveSection', shop: 'shopPanel', used: 'usedPanel', venues: 'venuesPanel', business: 'businessPanel' };
    if(!Object.prototype.hasOwnProperty.call(map,name))name='home';
    try{sessionStorage.setItem(routeKey,name);}catch{}
    try{const url=new URL(window.location.href);url.searchParams.set('section',name);window.history.replaceState(null,'',url.toString());}catch{}
    Object.values(map).forEach(id => { const node = $(id); if (node) node.hidden = true; });
    const target = $(map[name] || map.home);
    if (target) target.hidden = false;
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.dispatchEvent(new CustomEvent('qc-section-changed', {detail: {section: name}}));
  }
  window.QCNavigation={open:showSection};
  document.addEventListener('DOMContentLoaded', () => {
    // Delegation also covers navigation controls added after startup.
    document.addEventListener('click', event => {
      const control = event.target.closest?.('[data-open-section], [data-go-home]');
      if (!control || event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      showSection(control.hasAttribute('data-go-home') ? 'home' : control.dataset.openSection);
    });
    document.querySelectorAll('[data-demo-action]').forEach(button => {
      button.addEventListener('click', () => {
        const toast = $('toast');
        if (toast) { toast.textContent = 'This is a preview. This feature will be connected in a later milestone.'; toast.classList.add('show'); window.setTimeout(() => toast.classList.remove('show'), 2300); }
      });
    });
    const params=new URLSearchParams(window.location.search);
    let saved='home';try{saved=sessionStorage.getItem(routeKey)||'home';}catch{}
    showSection(params.get('section') || (params.has('match') ? 'live' : saved));
  });
})();
