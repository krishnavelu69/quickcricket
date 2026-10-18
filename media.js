(()=>{
 'use strict';
 const types=['image/jpeg','image/png','image/webp'];
 function validate(file){if(!types.includes(file.type))throw Error('Choose a JPEG, PNG or WebP photo. Export HEIC photos as JPEG first.');if(!file.size||file.size>5*1024*1024)throw Error('Choose a photo smaller than 5 MB.');}
 function url(client,path){if(!path||! /^[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/.test(path))return '';return client.storage.from('qc-images').getPublicUrl(path).data.publicUrl;}
 function show(parent,client,path,alt,cls='media-photo'){const src=url(client,path);if(!src)return;const img=document.createElement('img');img.src=src;img.alt=alt;img.className=cls;img.loading='lazy';img.onerror=()=>img.remove();parent.append(img);}
 async function upload(client,user,file){
  validate(file);const blobUrl=URL.createObjectURL(file);const img=new Image();
  try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('This photo could not be opened. Try a JPEG image.'));img.src=blobUrl;});
   if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>40000000)throw Error('Photo dimensions are too large. Resize it before uploading.');
   const ratio=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*ratio);canvas.height=Math.round(img.naturalHeight*ratio);const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.85));if(!blob)throw Error('Could not prepare this image.');
   if(window.QCCloud.getContext().user?.id!==user.id)throw Error('Account changed. Sign in and try again.');
   const path=user.id+'/'+crypto.randomUUID()+'.jpg';const {error}=await client.storage.from('qc-images').upload(path,blob,{contentType:'image/jpeg',upsert:false});if(error)throw error;return path;
  }finally{URL.revokeObjectURL(blobUrl);}
 }
 window.QCMedia={upload,url,show,validate};
})();
