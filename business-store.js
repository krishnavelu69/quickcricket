(function (root) {
  'use strict';
  const KEY = 'quickcricket.business.v1';
  const empty = () => ({version: 1, businesses: [], products: [], used: [], venues: []});
  function validate(data) {
    if (!data || data.version !== 1 || !['businesses','products','used','venues'].every(k => Array.isArray(data[k]))) throw Error('Invalid business backup.');
    const text = (v, max=200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
    const ids = new Set();
    for (const kind of ['businesses','products','used','venues']) for (const item of data[kind]) {
      if (!text(item.id) || ids.has(item.id) || !text(item.name) || !text(item.area)) throw Error('Invalid or duplicate record.');
      ids.add(item.id);
      if (kind === 'businesses' && (!['shop','venue'].includes(item.type) || !text(item.contact))) throw Error('Invalid business details.');
      if (kind !== 'businesses' && (!Number.isFinite(item.price) || item.price <= 0 || item.price > 100000000)) throw Error('Enter a valid price.');
      if (kind === 'products' && (!Number.isInteger(item.stock) || item.stock < 0 || item.stock > 1000000)) throw Error('Enter valid stock.');
      if (kind === 'used' && (!['Like new','Good','Fair'].includes(item.condition) || !text(item.contact))) throw Error('Invalid used-item details.');
      if (kind === 'venues' && !text(item.sport)) throw Error('Enter a sport.');
      if (kind === 'products' || kind === 'venues') {
        const owner = data.businesses.find(b => b.id === item.businessId);
        if (!owner || owner.type !== (kind === 'products' ? 'shop' : 'venue')) throw Error('Select a matching business profile.');
      }
    }
    return data;
  }
  function create(storage) {
    let data = empty();
    const raw = storage.getItem(KEY);
    if (raw) data = validate(JSON.parse(raw));
    function commit(next) { validate(next); storage.setItem(KEY, JSON.stringify(next)); data = next; return snapshot(); }
    function snapshot() { return JSON.parse(JSON.stringify(data)); }
    return {
      snapshot,
      add(kind, record) {
        if (!['businesses','products','used','venues'].includes(kind)) throw Error('Unknown record type.');
        const next = snapshot(); next[kind].push(record); return commit(next);
      },
      remove(kind,id) {
        if (!['businesses','products','used','venues'].includes(kind)) throw Error('Unknown record type.');
        if (kind === 'businesses' && [...data.products,...data.venues].some(x => x.businessId === id)) throw Error('Remove this business’s products or venues first.');
        const next = snapshot(); next[kind] = next[kind].filter(x => x.id !== id); return commit(next);
      },
      restore(value) { return commit(value); }
    };
  }
  const api = {create, validate, KEY};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QCBusinessStore = api;
})(typeof window === 'undefined' ? globalThis : window);
