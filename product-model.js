(function(root){
  'use strict';
  function parse(fields,shops){
    const name=String(fields.name||'').trim(),description=String(fields.description||'').trim();
    if(!shops.some(s=>s.id===fields.merchant_id&&s.type==='shop'))throw Error('Select one of your online sports shops.');
    if(!name||name.length>200||description.length>2000)throw Error('Enter a product name (up to 200 characters) and a description up to 2,000 characters.');
    const priceText=String(fields.price).trim();
    if(!/^\d+(\.\d{1,2})?$/.test(priceText))throw Error('Enter a price with no more than two decimal places.');
    const price=Number(priceText),stock=Number(fields.stock);
    if(!Number.isFinite(price)||price<=0||price>100000000)throw Error('Enter a price above zero, up to LKR 100,000,000.');
    if(String(fields.stock).trim()===''||!Number.isInteger(stock)||stock<0||stock>1000000)throw Error('Stock must be a whole number from 0 to 1,000,000.');
    const category=String(fields.category||'Other').trim();if(!['Cricket','Clothing','Footwear','Fitness','Other'].includes(category))throw Error('Choose a product category.');
    return {merchant_id:fields.merchant_id,name,description,category,price,stock,active:fields.active==='true',published:fields.active==='true' && fields.published==='true'};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={parse};else root.QCProductModel={parse};
})(typeof window==='undefined'?globalThis:window);
