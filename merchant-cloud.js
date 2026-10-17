(() => {
  'use strict';
  const $=id=>document.getElementById(id), table='qc_merchant_profiles';
  let revision=0, busy=false, pendingId=null;
  const context=()=>window.QCCloud?.getContext() || {};
  const status=message=>$('merchantStatus').textContent=message;
  function lock(value){$('merchantForm').querySelectorAll('input,select,button').forEach(el=>el.disabled=value);}
  function message(error){
    if(['42P01','PGRST205'].includes(error.code))return 'Database setup needed: run database/001-merchant-profiles.sql in your Supabase SQL Editor, then refresh online profiles.';
    return error.message || 'Could not reach your online account. Check your connection.';
  }
  function text(parent,tag,value,cls){const node=document.createElement(tag);node.textContent=value;if(cls)node.className=cls;parent.append(node);return node;}
  async function refresh(){
    const version=++revision,{client,user}=context();
    $('merchantList').replaceChildren(); lock(true);
    if(!client||!user){status('Sign in under Live Sports to manage your online business profiles.');return;}
    status('Loading your online profiles…');
    try{
      const {data,error}=await client.from(table).select('id,name,type,area,contact').eq('owner_id',user.id).order('created_at',{ascending:false});
      if(version!==revision||context().user?.id!==user.id)return;
      if(error)throw error;
      for(const item of data){const card=document.createElement('article');card.className='panel';text(card,'span','PRIVATE ONLINE PROFILE','eyebrow');text(card,'h3',item.name);text(card,'p',(item.type==='shop'?'Sports shop':'Venue operator')+' · '+item.area);text(card,'p',item.contact);$('merchantList').append(card);}
      status(`Signed in as ${user.email || 'your account'} · ${data.length} online business profile(s).`);
      lock(busy);
    }catch(error){if(version===revision){status(message(error));lock(true);}}
  }
  $('merchantReload').addEventListener('click',refresh);
  window.addEventListener('qc-auth-changed',()=>{pendingId=null;$('merchantForm').reset();setTimeout(refresh,0);});
  $('merchantForm').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const {client,user}=context();if(!client||!user)return refresh();
    const fields=Object.fromEntries(new FormData(event.target));Object.keys(fields).forEach(k=>fields[k]=fields[k].trim());
    if(!fields.name||!fields.area||!fields.contact){status('Complete all business fields.');return;}
    // Reuse this ID after an uncertain network result to avoid duplicate inserts.
    pendingId ||= crypto.randomUUID();const submittedId=pendingId;
    busy=true;lock(true);status('Saving online profile…');
    try{
      const {error}=await client.from(table).upsert({...fields,id:submittedId,owner_id:user.id},{onConflict:'id'});
      if(error)throw error;
      if(context().user?.id!==user.id)return;
      pendingId=null;event.target.reset();busy=false;await refresh();window.dispatchEvent(new Event('qc-merchants-changed'));
    }catch(error){if(context().user?.id===user.id){status('Save was not confirmed. '+message(error));lock(false);}}
    finally{busy=false;}
  });
  refresh();
})();
