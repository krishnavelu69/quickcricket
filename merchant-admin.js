(()=>{
'use strict';
const $=id=>document.getElementById(id),ctx=()=>window.QCCloud?.getContext()||{};
let generation=0,busy=false;
const panel=document.createElement('section');panel.className='panel';panel.hidden=true;panel.id='merchantAdmin';
panel.innerHTML='<h2>Merchant review · Admin</h2><p>Review private contact and address details before approving. Your decision note is visible to the merchant.</p><label>Status<select id="reviewFilter"><option value="pending">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option><option value="all">All</option></select></label><button id="reviewReload" class="button secondary" type="button">Refresh reviews</button><p id="reviewStatus" role="status"></p><div id="reviewList"></div>';
$('businessPanel').insertBefore(panel,$('businessPanel').children[2]);
function text(host,tag,value){const el=document.createElement(tag);el.textContent=value;host.append(el);return el;}
function lock(){panel.querySelectorAll('button,select,textarea').forEach(el=>el.disabled=busy);}
async function refresh(){
 const ticket=++generation,{client,user}=ctx();panel.hidden=true;$('reviewList').replaceChildren();if(!client||!user)return;
 try{const admin=await client.rpc('qc_is_platform_admin');if(ticket!==generation||ctx().user?.id!==user.id)return;if(admin.error)throw admin.error;if(admin.data!==true)return;panel.hidden=false;$('reviewStatus').textContent='Loading reviews…';
 const result=await client.rpc('qc_admin_merchants',{p_status:$('reviewFilter').value});if(ticket!==generation||ctx().user?.id!==user.id)return;if(result.error)throw result.error;
 for(const row of result.data||[]){const card=text($('reviewList'),'article','');card.className='panel';text(card,'h3',row.name);text(card,'p',row.type+' · '+row.area+' · '+row.status.toUpperCase());QCMedia.show(card,client,row.logo_path,row.name+' logo','media-avatar');text(card,'p','Private contact: '+row.contact);text(card,'p','Private address: '+(row.verification_address||'Missing'));text(card,'p',row.description);text(card,'p','Last updated: '+new Date(row.updated_at).toLocaleString());
 const label=text(card,'label','Decision note (required for rejection or suspension)');const note=document.createElement('textarea');note.maxLength=1000;note.value=row.note||'';label.append(note);
 for(const [status,title] of [['approved','Approve'],['rejected','Reject'],['suspended','Suspend']]){const b=text(card,'button',title);b.type='button';b.className='button secondary';b.addEventListener('click',()=>review(row,status,note.value));}}
 $('reviewStatus').textContent=(result.data||[]).length+' shops shown · maximum 200 per filter.';lock();
 }catch(e){if(ticket===generation){$('reviewStatus').textContent=e.message||'Could not load reviews.';}}
}
async function review(row,status,note){if(busy)return;if(status!=='approved'&&!note.trim()){$('reviewStatus').textContent='Enter a reason for the merchant.';return;}if(!confirm(`${status==='approved'?'Approve':status==='rejected'?'Reject':'Suspend'} ${row.name}?`))return;
 const {client,user}=ctx(),ticket=generation;if(!client||!user)return;busy=true;lock();
 try{const result=await client.rpc('qc_review_merchant',{p_id:row.id,p_revision:row.revision,p_status:status,p_note:note.trim()});if(result.error)throw result.error;if(ticket!==generation||ctx().user?.id!==user.id)return;busy=false;await refresh();window.dispatchEvent(new Event('qc-merchants-changed'));window.dispatchEvent(new Event('qc-products-changed'));window.dispatchEvent(new Event('qc-review-changed'));}
 catch(e){if(ticket===generation)$('reviewStatus').textContent=e.message||'Decision not confirmed. Refresh before retrying.';}finally{busy=false;lock();}
}
$('reviewReload').addEventListener('click',refresh);$('reviewFilter').addEventListener('change',refresh);
window.addEventListener('qc-auth-changed',()=>{generation++;panel.hidden=true;$('reviewList').replaceChildren();setTimeout(refresh,0);});
document.querySelectorAll('[data-open-section="business"]').forEach(b=>b.addEventListener('click',refresh));refresh();
})();
