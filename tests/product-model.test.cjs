const {test}=require('node:test'),assert=require('node:assert/strict'),{parse}=require('../product-model.js');
const shops=[{id:'mine',type:'shop'},{id:'venue',type:'venue'}];
const base={merchant_id:'mine',name:' Bat ',description:' Training bat ',price:'1250.50',stock:'0',active:'true'};
test('accepts zero stock and normalizes inventory fields',()=>{assert.deepEqual(parse(base,shops),{merchant_id:'mine',name:'Bat',description:'Training bat',price:1250.5,stock:0,active:true,published:false});});
test('rejects another merchant or venue profile',()=>{for(const id of ['other','venue'])assert.throws(()=>parse({...base,merchant_id:id},shops));});
test('rejects invalid money and stock',()=>{for(const price of ['0','-1','1.234','NaN','Infinity'])assert.throws(()=>parse({...base,price},shops));for(const stock of ['','-1','1.5','Infinity'])assert.throws(()=>parse({...base,stock},shops));});
test('supports archiving without deleting the record',()=>{assert.equal(parse({...base,active:'false'},shops).active,false);});

test('publishing is opt-in and archived products cannot stay published',()=>{assert.equal(parse({...base,published:'true'},shops).published,true);assert.equal(parse({...base,published:'true',active:'false'},shops).published,false);});
