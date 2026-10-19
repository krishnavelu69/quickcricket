(function(root){
'use strict';
const C=typeof module==='object'?require('./cricket-players.js'):root.QCCricketPlayers;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const overs=balls=>`${Math.floor(balls/6)}.${balls%6}`;
function build(state,generatedAt=new Date().toISOString()){
 if(!state||!Array.isArray(state.teams)||!Array.isArray(state.inningsData))throw Error('Start or load a match first.');
 const label=(team,name)=>name+(state.roles?.[team]?.captain===name?' (c)':'')+(state.roles?.[team]?.keeper===name?' (wk)':'');
 const table=(head,rows)=>`<div class="table-wrap"><table><thead><tr>${head.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((value,i)=>i===0?`<th scope="row">${esc(value)}</th>`:`<td>${esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 const innings=state.inningsData.map((inning,index)=>{
  const p=inning.players,complete=state.finished||index<state.currentInnings;
  let body=`<section><h2>${index+1}${index===0?'st':'nd'} innings · ${esc(state.teams[index])}</h2><p class="total">${esc(inning.runs)}/${esc(inning.wickets)} <span>(${overs(inning.legalBalls)} overs) · ${complete?'Complete':'In progress'}</span></p>`;
  if(p){
   body+=table(['Batter','Dismissal / status','R','B','4','6','SR'],p.bat.map((b,j)=>[label(index,b.name),b.dismissalText||b.out||((j===p.striker||j===p.nonStriker||b.balls)?'not out':(complete?'did not bat':'yet to bat')),b.runs,b.balls,b.fours,b.sixes,C.rate(b.runs,b.balls,100)]));
   const x=p.extras;body+=`<p>Extras <strong>${Object.values(x).reduce((a,b)=>a+b,0)}</strong> (Wd ${x.wide}, Nb ${x.noBall}, B ${x.bye}, Lb ${x.legBye})</p>`;
   const maidens=C.maidens(inning,index);
   body+=`<h3>${esc(state.teams[1-index])} bowling</h3>`+table(['Bowler','O','M','R','W','Econ'],p.bowl.map((b,j)=>[label(1-index,b.name),overs(b.balls),maidens[j],b.runs,b.wickets,C.rate(b.runs,b.balls,6)]));
  }else body+='<p>Player statistics were not recorded for this older match.</p>';
  const wickets=inning.events.filter(e=>e.wicket);body+=`<p class="small">Fall of wickets: ${wickets.length?wickets.map(e=>`${esc(e.total)}/${esc(e.wickets)} (${overs(e.balls)} overs)`).join(' · '):'None'}</p></section>`;
  return body;
 }).join('');
 const title=state.teams.join(' vs '),status=state.finished?(state.result||'Match complete'):'LIVE SNAPSHOT — match in progress';
 const toss=state.toss?`${state.toss.winner} won the toss and elected to ${state.toss.decision}.`:'Toss not recorded.';
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${esc(title)} — QuickCricket scorecard</title><style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17251f;background:#f3f7f4;margin:0;padding:24px;line-height:1.45}main{max-width:960px;margin:auto;background:white;padding:28px;border-radius:16px}header{border-bottom:3px solid #075c3b;padding-bottom:16px}h1{font-size:26px;margin:8px 0}h2{font-size:20px;margin:24px 0 8px}h3{font-size:16px}p{margin:8px 0}.brand{font-weight:bold;letter-spacing:2px;color:#075c3b}.result{font-size:18px;font-weight:bold}.total{font-size:26px;font-weight:bold}.total span{font-size:14px;font-weight:normal}.small{font-size:12px;color:#52635a}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:8px;border-bottom:1px solid #dbe5df;text-align:right;vertical-align:top}th:first-child,td:first-child{text-align:left}thead{background:#eaf3ed}tbody th{font-weight:normal}button{padding:12px 18px;background:#075c3b;color:white;border:0;border-radius:8px;font-size:14px;cursor:pointer}.toolbar{max-width:960px;margin:0 auto 16px}.footer{border-top:1px solid #dbe5df;padding-top:12px;margin-top:24px}section{margin-bottom:28px}@media(max-width:600px){body{padding:8px}main{padding:16px}h1{font-size:22px}th,td{padding:6px}}@page{size:A4;margin:14mm}@media print{body{background:white;padding:0}main{max-width:none;padding:0}.toolbar{display:none}thead{display:table-header-group}tr{break-inside:avoid}h2,h3,.total{break-after:avoid}.table-wrap{overflow:visible}table{font-size:10px}th,td{padding:5px}section{break-inside:auto}}
</style></head><body><div class="toolbar"><button type="button" onclick="window.print()">Print / Save as PDF</button><p class="small">Use your browser's print menu to save a PDF. This is a snapshot; it does not update live.</p></div><main><header><p class="brand">QUICKCRICKET</p><h1>${esc(title)}</h1><p class="result">${esc(status)}</p><p>${esc(state.oversLimit)} overs per innings · ${esc(state.playersLimit)} players per side</p><p>${esc(toss)}</p><p class="small">Free-hit rule: ${state.rules?.freeHit?'enabled':'not enabled'} · Generated ${esc(generatedAt)}</p></header>${innings}${state.inningsData.length===1?'<p>Second innings has not started.</p>':''}<footer class="footer small">SR: strike rate · M: maidens · Econ: runs per over · c: captain · wk: wicketkeeper<br>Scorecard snapshot generated by QuickCricket. Verify against the official scorer's record.</footer></main></body></html>`;
}
const api={build};if(typeof module==='object')module.exports=api;else root.QCScorecardExport=api;
})(globalThis);
