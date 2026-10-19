(() => {
'use strict';
const $=id=>document.getElementById(id),pageSize=25;
let rows=[],generation=0,offset=0,more=false,busy=false;
const context=()=>window.QCCloud?.getContext()||{};
function render(){
 const query=$('myMatchesSearch').value.trim().toLowerCase(),filter=$('myMatchesFilter').value,list=$('myMatchesList');list.replaceChildren();
 const visible=rows.filter(r=>(`${r.team_a} ${r.team_b}`).toLowerCase().includes(query)&&(filter==='all'||(filter==='finished'?r.status==='finished':r.status!=='finished')));
 for(const row of visible){
  const card=document.createElement('article');card.className='match-list-card';
  const title=document.createElement('h3');title.textContent=`${row.team_a} vs ${row.team_b}`;
  const detail=document.createElement('p');detail.textContent=`${row.status==='finished'?'Finished':'Not finished'} · Innings ${row.current_innings||1} · ${row.score||0}/${row.wickets||0} · ${row.is_public?'Public':'Private'}`;
  const open=document.createElement('button');open.type='button';open.className='button secondary';open.textContent=row.status==='finished'?'Open scorecard':'Open match';open.disabled=busy;
  open.addEventListener('click',async()=>{if(busy)return;busy=true;render();try{await window.QCMatches.open(row.id);}finally{busy=false;render();}});
  card.append(title,detail,open);list.append(card);
 }
 if(!visible.length){const empty=document.createElement('p');empty.textContent=rows.length?'No matches match these filters among the loaded results.':'No saved cloud matches loaded yet. Start a match, then choose Save match to cloud.';list.append(empty);}
 $('myMatchesMore').hidden=!more;$('myMatchesMore').disabled=busy;$('myMatchesRefresh').disabled=busy;
}
async function load(reset=true){
 const {client,user}=context();if(!client||!user){generation++;rows=[];more=false;offset=0;busy=false;render();$('myMatchesStatus').textContent='Sign in to see your saved cloud matches.';return;}
 const token=++generation,owner=user.id;
 if(reset){rows=[];offset=0;more=false;}busy=true;render();$('myMatchesStatus').textContent='Loading your matches…';
 try{
  const {data,error}=await client.from('matches').select('id,team_a,team_b,status,current_innings,score,wickets,is_public').eq('created_by',owner).order('id',{ascending:true}).range(offset,offset+pageSize-1);
  if(token!==generation||context().user?.id!==owner)return;
  if(error)throw error;
  const incoming=data||[];rows=reset?incoming:rows.concat(incoming.filter(r=>!rows.some(old=>old.id===r.id)));offset+=incoming.length;more=incoming.length===pageSize;
  $('myMatchesStatus').textContent=`${rows.length} cloud match${rows.length===1?'':'es'} loaded. Search and filters apply to loaded matches.`;
 }catch(error){if(token===generation)$('myMatchesStatus').textContent='Could not load matches. Check your connection and tap Refresh.';}
 finally{if(token===generation){busy=false;render();}}
}
$('myMatchesRefresh').addEventListener('click',()=>load(true));$('myMatchesMore').addEventListener('click',()=>load(false));
$('myMatchesSearch').addEventListener('input',render);$('myMatchesFilter').addEventListener('change',render);
window.addEventListener('qc-auth-changed',()=>load(true));window.addEventListener('qc-match-saved',()=>load(true));
load(true);
})();
