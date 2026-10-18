(function(root){
'use strict';
const KEY='quickcricket.match.v1',BACKUP=KEY+'.previous';
const integer=(n,min=0,max=100000)=>Number.isInteger(n)&&n>=min&&n<=max;
function valid(s,checkHistory=true){
 if(!s||s.version!==1||!Array.isArray(s.teams)||s.teams.length!==2||!s.teams.every(t=>typeof t==='string'&&t.length>0&&t.length<=100)||!integer(s.oversLimit,1,50)||!integer(s.playersLimit,2,15)||!Array.isArray(s.inningsData)||!integer(s.inningsData.length,1,2)||!integer(s.currentInnings,0,s.inningsData.length-1))return false;
 return s.inningsData.every(i=>{
  if(!i||!integer(i.runs)||!integer(i.wickets,0,s.playersLimit-1)||!integer(i.legalBalls,0,s.oversLimit*6)||!Array.isArray(i.events))return false;
  if(checkHistory&&!i.events.every(e=>{
   const before=e?.before;if(!before||!Array.isArray(before.inningsData)||!before.inningsData.every((frame,j)=>frame&&integer(frame.eventCount,0,s.inningsData[j]?.events.length||0)))return false;
   return valid({...s,...before,inningsData:before.inningsData.map(frame=>({...frame,events:[]}))},false);
  }))return false;
  const p=i.players;if(!p)return true;
  if(!Array.isArray(p.bat)||!Array.isArray(p.bowl)||p.bat.length!==s.playersLimit||p.bowl.length!==s.playersLimit||!p.extras)return false;
  if(!['striker','nonStriker','bowler','previousBowler'].every(k=>p[k]===null||integer(p[k],0,s.playersLimit-1)))return false;
  return p.bat.every(b=>b&&typeof b.name==='string'&&['runs','balls','fours','sixes'].every(k=>integer(b[k])))&&p.bowl.every(b=>b&&typeof b.name==='string'&&['runs','balls','wickets'].every(k=>integer(b[k])))&&['wide','noBall','bye','legBye'].every(k=>integer(p.extras[k]));
 });
}
function parse(raw){try{const s=JSON.parse(raw);return valid(s)?s:null;}catch{return null;}}
function read(storage){
 try{const raw=storage.getItem(KEY),current=parse(raw);if(current)return {state:current,recovered:false};const previous=parse(storage.getItem(BACKUP));return {state:previous,recovered:!!previous,error:raw&&!current?'Current save could not be read.':null};}
 catch{return {state:null,error:'Browser storage is unavailable.'};}
}
function write(storage,state){
 if(!valid(state))return {saved:false,error:'Match data could not be validated.'};
 try{
  const previous=storage.getItem(KEY),next=JSON.stringify(state);let backup=true;
  if(parse(previous)&&previous!==next){try{storage.setItem(BACKUP,previous);}catch{backup=false;}}
  storage.setItem(KEY,next);return {saved:true,backup};
 }catch{return {saved:false,error:'Browser storage is full or unavailable. Download a match backup before closing.'};}
}
const api={KEY,BACKUP,valid,parse,read,write};if(typeof module==='object')module.exports=api;else root.QCMatchStorage=api;
})(globalThis);
