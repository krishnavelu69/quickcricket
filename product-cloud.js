(() => {
 'use strict';
 const $=id=>document.getElementById(id),form=$('onlineProductForm'),table='qc_merchant_products';
 const context=()=>window.QCCloud?.getContext()||{};
 let generation=0,shops=[],editing=null,pending=null,busy=false,ready=false,photoPath=null,editingRevision=null;
 const status=s=>$('onlineProductStatus').textContent=s;
 function lock(){form.querySelectorAll('input,select,textarea,button').forEach(x=>x.disabled=busy||!ready);$('onlineProductReload').disabled=busy;}
 function reset(){photoPath=null,editingRevision=null;editing=null;pending=null;form.reset();$('onlineProductSave').textContent='Save online product';$('onlineProductCancel').hidden=true;}
 function errorText(e){return ['42P01','PGRST205','42703','PGRST204'].includes(e.code)?'Database setup needed: run database/007-profiles-merchants.sql once, then refresh online products.':e.message||'Connection failed. Try refreshing.';}
 function text(parent,tag,value,cls){const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;parent.append(n);return n;}
 async function refresh(){
  const ticket=++generation,{client,user}=context();ready=false;lock();$('onlineProductList').replaceChildren();shops=[];form.elements.merchant_id.replaceChildren();
  if(!client||!user){status('Sign in using My account to manage your online inventory.');return;}
  status('Loading your online inventory…');
  try{
   const response=await client.from('qc_merchant_profiles').select('id,name,type').eq('owner_id',user.id).eq('type','shop');
   if(ticket!==generation||context().user?.id!==user.id)return;
   if(response.error)throw response.error;if(editing&&!response.data)throw Error('Inventory changed on another device or through an order. Refresh products before editing again.');shops=response.data;
   if(!shops.length){status('Create an online Sports shop profile above, then refresh online products.');return;}
   for(const shop of shops){const option=document.createElement('option');option.value=shop.id;option.textContent=shop.name;form.elements.merchant_id.append(option);}
   const {data,error}=await client.from(table).select('id,merchant_id,name,description,price,stock,active,published,photo_path,inventory_revision,category,blocked').in('merchant_id',shops.map(s=>s.id)).order('created_at',{ascending:false});
   if(ticket!==generation||context().user?.id!==user.id)return;if(error)throw error;
   for(const product of data){
    const card=document.createElement('article');card.className='panel';text(card,'span',!product.active?'ARCHIVED':(product.published?'PUBLISHED':'PRIVATE DRAFT'),'eyebrow');QCMedia.show(card,client,product.photo_path,product.name);text(card,'h3',product.name);if(product.blocked)text(card,'p','Hidden by administrator');text(card,'p',product.category);text(card,'p',shops.find(s=>s.id===product.merchant_id)?.name||'');text(card,'p',new Intl.NumberFormat('en-LK',{style:'currency',currency:'LKR'}).format(product.price),'price');text(card,'p',product.stock+' units in stock');text(card,'p',product.description);
    const edit=text(card,'button','Edit product','button secondary');edit.type='button';edit.addEventListener('click',()=>{if(busy)return;reset();editing=product.id;editingRevision=product.inventory_revision;photoPath=product.photo_path;for(const key of ['merchant_id','name','description','price','stock','active','published','category'])form.elements[key].value=String(product[key]);$('onlineProductSave').textContent='Save changes';$('onlineProductCancel').hidden=false;form.scrollIntoView({behavior:'smooth',block:'center'});});$('onlineProductList').append(card);
   }
   ready=true;lock();status(`${data.length} online product(s). Prices and stock are saved to your account.`);
  }catch(e){if(ticket===generation)status(errorText(e));}
 }
 $('onlineProductReload').addEventListener('click',()=>{reset();refresh();});
 $('onlineProductCancel').addEventListener('click',reset);
 window.addEventListener('qc-auth-changed',()=>{generation++;ready=false;reset();$('onlineProductList').replaceChildren();lock();setTimeout(refresh,0);});
 window.addEventListener('qc-merchants-changed',()=>{reset();refresh();});
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy||!ready)return;
  const {client,user}=context();if(!client||!user)return refresh();
  let fields;try{fields=QCProductModel.parse(Object.fromEntries(new FormData(form)),shops);}catch(error){status(error.message);return;}
  const file=form.elements.photo.files[0];fields.photo_path=form.elements.remove_photo.checked?null:photoPath;const ticket=generation;busy=true;lock();status('Saving online product…');
  try{
   if(file)fields.photo_path=await QCMedia.upload(client,user,file);
   if(ticket!==generation||context().user?.id!==user.id)return;
   let response;
   if(editing)response=await client.from(table).update(fields).eq('id',editing).eq('inventory_revision',editingRevision).select('id').maybeSingle();
   else {pending ||= crypto.randomUUID();response=await client.from(table).upsert({...fields,id:pending},{onConflict:'id',ignoreDuplicates:true}).select('id').maybeSingle();}
   if(response.error)throw response.error;if(editing&&!response.data)throw Error('Inventory changed on another device or through an order. Refresh products before editing again.');
   if(ticket!==generation||context().user?.id!==user.id)return;
   reset();busy=false;await refresh();window.dispatchEvent(new Event('qc-products-changed'));
  }catch(error){if(ticket===generation&&context().user?.id===user.id)status('Save was not confirmed. '+errorText(error));}
  finally{busy=false;lock();}
 });
 window.addEventListener('qc-order-stock-changed',refresh);
 refresh();
})();
