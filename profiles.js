(()=>{
 'use strict';const $=id=>document.getElementById(id),form=$('personForm'),context=()=>window.QCCloud?.getContext()||{};
 let generation=0,busy=false,current=null;
 function text(parent,tag,value){const e=document.createElement(tag);e.textContent=value;parent.append(e);return e;}
 function lock(){for(const e of form.elements)e.disabled=busy||!context().user;}
 function error(e){return ['42P01','PGRST205','42703','PGRST204'].includes(e.code)?'Setup needed: run database/005-profiles-photos.sql once.':e.message||'Connection failed.';}
 function card(parent,p,client){const c=text(parent,'article','');c.className='panel';QCMedia.show(c,client,p.cover_path,'Cover photo','media-cover');QCMedia.show(c,client,p.avatar_path,'Profile photo','media-avatar');text(c,'h3',p.display_name);text(c,'p',[p.area,p.sports].filter(Boolean).join(' · '));text(c,'p',p.bio);if(p.id!==context().user?.id)window.QCReports?.add(c,'profile',p.id);}
 async function refresh(){if(busy)return;const ticket=++generation,{client,user}=context();current=null;form.reset();lock();$('personPreview').replaceChildren();$('peopleList').replaceChildren();if(!client)return;
  $('personStatus').textContent=user?'Loading profile…':'Sign in using My account to create your profile.';
  try{const list=await client.from('qc_people').select('*').eq('published',true).order('display_name').limit(100);if(list.error)throw list.error;let own=null;if(user){const r=await client.from('qc_people').select('*').eq('id',user.id).maybeSingle();if(r.error)throw r.error;own=r.data;}
   if(ticket!==generation)return;for(const p of list.data)card($('peopleList'),p,client);$('peopleSearch').dispatchEvent(new Event('input'));$('peopleStatus').textContent=list.data.length+' public profile(s), up to 100 shown.';
   current=own;if(own){for(const key of ['display_name','area','sports','bio'])form.elements[key].value=own[key];form.elements.published.checked=own.published;card($('personPreview'),own,client);}if(user)$('personStatus').textContent=own?'Your profile is ready to edit.':'Create your sports profile.';
  }catch(e){if(ticket===generation)$('personStatus').textContent=error(e);}
 }
 form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const {client,user}=context();if(!user)return;const ticket=generation,values=Object.fromEntries(new FormData(form));const fields={id:user.id,display_name:values.display_name.trim(),area:values.area.trim(),sports:values.sports.trim(),bio:values.bio.trim(),published:form.elements.published.checked,avatar_path:current?.avatar_path||null,cover_path:current?.cover_path||null};if(!fields.display_name){$('personStatus').textContent='Enter your name.';return;}
  const files={avatar_path:form.elements.avatar.files[0],cover_path:form.elements.cover.files[0]};for(const key of ['avatar','cover'])if(form.elements['remove_'+key].checked)fields[key+'_path']=null;
  busy=true;lock();$('personStatus').textContent='Saving profile and photos…';
  try{for(const [key,file]of Object.entries(files))if(file)fields[key]=await QCMedia.upload(client,user,file);if(ticket!==generation)return;const {error:err}=await client.from('qc_people').upsert(fields);if(err)throw err;if(ticket!==generation)return;busy=false;await refresh();$('personStatus').textContent='Profile saved.';}
  catch(err){if(ticket===generation)$('personStatus').textContent=error(err)+' Save not confirmed; refresh before retrying.';}finally{busy=false;lock();}
 });
 $('peopleSearch').addEventListener('input',()=>{const q=$('peopleSearch').value.trim().toLowerCase();for(const card of $('peopleList').children)card.hidden=!card.textContent.toLowerCase().includes(q);});
 $('personReload').addEventListener('click',refresh);document.querySelectorAll('[data-open-section="profile"]').forEach(e=>e.addEventListener('click',refresh));window.addEventListener('qc-auth-changed',()=>{generation++;current=null;form.reset();$('personPreview').replaceChildren();$('peopleList').replaceChildren();lock();setTimeout(refresh,0);});refresh();
})();
