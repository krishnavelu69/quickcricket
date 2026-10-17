const test=require('node:test'),assert=require('node:assert/strict'),{parse}=require('../order-model.js');
const base={quantity:'2',customer_name:' Buyer ',contact:' 0771234567 ',note:' Note '};
test('request normalizes contact and quantity',()=>assert.deepEqual(parse(base),{quantity:2,customer_name:'Buyer',contact:'0771234567',note:'Note'}));
test('rejects invalid and oversized quantities',()=>{for(const quantity of ['',0,-1,1.5,1001,'abc',Infinity])assert.throws(()=>parse({...base,quantity}));});
test('requires contact and name',()=>{for(const key of ['customer_name','contact'])for(const value of [' ', 'a'.repeat(201)])assert.throws(()=>parse({...base,[key]:value}));});
test('limits notes',()=>assert.throws(()=>parse({...base,note:'x'.repeat(1001)})));
