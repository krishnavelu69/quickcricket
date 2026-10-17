const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create,KEY}=require('../business-store.js');
function memory(){const m=new Map([['quickcricket.match.v1','existing-match']]);return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};}
const shop={id:'s1',name:'Test Shop',area:'Colombo',contact:'test@example.com',type:'shop'};
const product={id:'p1',name:'Bat',area:'Colombo',price:5000,stock:2,businessId:'s1'};
test('businesses and catalog survive reload without touching match data',()=>{const mem=memory();let s=create(mem);s.add('businesses',shop);s.add('products',product);s=create(mem);assert.equal(s.snapshot().products[0].price,5000);assert.equal(mem.getItem('quickcricket.match.v1'),'existing-match');});
test('requires correct owner and prevents orphaned products',()=>{const s=create(memory());assert.throws(()=>s.add('products',product));s.add('businesses',shop);s.add('products',product);assert.throws(()=>s.remove('businesses','s1'));s.remove('products','p1');s.remove('businesses','s1');assert.equal(s.snapshot().businesses.length,0);});
test('invalid restore leaves prior data intact',()=>{const s=create(memory());s.add('businesses',shop);const original=s.snapshot();assert.throws(()=>s.restore({version:7}));assert.deepEqual(s.snapshot(),original);const invalid=s.snapshot();invalid.products.push({...product,price:-10});assert.throws(()=>s.restore(invalid));assert.deepEqual(s.snapshot(),original);});
test('valid backup restores all record types',()=>{const s=create(memory());s.add('businesses',shop);s.add('businesses',{...shop,id:'v1',type:'venue'});s.add('venues',{id:'v2',businessId:'v1',name:'Nets',sport:'Cricket',area:'Colombo',price:2000});s.add('used',{id:'u1',name:'Pads',condition:'Good',contact:'test@example.com',area:'Colombo',price:1000});const other=create(memory());other.restore(s.snapshot());assert.deepEqual(other.snapshot(),s.snapshot());});
test('storage failure does not report an in-memory save',()=>{const s=create({getItem:()=>null,setItem:()=>{throw Error('Quota exceeded');}});assert.throws(()=>s.add('businesses',shop));assert.equal(s.snapshot().businesses.length,0);});
test('corrupted stored records are preserved and rejected',()=>{const mem=memory();mem.setItem(KEY,'broken-json');assert.throws(()=>create(mem));assert.equal(mem.getItem(KEY),'broken-json');});
