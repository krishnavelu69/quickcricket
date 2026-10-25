(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const num=(x,min,max,label)=>{if(!Number.isInteger(x)||x<min||x>max)throw Error(label);return x;};
function insights(s,index=s.currentInnings){
 const inn=s.inningsData[index],left=Math.max(0,s.oversLimit*6-inn.legalBalls),needed=index===1&&s.target!==null?Math.max(0,s.target-inn.runs):null;
 const falls=[],overs=new Map();let lastRuns=0,lastBalls=0;
 inn.events.forEach(e=>{
  if(e.action==='retire'){lastRuns=e.total;lastBalls=e.balls;}
  if(e.wicket){const p=e.before?.inningsData[index]?.players;const slot=e.opts?.dismissedEnd||'striker';const name=e.dismissedName||p?.bat[p?.[slot]]?.name||'Batter not recorded';falls.push(`${e.wickets}: ${name} ${e.total}/${e.wickets} (${Math.floor(e.balls/6)}.${e.balls%6})`);lastRuns=e.total;lastBalls=e.balls;}
  if(!e.action){const before=e.before?.inningsData[index];const over=Math.floor((before?.legalBalls??Math.max(0,e.balls-(e.legal?1:0)))/6)+1;const group=overs.get(over)||{over,runs:0,wickets:0,balls:0};group.runs+=e.runs;group.wickets+=e.wicket?1:0;group.balls+=e.legal?1:0;overs.set(over,group);}
 });
 return {left,needed,rrr:needed===null?null:needed===0?'0.00':left?(needed*6/left).toFixed(2):'—',partnership:{runs:inn.runs-lastRuns,balls:inn.legalBalls-lastBalls},falls,overs:[...overs.values()]};
}
// All administrative changes run on a clone. Invalid input never partially changes a match.
function action(source,type,arg={}){
 const s=clone(source),inn=s.inningsData[s.currentInnings],p=inn.players;let label=type,wicket=false,name=null;
 if(s.finished&&!['details'].includes(type))throw Error('This match is complete. Undo the outcome before changing it.');
 if(type==='details'){
  s.details={};for(const k of ['date','venue','competition','format'])s.details[k]=String(arg[k]||'').trim().slice(0,150);label='Match details updated';
 }else if(type==='pause'){s.paused=String(arg.reason||'Rain interruption').slice(0,200);label=s.paused;}
 else if(type==='resume'){s.paused=null;label='Play resumed';}
 else if(type==='outcome'){if(!['Abandoned','No result'].includes(arg.result))throw Error('Choose an outcome.');s.finished=true;s.result=arg.result;s.outcome=arg.result;s.paused=null;label=arg.result;}
 else if(type==='penalty'){const runs=num(arg.runs,1,10,'Enter 1–10 umpire-awarded penalty runs.');inn.runs+=runs;if(p)p.extras.penalty=(p.extras.penalty||0)+runs;else inn.penalty=(inn.penalty||0)+runs;label=`${runs} penalty runs awarded to batting side: ${String(arg.reason||'Umpire decision').slice(0,150)}`;}
 else if(type==='retire'||type==='return'||type==='timedOut'||type==='preRunout'){
  if(!p)throw Error('Player scoring is required.');const id=num(arg.player,0,p.bat.length-1,'Choose a batter.'),b=p.bat[id];name=b.name;
  if(type==='return'){if(b.retired!=='hurt'||b.out)throw Error('Only a retired-hurt batter can return.');b.retired=null;label=`${name} available to return (umpire approved)`;}
  else if(type==='timedOut'){if((p.striker!==null&&p.nonStriker!==null)||b.out||b.retired||b.balls||id===p.striker||id===p.nonStriker)throw Error('Select an incoming batter who has not batted.');b.out='timed out';b.dismissalText='timed out';inn.wickets++;wicket=true;label=`${name} timed out`;}
  else{const slot=p.striker===id?'striker':p.nonStriker===id?'nonStriker':null;if(!slot)throw Error('Select a batter currently at the crease.');
   if(type==='preRunout'&&slot!=='nonStriker')throw Error('Pre-delivery run-out applies to the non-striker.');
   if(type==='preRunout'||arg.mode==='out'){b.out=type==='preRunout'?'run out':'retired out';b.dismissalText=b.out;inn.wickets++;wicket=true;}else b.retired='hurt';p[slot]=null;label=`${name}: ${b.out||'retired hurt'}`;
  }
 }else if(type==='injuryBowler'){
  if(!p||p.bowler===null)throw Error('Choose the current bowler first.');const next=num(arg.player,0,p.bowl.length-1,'Choose a replacement bowler.');
  if(next===p.bowler||next===p.previousBowler||(p.previousOverBowlers||[]).includes(next)||(p.overBowlers||[]).includes(next))throw Error('Replacement cannot be the current bowler or a bowler from the previous over.');
  p.overBowlers=[...new Set([...(p.overBowlers||[]),p.bowler])];label=`Injury: ${p.bowl[next].name} replaces ${p.bowl[p.bowler].name}`;p.bowler=next;
 }else if(type==='substitute'){
  const incoming=String(arg.name||'').trim(),forPlayer=String(arg.forPlayer||'').trim();if(!incoming||!forPlayer)throw Error('Enter substitute and replaced fielder names.');
  s.substitutes=s.substitutes||[];s.substitutes.push({name:incoming.slice(0,60),forPlayer:forPlayer.slice(0,60),inning:s.currentInnings});label=`Substitute fielder ${incoming} for ${forPlayer}`;
 }else throw Error('Unknown match action.');
 return {state:s,label,wicket,dismissedName:name};
}
function superOver(source){
 if(!source.finished||source.result!=='Match tied')throw Error('A Super Over can start only after a tied match or tied Super Over.');
 if(source.playersLimit<3)throw Error('A Super Over needs at least three players per side.');
 const s=clone(source),archive=clone(source);delete archive.cloudRef;delete archive.redoActions;delete archive.regulation;delete archive.superRounds;
 s.regulation=source.regulation||archive;s.superRounds=[...(source.superRounds||[]),...(source.superOver?[archive]:[])];s.superOver=(source.superOver||0)+1;
 s.teams.reverse();s.rosters?.reverse();s.roles?.reverse();s.teamIds?.reverse();s.playerIds?.reverse();s.oversLimit=1;s.wicketLimit=2;s.target=null;s.finished=false;s.result=null;s.outcome=null;s.paused=null;s.currentInnings=0;s.innings=1;s.redoActions=[];s.inningsData=[{runs:0,wickets:0,legalBalls:0,events:[]}];return s;
}
function standings(t){
 const rows=new Map((t.teams||[]).map(x=>[x.id,{id:x.id,name:x.name,group:x.group||'',played:0,won:0,lost:0,tied:0,nr:0,points:0}]));
 for(const f of t.fixtures||[]){if(!f.result||f.stage==='knockout')continue;const a=rows.get(f.a),b=rows.get(f.b);if(!a||!b)continue;a.played++;b.played++;
  if(f.result==='nr'){a.nr++;b.nr++;a.points++;b.points++;}else if(f.result==='tie'){a.tied++;b.tied++;a.points++;b.points++;}else if([a.id,b.id].includes(f.result)){const w=f.result===a.id?a:b,l=w===a?b:a;w.won++;l.lost++;w.points+=2;}
 }
 return [...rows.values()].sort((a,b)=>a.group.localeCompare(b.group)||b.points-a.points||b.won-a.won||a.name.localeCompare(b.name));
}
function fixtures(teams,stage='group'){
 const result=[];for(let i=0;i<teams.length;i++)for(let j=i+1;j<teams.length;j++)if((teams[i].group||'')===(teams[j].group||''))result.push({id:globalThis.crypto.randomUUID(),a:teams[i].id,b:teams[j].id,stage,date:'',venue:'',result:null});return result;
}
function careers(matches){
 const people=new Map(),seen=new Set();for(const raw of matches){const original=raw.match_data||raw;if(!original||!Array.isArray(original.inningsData))continue;const s=original.regulation||original;if(!Array.isArray(s.inningsData))continue;const key=raw.id||s.matchKey;if(!key||seen.has(key)||!s.finished)continue;seen.add(key);
  s.inningsData.forEach((inn,index)=>{if(!inn.players)return;const ids=s.playerIds?.[index],bowlIds=s.playerIds?.[1-index];
   function get(id,name){if(!id)return null;if(!people.has(id))people.set(id,{id,name,matches:new Set(),runs:0,balls:0,wickets:0,conceded:0,bowlingBalls:0,outs:0});const p=people.get(id);p.matches.add(key);return p;}
   inn.players.bat.forEach((b,j)=>{const p=get(ids?.[j],b.name);if(p){p.runs+=b.runs;p.balls+=b.balls;p.outs+=b.out?1:0;}});
   inn.players.bowl.forEach((b,j)=>{const p=get(bowlIds?.[j],b.name);if(p){p.wickets+=b.wickets;p.conceded+=b.runs;p.bowlingBalls+=b.balls;}});
  });
 }return [...people.values()].map(p=>({...p,matches:p.matches.size}));
}
const api={insights,action,superOver,standings,fixtures,careers};if(typeof module==='object')module.exports=api;else root.QCSportsCore=api;
})(globalThis);
