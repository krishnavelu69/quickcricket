(function(root){
 'use strict';
 function parse(fields){
  const quantity=Number(fields.quantity),customer_name=String(fields.customer_name||'').trim(),contact=String(fields.contact||'').trim(),note=String(fields.note||'').trim();
  if(!Number.isInteger(quantity)||quantity<1||quantity>1000)throw Error('Choose a whole quantity from 1 to 1000.');
  if(!customer_name||customer_name.length>200||!contact||contact.length>200)throw Error('Enter your name and phone or email (up to 200 characters each).');
  if(note.length>1000)throw Error('Keep notes under 1000 characters.');
  return {quantity,customer_name,contact,note};
 }
 const api={parse};if(typeof module==='object')module.exports=api;else root.QCOrderModel=api;
})(globalThis);
