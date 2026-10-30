(function(root){'use strict';
const PREFIX='quickcricket.pending.v1.';
function key(match){return PREFIX+match.matchKey;}
function read(storage,match,user){const raw=storage.getItem(key(match));if(!raw)return null;const q=JSON.parse(raw);if(q.user!==user)throw Error('This match has an unsynced save from another account. Sign in with that account.');if(!q.request||!q.payload||q.payload.matchKey!==match.matchKey)throw Error('Pending save is unreadable. Download a backup before continuing.');return q;}
function prepare(storage,match,user,id,token){const old=read(storage,match,user);if(old)return old;const payload=JSON.parse(JSON.stringify(match));delete payload.cloudRef;const q={request:crypto.randomUUID(),user,id,token,expected:match.cloudRef?.revision||0,revision:match.localRevision||0,payload};storage.setItem(key(match),JSON.stringify(q));return q;}
function clear(storage,match,request){const raw=storage.getItem(key(match));if(raw&&JSON.parse(raw).request===request)storage.removeItem(key(match));}
function pending(storage,match){try{return !!match&&!!storage.getItem(key(match));}catch{return false;}}
const api={read,prepare,clear,pending};if(typeof module==='object')module.exports=api;else root.QCSyncQueue=api;
})(globalThis);
