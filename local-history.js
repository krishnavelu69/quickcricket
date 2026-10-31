(()=>{'use strict';const $=id=>document.getElementById(id);let dbPromise;
function db(){return dbPromise||=(new Promise((resolve,reject)=>{if(!window.indexedDB)return reject(Error('Local history is unavailable. Download a match backup before starting another match.'));const r=indexedDB.open('quickcricket-history',1);r.onupgradeneeded=()=>r.result.createObjectStore('matches',{keyPath:'matchKey'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}));}
// Older local saves predate matchKey. Give only the archive copy a stable
// snapshot identity; do not change the active match or its pending cloud queue.
async function archiveCopy(match){
 const copy=JSON.parse(JSON.stringify(match));
 if(typeof copy.matchKey!=='string'||!copy.matchKey.trim()){
  const bytes=new TextEncoder().encode(JSON.stringify(copy));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  copy.matchKey='legacy-'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 }
 return copy;
}
async function keep(match){
 if(!match)return true;
 try{
  const copy=await archiveCopy(match),d=await db();
  await new Promise((resolve,reject)=>{
   const tx=d.transaction('matches','readwrite');
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error||Error('Could not save device history.'));
   tx.onabort=()=>reject(tx.error||Error('Saving device history was interrupted.'));
   tx.objectStore('matches').put(copy);
  });
  return true;
 }catch(e){
  alert('Could not preserve the current match in device history. Your current match has not been replaced. Download a match backup before trying again. '+(e.message||''));
  return false;
 }
}

window.QCArchive={keep};const host=document.createElement('details');host.className='panel';host.innerHTML='<summary>Matches saved on this device</summary><p>Device history is separate from cloud history. Keep downloaded backups for important matches.</p><button id="historyRefresh" class="button secondary">Refresh device history</button><p id="historyStatus" role="status"></p><div id="historyList"></div>';$('liveSection').append(host);
async function refresh(){try{const d=await db(),matches=await new Promise((resolve,reject)=>{const r=d.transaction('matches').objectStore('matches').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});$('historyList').replaceChildren();for(const m of matches.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))){const c=document.createElement('article');c.className='sports-card';const h=document.createElement('h4');h.textContent=m.teams.join(' vs ');const p=document.createElement('p');p.textContent=m.finished?m.result:'In progress';const b=document.createElement('button');b.className='button secondary';b.textContent='Open saved match';b.onclick=()=>window.QCScorer.openLocal(m);c.append(h,p,b);$('historyList').append(c);}$('historyStatus').textContent=matches.length+' matches saved on this device.';}catch(e){$('historyStatus').textContent=e.message;}}
$('historyRefresh').addEventListener('click',refresh);host.addEventListener('toggle',()=>{if(host.open)refresh();});let timer;window.addEventListener('qc-score-render',()=>{const m=window.QCScorer?.read();if(m?.finished&&!new URLSearchParams(location.search).has('match')){clearTimeout(timer);timer=setTimeout(()=>keep(m),500);}});
})();
