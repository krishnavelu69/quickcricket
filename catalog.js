(() => {
 'use strict';
 const $=id=>document.getElementById(id);let products=[],generation=0,loaded=false;
 function text(parent,tag,value,cls){const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;parent.append(el);return el;}
 function render(){
  $('catalogList').replaceChildren();if(!loaded)return;
  const query=$('catalogSearch').value.trim().toLowerCase();
  const filtered=products.filter(p=>(!$('catalogInStock').checked||p.in_stock)&&[p.name,p.description,p.shop_name,p.area].some(v=>String(v||'').toLowerCase().includes(query)));
  $('catalogStatus').textContent=products.length?`${filtered.length} product(s) shown${products.length===200?' · Showing up to 200 recent products':''}.`:'No products published yet.';
  for(const p of filtered){const card=document.createElement('article');card.className='panel';text(card,'span',p.in_stock?'IN STOCK':'OUT OF STOCK','eyebrow');const {client}=window.QCCloud.getContext();QCMedia.show(card,client,p.photo_path,p.name);QCMedia.show(card,client,p.logo_path,p.shop_name+' logo','media-avatar');text(card,'h3',p.name);text(card,'p',p.shop_name+' · '+p.area);text(card,'p',new Intl.NumberFormat('en-LK',{style:'currency',currency:'LKR'}).format(p.price),'price');text(card,'p',p.description);if(p.shop_description||p.shop_cover_path){const details=text(card,'details','');text(details,'summary','About '+p.shop_name);QCMedia.show(details,client,p.shop_cover_path,'Shop cover','media-cover');text(details,'p',p.shop_description||'');}const button=text(card,'button','Request product','button primary');button.disabled=!p.in_stock;button.addEventListener('click',()=>window.QCOrders.open(p));$('catalogList').append(card);}
 }
 async function refresh(){
  const ticket=++generation;loaded=false;products=[];render();
  const {client}=window.QCCloud?.getContext()||{};
  if(!client){$('catalogStatus').textContent='This pilot needs its Supabase connection configured under Live Sports. Once connected, browsing does not require sign-in.';return;}
  $('catalogStatus').textContent='Loading products…';
  try{const {data,error}=await client.rpc('qc_public_catalog');if(ticket!==generation)return;if(error)throw error;products=data||[];loaded=true;render();}
  catch(error){if(ticket===generation)$('catalogStatus').textContent=['PGRST202','42883'].includes(error.code)?'Catalog setup pending: the app owner needs to apply database/003-public-catalog.sql.':'Could not load products. '+(error.message||'Check your connection and refresh.');}
 }
 async function shops(){const {client}=window.QCCloud?.getContext()||{};if(!client)return;const ticket=generation;$('shopDirectoryStatus').textContent='Loading shops…';try{const {data,error}=await client.rpc('qc_public_shops');if(ticket!==generation)return;if(error)throw error;$('shopDirectory').replaceChildren();for(const shop of data||[]){const card=text($('shopDirectory'),'article','','panel');QCMedia.show(card,client,shop.cover_path,'Shop cover','media-cover');QCMedia.show(card,client,shop.logo_path,shop.name+' logo','media-avatar');text(card,'h3',shop.name);text(card,'p',shop.area);text(card,'p',shop.description);const b=text(card,'button','Search products from '+shop.name,'button secondary');b.type='button';b.addEventListener('click',()=>{$('catalogSearch').value=shop.name;render();$('catalogList').scrollIntoView({block:'start'});});}$('shopDirectoryStatus').textContent=`${(data||[]).length} public shops · up to 200 shown.`;}catch(e){if(ticket===generation)$('shopDirectoryStatus').textContent='Shop directory unavailable. '+(e.message||'Try refreshing.');}}
 $('catalogRefresh').addEventListener('click',()=>{refresh();shops();});$('catalogSearch').addEventListener('input',render);$('catalogInStock').addEventListener('change',render);
 window.addEventListener('qc-auth-changed',()=>{generation++;loaded=false;products=[];render();setTimeout(refresh,0);});
 window.addEventListener('qc-products-changed',refresh);
 document.querySelectorAll('[data-open-section="shop"]').forEach(el=>el.addEventListener('click',refresh));
 window.addEventListener('qc-auth-changed',()=>setTimeout(shops,0));window.addEventListener('qc-merchants-changed',shops);document.querySelectorAll('[data-open-section="shop"]').forEach(el=>el.addEventListener('click',shops));refresh();shops();
})();
