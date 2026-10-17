(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let store;
  function notice(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(notice.timer); notice.timer = setTimeout(() => el.classList.remove('show'), 5000);
  }
  try { store = QCBusinessStore.create(localStorage); }
  catch { document.querySelectorAll('#businessPanel input, #businessPanel button:not([data-go-home]), .business-form input, .business-form select, .business-form button').forEach(x=>x.disabled=true); notice('Business data could not be loaded. Existing data has been preserved.'); return; }
  const money = value => new Intl.NumberFormat('en-LK',{style:'currency',currency:'LKR'}).format(value);
  function line(parent, tag, value, cls) { const el=document.createElement(tag); el.textContent=value; if(cls) el.className=cls; parent.append(el); return el; }
  function renderList(container,kind,items,data) {
    const target=$(container); target.replaceChildren();
    if (!items.length) { line(target,'p', 'Nothing saved yet. Add your first '+({businesses:'business profile',products:'product',used:'listing',venues:'venue'}[kind])+'.','panel'); return; }
    items.forEach(item=> {
      const card=document.createElement('article'); card.className='panel';
      line(card,'span',kind==='businesses'?'LOCAL BUSINESS PROFILE':'LOCAL DRAFT','eyebrow');
      line(card,'h3',item.name);
      if (kind === 'businesses') line(card,'p',(item.type==='shop'?'Sports shop':'Venue operator')+' · '+item.area);
      else {
        line(card,'p',money(item.price)+(kind==='venues'?' / hour':''),'price');
        line(card,'p',item.area);
        if(item.businessId) line(card,'p',data.businesses.find(b=>b.id===item.businessId)?.name || '');
      }
      if(kind==='products') line(card,'p',item.stock > 0 ? item.stock+' in stock':'Out of stock');
      if(kind==='used') line(card,'p','Condition: '+item.condition);
      if(item.contact) line(card,'p','Contact: '+item.contact);
      if(kind==='venues') { line(card,'p',item.sport); line(card,'p','Availability and booking are not connected.','fine-print'); }
      const remove=line(card,'button','Remove','button quiet'); remove.type='button';
      remove.addEventListener('click',()=> { if(!confirm('Remove “'+item.name+'” from this local pilot?'))return; try{store.remove(kind,item.id);render();notice('Removed.');}catch(e){notice(e.message);} });
      target.append(card);
    });
  }
  function render() {
    const data=store.snapshot();
    $('businessStats').textContent = `${data.businesses.length} businesses · ${data.products.length} products · ${data.used.length} used listings · ${data.venues.length} venues`;
    [['productForm','shop'],['venueForm','venue']].forEach(([id,type])=> {
      const select=$(id).elements.businessId; const current=select.value; select.replaceChildren();
      const owners=data.businesses.filter(b=>b.type===type);
      const first=document.createElement('option'); first.value=''; first.textContent=owners.length?'Choose a business':'Create a '+(type==='shop'?'shop':'venue operator')+' in Business Workspace first'; select.append(first);
      owners.forEach(b=>{const option=document.createElement('option');option.value=b.id;option.textContent=b.name;select.append(option);});
      if(owners.some(b=>b.id===current))select.value=current;
      $(id).querySelector('button[type="submit"]').disabled=!owners.length;
    });
    renderList('businessList','businesses',data.businesses,data); renderList('productList','products',data.products,data);renderList('usedList','used',data.used,data);renderList('venueList','venues',data.venues,data);
  }
  [['businessForm','businesses'],['productForm','products'],['usedForm','used'],['venueForm','venues']].forEach(([id,kind])=> {
    $(id).addEventListener('submit',event=> {
      event.preventDefault(); const record=Object.fromEntries(new FormData(event.target));
      Object.keys(record).forEach(k=>record[k]=record[k].trim());
      record.id=crypto.randomUUID(); if ('price' in record)record.price=Number(record.price);if('stock'in record)record.stock=Number(record.stock);
      try{store.add(kind,record);event.target.reset();render();notice('Saved on this device.');}catch(e){notice('Could not save: '+e.message);}
    });
  });
  $('exportBusiness').addEventListener('click',()=> {
    const blob=new Blob([JSON.stringify(store.snapshot(),null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download='quickcricket-business-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('importBusiness').addEventListener('change',async event=> {
    const file=event.target.files[0];if(!file)return;
    try { if(file.size>5*1024*1024)throw Error('Backup exceeds 5 MB.'); const data=QCBusinessStore.validate(JSON.parse(await file.text()));
      if(confirm('Replace all business profiles and listings on this device with this backup? Match data will stay as it is.')){store.restore(data);render();notice('Business backup restored.');}
    }catch(e){notice('Could not restore: '+e.message);}finally{event.target.value='';}
  });
  window.addEventListener('storage',event=>{if(event.key===QCBusinessStore.KEY){try{store=QCBusinessStore.create(localStorage);render();}catch{notice('Business data changed in another tab. Reload to check it.');}}});
  render();
})();
