(() => {'use strict';
if(!('serviceWorker' in navigator)||!location.protocol.startsWith('http'))return;
let reloading=false;
navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)location.reload();});
navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
 const offer=()=>{if(!reg.waiting||document.getElementById('updateApp'))return;const b=document.createElement('button');b.id='updateApp';b.type='button';b.className='button primary';b.textContent='App update ready · Reload';b.addEventListener('click',()=>{if(!confirm('Reload to install the update? Saved scores remain on this device. Finish any unsaved forms first.'))return;reloading=true;reg.waiting?.postMessage({type:'SKIP_WAITING'});});document.querySelector('footer').prepend(b);};
 offer();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offer();});});reg.update().catch(()=>{});
}).catch(()=>{});
})();
