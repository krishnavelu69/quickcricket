(() => {
  'use strict';
  const $=id=>document.getElementById(id), table='qc_merchant_profiles';
  let revision=0, busy=false, pendingId=null,editing=null;
  const context=()=>window.QCCloud?.getContext() || {};
  const status=message=>$('merchantStatus').textContent=message;
  function lock(value){$('merchantForm').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=value);}
  function message(error){
    if(['42P01','PGRST205','42703','PGRST204'].includes(error.code))return 'Database setup needed: run database/005-profiles-photos.sql in your Supabase SQL Editor, then refresh online profiles.';
    return error.message || 'Could not reach your online account. Check your connection.';
  }
  function text(parent,tag,value,cls){const node=document.createElement(tag);node.textContent=value;if(cls)node.className=cls;parent.append(node);return node;}
  async function refresh(){
    const version=++revision,{client,user}=context();
    $('merchantList').replaceChildren(); lock(true);
    if(!client||!user){status('Sign in under Live Sports to manage your online business profiles.');return;}
    status('Loading your online profiles…');
    try{
      const {data,error}=await client.from(table).select('id,name,type,area,contact,description,logo_path,cover_path').eq('owner_id',user.id).order('created_at',{ascending:false});
      if(version!==revision||context().user?.id!==user.id)return;
      if(error)throw error;
      for(const item of data){const card=document.createElement('article');card.className='panel';text(card,'span','PRIVATE ONLINE PROFILE','eyebrow');QCMedia.show(card,client,item.cover_path,'Business cover','media-cover');QCMedia.show(card,client,item.logo_path,'Business logo','media-avatar');text(card,'h3',item.name);text(card,'p',(item.type==='shop'?'Sports shop':'Venue operator')+' · '+item.area);text(card,'p',item.contact);text(card,'p',item.description);const edit=text(card,'button','Edit business','button secondary');edit.type='button';edit.addEventListener('click',()=>{if(busy)return;editing=item;pendingId=null;$('merchantForm').reset();for(const key of ['name','type','area','contact','description'])$('merchantForm').elements[key].value=item[key]||'';$('merchantSave').textContent='Save changes';$('merchantCancel').hidden=false;$('merchantForm').scrollIntoView({block:'center',behavior:'smooth'});});$('merchantList').append(card);}
      status(`Signed in as ${user.email || 'your account'} · ${data.length} online business profile(s).`);
      lock(busy);
    }catch(error){if(version===revision){status(message(error));lock(true);}}
  }
  function reset(){editing=null;pendingId=null;$('merchantForm').reset();$('merchantSave').textContent='Save online profile';$('merchantCancel').hidden=true;}
  $('merchantCancel').addEventListener('click',reset);
  $('merchantReload').addEventListener('click',refresh);
  window.addEventListener('qc-auth-changed',()=>{revision++;reset();$('merchantList').replaceChildren();lock(true);setTimeout(refresh,0);});
  $('merchantForm').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const {client,user}=context();if(!client||!user)return refresh();
    const fields={};for(const key of ['name','type','area','contact','description'])fields[key]=event.target.elements[key].value.trim();const files={logo_path:event.target.elements.logo.files[0],cover_path:event.target.elements.cover.files[0]};fields.logo_path=editing?.logo_path||null;fields.cover_path=editing?.cover_path||null;const ticket=revision;
    if(!fields.name||!fields.area||!fields.contact){status('Complete all business fields.');return;}
    // Reuse this ID after an uncertain network result to avoid duplicate inserts.
    pendingId ||= crypto.randomUUID();const submittedId=editing?.id||pendingId;
    busy=true;lock(true);status('Saving online profile…');
    try{
      for(const [key,file] of Object.entries(files))if(file)fields[key]=await QCMedia.upload(client,user,file);
      if(ticket!==revision||context().user?.id!==user.id)return;
      const {error}=await client.from(table).upsert({...fields,id:submittedId,owner_id:user.id},{onConflict:'id'});
      if(error)throw error;
      if(context().user?.id!==user.id)return;
      reset();busy=false;await refresh();window.dispatchEvent(new Event('qc-merchants-changed'));window.dispatchEvent(new Event('qc-products-changed'));
    }catch(error){if(context().user?.id===user.id){status('Save was not confirmed. '+message(error));lock(false);}}
    finally{busy=false;lock(!context().user);}
  });
  refresh();
})();
