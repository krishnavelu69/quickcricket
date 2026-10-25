(function(root){
'use strict';
function roster(text,count){const names=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(names.length!==count)throw Error(`Enter exactly ${count} player names for each side, one per line.`);if(names.some(n=>n.length>60)||new Set(names.map(n=>n.toLowerCase())).size!==count)throw Error('Use distinct names within each team, up to 60 characters each.');return names;}
function create(names,bowlers){return {bat:names.map(name=>({name,runs:0,balls:0,fours:0,sixes:0,out:null})),bowl:bowlers.map(name=>({name,balls:0,runs:0,wickets:0})),striker:null,nonStriker:null,bowler:null,previousBowler:null,extras:{wide:0,noBall:0,bye:0,legBye:0}};}
function select(p,s,n,b){for(const i of [s,n])if(!Number.isInteger(i)||!p.bat[i]||p.bat[i].out||p.bat[i].retired==='hurt')throw Error('Choose two available batters.');if(s===n)throw Error('Striker and non-striker must differ.');if(p.striker!==null&&p.striker!==s||p.nonStriker!==null&&p.nonStriker!==n)throw Error('Existing batters cannot be replaced here. Use Undo to correct the last ball.');if(!Number.isInteger(b)||!p.bowl[b]||p.bowler===null&&(b===p.previousBowler||(p.previousOverBowlers||[]).includes(b)))throw Error('Choose a different bowler for the new over.');if(p.bowler!==null&&p.bowler!==b)throw Error('Change bowlers at the end of an over.');p.striker=s;p.nonStriker=n;p.bowler=b;}
function ready(p){return p.striker!==null&&p.nonStriker!==null&&p.bowler!==null;}
function allowedDismissals(kind='bat',freeHit=false){
 if(freeHit||kind==='noBall')return ['run out','obstructing the field','hit the ball twice'];
 if(kind==='wide')return ['stumped','hit wicket','run out','obstructing the field'];
 return ['bowled','caught','lbw','stumped','hit wicket','run out','obstructing the field','hit the ball twice'];
}
function validateDelivery(runs,opts={},freeHit=false){
 const kind=opts.kind||'bat',illegal=['wide','noBall'].includes(kind);
 if(!['bat','wide','noBall','bye','legBye'].includes(kind)||!Number.isInteger(runs)||runs<0||runs>7)throw Error('Invalid delivery or run count.');
 if(illegal&&(opts.legal!==false||runs<1)||!illegal&&opts.legal===false)throw Error('Check the delivery type and penalty.');
 if(opts.wicket){
  const dismissal=opts.dismissal||'bowled';
  if(!allowedDismissals(kind,freeHit).includes(dismissal))throw Error('That dismissal is not permitted on this delivery. Record the runs without a wicket.');
  if(dismissal!=='run out'&&runs!==(['wide','noBall'].includes(kind)?1:0))throw Error('Only run-outs support completed runs with a wicket.');
 }
}
function record(p,runs,opts,legalBalls){validateDelivery(runs,opts,!!opts.freeHit);if(!ready(p))throw Error('Select the batters and bowler before scoring.');const batter=p.bat[p.striker],bowler=p.bowl[p.bowler],kind=opts.kind||'bat',legal=opts.legal!==false;
 if(!['bat','wide','noBall','bye','legBye'].includes(kind))throw Error('Invalid delivery type.');
 const noBallExtra=kind==='noBall'&&['bye','legBye'].includes(opts.extraKind);
 const batRuns=kind==='bat'?runs:kind==='noBall'&&!noBallExtra?runs-1:0;
 if(kind!=='wide')batter.balls++;
 batter.runs+=batRuns;if(batRuns===4&&!opts.wicket&&opts.boundary!==false)batter.fours++;if(batRuns===6&&!opts.wicket&&opts.boundary!==false)batter.sixes++;
 if(kind!=='bat')p.extras[kind]+=kind==='noBall'?1:runs;
 if(noBallExtra)p.extras[opts.extraKind]+=runs-1;
 if(legal)bowler.balls++;if(!['bye','legBye'].includes(kind))bowler.runs+=noBallExtra?1:runs;
 if(opts.wicket){const slot=opts.dismissedEnd==='nonStriker'?'nonStriker':'striker';p.bat[p[slot]].out=opts.dismissal||'bowled';p.bat[p[slot]].dismissalText=(opts.dismissal||'bowled')+(opts.fielder?' ('+opts.fielder+')':'')+(!['run out','obstructing the field','hit the ball twice'].includes(opts.dismissal)?' b '+bowler.name:'');if(!['run out','obstructing the field','hit the ball twice'].includes(opts.dismissal))bowler.wickets++;p[slot]=null;}
 const crossed=kind==='wide'||kind==='noBall'?runs-1:runs;
 if(crossed%2)[p.striker,p.nonStriker]=[p.nonStriker,p.striker];
 if(opts.wicket&&opts.dismissal==='run out'&&['striker','nonStriker'].includes(opts.survivorEnd)){const survivor=p.striker===null?p.nonStriker:p.striker;p.striker=opts.survivorEnd==='striker'?survivor:null;p.nonStriker=opts.survivorEnd==='nonStriker'?survivor:null;}
 if(legal&&legalBalls%6===0){[p.striker,p.nonStriker]=[p.nonStriker,p.striker];p.previousOverBowlers=[...new Set([...(p.overBowlers||[]),p.bowler])];p.overBowlers=[];p.previousBowler=p.bowler;p.bowler=null;}
}
function extraDelivery(kind,additional,extraKind='bat'){
 if(!['wide','noBall','bye','legBye'].includes(kind))throw Error('Choose an extra type.');
 const penalty=kind==='wide'||kind==='noBall';
 if(typeof additional!=='number'||!Number.isInteger(additional)||additional<(penalty?0:1)||additional>6)throw Error(penalty?'Enter 0–6 additional runs.':'Enter 1–6 runs.');
 if(kind==='noBall'&&!['bat','bye','legBye'].includes(extraKind))throw Error('Choose bat runs, byes or leg byes.');
 const runs=additional+(penalty?1:0),names={bat:'bat runs',bye:'byes',legBye:'leg byes'};
 return {runs,opts:{kind,legal:!penalty,...(kind==='noBall'?{extraKind}:{})},label:kind==='noBall'?`No-ball: 1 penalty + ${additional} ${names[extraKind]}`:kind==='wide'?`Wide: ${runs} total`:`${names[kind]}: ${runs}`};
}
function rate(runs,balls,multiplier){return balls?(runs*multiplier/balls).toFixed(2):'—';}
// Derive completed maidens from saved deliveries, so Undo and older player matches work.
function maidens(inning,index){
 const counts=inning.players.bowl.map(()=>0),groups=new Map(),events=inning.events;
 events.forEach((event,k)=>{
  const before=event.before?.inningsData?.[index],after=k+1<events.length?events[k+1].before?.inningsData?.[index]:inning;
  if(!before?.players||!after?.players)return;
  const bowler=before.players.bowler;if(!Number.isInteger(bowler))return;
  const over=Math.floor(before.legalBalls/6),key=over+':'+bowler;
  let group=groups.get(key);if(!group){group={bowler,legal:0,runs:0,start:before.legalBalls%6};groups.set(key,group);}
  group.legal+=event.legal?1:0;
  group.runs+=after.players.bowl[bowler].runs-before.players.bowl[bowler].runs;
 });
 for(const group of groups.values())if(group.start===0&&group.legal===6&&group.runs===0)counts[group.bowler]++;
 return counts;
}
const api={roster,create,select,ready,record,rate,maidens,extraDelivery,allowedDismissals,validateDelivery};if(typeof module==='object')module.exports=api;else root.QCCricketPlayers=api;
})(globalThis);
