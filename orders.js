(()=>{
 'use strict';
 const $=id=>document.getElementById(id),context=()=>window.QCCloud?.getContext()||{},form=$('orderForm'),dialog=$('orderDialog');
 let generation=0,selection=null,pending=null,payload=null,sending=false,acting=false;
 const money=v=>new Intl.NumberFormat('en-LK',{style:'currency',currency:'LKR'}).format(v);
 const errorText=e=>['42P01','PGRST202','42883'].includes(e.code)?'Requests are unavailable because the server setup needs checking. Report this message; do not rerun the database upgrade.':e.message||'Check your connection and refresh.';
 function add(parent,tag,value,cls){const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;parent.append(el);return el;}
 function clear(){ $('buyerOrders').replaceChildren();$('merchantOrders').replaceChildren(); }
 function render(rows,target,merchant){
  for(const row of rows){const card=add($(target),'article','','panel');add(card,'h3',row.product_name);add(card,'p',row.shop_name+' · '+row.status.toUpperCase());add(card,'p',`${row.quantity} × ${money(row.unit_price)} = ${money(row.total)}`);add(card,'p','Reference: '+row.id);add(card,'p',new Date(row.created_at).toLocaleString());
   if(merchant){add(card,'p',row.customer_name+' · '+row.contact);if(row.note)add(card,'p',row.note);}
   for(const action of QCOrderModel.actions(row.status,merchant)){const btn=add(card,'button',({accepted:'Accept request',rejected:'Reject request',cancelled:'Cancel order',ready:'Mark ready',completed:'Mark completed'})[action],'button secondary');btn.type='button';btn.addEventListener('click',()=>decide(row.id,action));}
  }
 }
 async function refresh(){
  const ticket=++generation,{client,user}=context();clear();
  for(const id of ['ordersStatus','incomingStatus'])$(id).textContent=user?'Loading requests…':'Sign in using My account to see requests.';
  if(!client||!user)return;
  try{
   const [buyer,shops]=await Promise.all([client.from('qc_order_requests').select('*').eq('buyer_id',user.id).order('created_at',{ascending:false}).limit(200),client.from('qc_merchant_profiles').select('id').eq('owner_id',user.id)]);
   if(buyer.error)throw buyer.error;if(shops.error)throw shops.error;
   const ids=shops.data.map(s=>s.id);let incoming={data:[]};if(ids.length)incoming=await client.from('qc_order_requests').select('*').in('merchant_id',ids).order('created_at',{ascending:false}).limit(200);
   if(incoming.error)throw incoming.error;if(ticket!==generation||context().user?.id!==user.id)return;
   render(buyer.data,'buyerOrders',false);render(incoming.data,'merchantOrders',true);
   $('ordersStatus').textContent=buyer.data.length?`${buyer.data.length} request(s) · up to 200 most recent.`:'No requests for this signed-in account. Use the same account you used to submit your request.';$('incomingStatus').textContent=`${incoming.data.length} incoming request(s) · up to 200 most recent.`;
  }catch(e){if(ticket===generation)for(const id of ['ordersStatus','incomingStatus'])$(id).textContent=errorText(e);}
 }
 async function decide(id,action){
  if(acting)return;const {client,user}=context();if(!client||!user)return;
  if(!window.confirm(({accepted:'Accept at the displayed price and deduct stock?',rejected:'Reject this request?',cancelled:'Cancel this order? Stock is restored if it was accepted or ready. Arrange any refund separately.',ready:'Mark this order ready for collection or delivery?',completed:'Confirm this order has been handed to the customer? This does not record payment.'})[action]))return;
  acting=true;const ticket=generation;
  try{const {error}=await client.rpc('qc_decide_order_request',{p_order_id:id,p_action:action});if(error)throw error;if(context().user?.id!==user.id)return;await refresh();window.dispatchEvent(new Event('qc-products-changed'));window.dispatchEvent(new Event('qc-order-stock-changed'));}
  catch(e){if(ticket===generation){$('ordersStatus').textContent=errorText(e);$('incomingStatus').textContent=errorText(e);}}
  finally{acting=false;}
 }
 window.QCOrders={open(product){if(!context().user){$('catalogStatus').textContent='Sign in using My account, then return to request a product.';return;}selection=product;pending=crypto.randomUUID();payload=null;form.reset();$('requestStatus').textContent='';$('orderSummary').textContent=product.name+' · '+product.shop_name+' · '+money(product.price)+' each';dialog.showModal();}};
 $('orderClose').addEventListener('click',()=>{if(!sending)dialog.close();});dialog.addEventListener('cancel',e=>{if(sending)e.preventDefault();});
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(sending||!selection)return;const {client,user}=context();if(!client||!user)return;
  try{const values=QCOrderModel.parse(Object.fromEntries(new FormData(form)));const next={p_request_id:pending,p_product_id:selection.id,p_expected_price:Number(selection.price),p_quantity:values.quantity,p_customer_name:values.customer_name,p_contact:values.contact,p_note:values.note};if(payload&&JSON.stringify(payload)!==JSON.stringify(next))throw Error('For a retry, keep the same details. Check My requests before closing and starting another request.');payload=next;}catch(err){$('requestStatus').textContent=err.message;return;}
  sending=true;for(const el of form.elements)el.disabled=true;$('requestStatus').textContent='Sending request…';
  try{const {data,error}=await client.rpc('qc_create_order_request',payload);if(error)throw error;if(context().user?.id!==user.id)return;dialog.close();$('orderNotice').textContent='Request submitted successfully. Reference: '+data;$('catalogStatus').textContent='Request submitted. Reference: '+data+'. Open My requests to track it.';if(window.QCNavigation)window.QCNavigation.open('orders');else await refresh();}
  catch(err){if(context().user?.id===user.id)$('requestStatus').textContent='Not confirmed. '+errorText(err)+' Retry with the same details, or check My requests before creating another.';}
  finally{sending=false;for(const el of form.elements)el.disabled=false;}
 });
 for(const id of ['ordersReload','incomingReload'])$(id).addEventListener('click',refresh);
 window.addEventListener('qc-section-changed',event=>{if(['orders','business'].includes(event.detail?.section))refresh();});
 window.addEventListener('qc-auth-changed',()=>{generation++;clear();$('orderNotice').textContent='';dialog.close();selection=null;pending=null;payload=null;for(const id of ['ordersStatus','incomingStatus'])$(id).textContent='Checking sign-in…';setTimeout(refresh,0);});
 window.addEventListener('qc-merchants-changed',refresh);refresh();
})();
