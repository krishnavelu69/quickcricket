(function(root){
'use strict';
function roster(text,count){const names=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(names.length!==count)throw Error(`Enter exactly ${count} player names for each side, one per line.`);if(names.some(n=>n.length>60)||new Set(names.map(n=>n.toLowerCase())).size!==count)throw Error('Use distinct names within each team, up to 60 characters each.');return names;}
function create(names,bowlers){return {bat:names.map(name=>({name,runs:0,balls:0,fours:0,sixes:0,out:null})),bowl:bowlers.map(name=>({name,balls:0,runs:0,wickets:0})),striker:null,nonStriker:null,bowler:null,previousBowler:null,extras:{wide:0,noBall:0,bye:0,legBye:0}};}
function select(p,s,n,b){for(const i of [s,n])if(!Number.isInteger(i)||!p.bat[i]||p.bat[i].out)throw Error('Choose two available batters.');if(s===n)throw Error('Striker and non-striker must differ.');if(p.striker!==null&&p.striker!==s||p.nonStriker!==null&&p.nonStriker!==n)throw Error('Existing batters cannot be replaced here. Use Undo to correct the last ball.');if(!Number.isInteger(b)||!p.bowl[b]||p.bowler===null&&b===p.previousBowler)throw Error('Choose a different bowler for the new over.');if(p.bowler!==null&&p.bowler!==b)throw Error('Change bowlers at the end of an over.');p.striker=s;p.nonStriker=n;p.bowler=b;}
function ready(p){return p.striker!==null&&p.nonStriker!==null&&p.bowler!==null;}
function record(p,runs,opts,legalBalls){if(!ready(p))throw Error('Select the batters and bowler before scoring.');const batter=p.bat[p.striker],bowler=p.bowl[p.bowler],kind=opts.kind||'bat',legal=opts.legal!==false;
 if(!['bat','wide','noBall','bye','legBye'].includes(kind))throw Error('Invalid delivery type.');
 const batRuns=kind==='bat'?runs:kind==='noBall'?runs-1:0;
 if(kind!=='wide')batter.balls++;
 batter.runs+=batRuns;if(batRuns===4)batter.fours++;if(batRuns===6)batter.sixes++;
 if(kind!=='bat')p.extras[kind]+=kind==='noBall'?1:runs;
 if(legal)bowler.balls++;if(!['bye','legBye'].includes(kind))bowler.runs+=runs;
 if(opts.wicket){const slot=opts.dismissedEnd==='nonStriker'?'nonStriker':'striker';p.bat[p[slot]].out=opts.dismissal||'bowled';if(opts.dismissal!=='run out')bowler.wickets++;p[slot]=null;}
 const crossed=kind==='wide'||kind==='noBall'?runs-1:runs;
 if(crossed%2)[p.striker,p.nonStriker]=[p.nonStriker,p.striker];
 if(legal&&legalBalls%6===0){[p.striker,p.nonStriker]=[p.nonStriker,p.striker];p.previousBowler=p.bowler;p.bowler=null;}
}
const api={roster,create,select,ready,record};if(typeof module==='object')module.exports=api;else root.QCCricketPlayers=api;
})(globalThis);
