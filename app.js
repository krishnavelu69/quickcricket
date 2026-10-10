(() => {
  'use strict';
  const STORAGE_KEY = 'quickcricket.match.v1';
  const $ = (id) => document.getElementById(id);
  let state = null;
  let toastTimer;

  const emptyState = (setup) => ({
    version: 1,
    teams: [setup.teamA, setup.teamB],
    oversLimit: setup.oversLimit,
    playersLimit: setup.playersLimit,
    innings: 1,
    inningsData: [{ runs: 0, wickets: 0, legalBalls: 0, events: [] }],
    currentInnings: 0,
    target: null,
    finished: false,
    result: null,
    updatedAt: new Date().toISOString()
  });
  const inn = () => state.inningsData[state.currentInnings];
  const battingTeam = () => state.teams[state.currentInnings === 0 ? 0 : 1];
  const bowlingTeam = () => state.teams[state.currentInnings === 0 ? 1 : 0];
  const oversText = (balls) => `${Math.floor(balls / 6)}.${balls % 6}`;
  const legalBallLimit = () => state.oversLimit * 6;

  function persist() {
    if (!state) return;
    state.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { showToast('Could not save on this device. Check browser storage.'); }
  }
  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1 && Array.isArray(parsed.inningsData) && parsed.teams?.length === 2) return parsed;
    } catch { /* ignore invalid local save */ }
    return null;
  }
  function showToast(message) {
    const node = $('toast'); node.textContent = message; node.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 2300);
  }
  function start(setup) {
    state = emptyState(setup); persist();
    $('setupPanel').hidden = true; $('matchPanel').hidden = false; render();
  }
  // Store only the data needed to roll back one action. Copying full event
  // histories into every event causes rapidly growing, nested save data.
  function snapshot() {
    return {
      inningsData: state.inningsData.map(item => ({
        runs: item.runs, wickets: item.wickets, legalBalls: item.legalBalls,
        eventCount: item.events.length
      })),
      currentInnings: state.currentInnings,
      innings: state.innings,
      target: state.target,
      finished: state.finished,
      result: state.result
    };
  }
  function restoreSnapshot(before) {
    state.inningsData = before.inningsData.map((saved, index) => {
      const existing = state.inningsData[index];
      return {
        runs: saved.runs,
        wickets: saved.wickets,
        legalBalls: saved.legalBalls,
        events: existing ? existing.events.slice(0, saved.eventCount) : []
      };
    });
    state.currentInnings = before.currentInnings;
    state.innings = before.innings;
    state.target = before.target;
    state.finished = before.finished;
    state.result = before.result;
  }
  function addEvent(label, runs, opts = {}) {
    if (!state || state.finished) { showToast('This match has finished. Start a new match to score again.'); return; }
    const current = inn();
    const before = snapshot();
    current.runs += runs;
    if (opts.wicket) current.wickets += 1;
    if (opts.legal !== false) current.legalBalls += 1;
    current.events.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, label, runs, wicket: !!opts.wicket, legal: opts.legal !== false, total: current.runs, wickets: current.wickets, balls: current.legalBalls, before, at: new Date().toISOString() });
    checkInningsEnd(); persist(); render();
  }
  function checkInningsEnd() {
    const current = inn();
    if (state.currentInnings === 1 && state.target !== null && current.runs >= state.target) {
      state.finished = true;
      const wicketsLeft = Math.max(0, state.playersLimit - 1 - current.wickets);
      state.result = `${battingTeam()} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'}`;
      return;
    }
    if (current.legalBalls >= legalBallLimit() || current.wickets >= state.playersLimit - 1) {
      if (state.currentInnings === 0) {
        state.target = current.runs + 1;
        state.currentInnings = 1;
        state.innings = 2;
        state.inningsData.push({ runs: 0, wickets: 0, legalBalls: 0, events: [] });
      } else {
        const firstTotal = state.target - 1;
        state.finished = true;
        state.result = current.runs === firstTotal ? 'Match tied' : (current.runs > firstTotal ? `${battingTeam()} won` : `${bowlingTeam()} won by ${firstTotal - current.runs} run${firstTotal - current.runs === 1 ? '' : 's'}`);
      }
    }
  }
  function endInnings() {
    if (!state || state.finished) return;
    if (state.currentInnings === 0) {
      state.target = inn().runs + 1; state.currentInnings = 1; state.innings = 2;
      state.inningsData.push({ runs: 0, wickets: 0, legalBalls: 0, events: [] });
      persist(); render(); showToast(`Innings complete. Target: ${state.target}`);
    } else {
      const firstTotal = state.target - 1, current = inn(); state.finished = true;
      state.result = current.runs === firstTotal ? 'Match tied' : (current.runs > firstTotal ? `${battingTeam()} won` : `${bowlingTeam()} won by ${firstTotal - current.runs} runs`);
      persist(); render();
    }
  }
  function undo() {
    if (!state) { showToast('There is no active match.'); return; }
    // The last delivery may have automatically moved the match into innings two.
    // Find the most recent scoring event across both innings, not only the visible innings.
    let event = null;
    for (let i = state.inningsData.length - 1; i >= 0; i--) {
      const events = state.inningsData[i].events;
      if (events.length) { event = events[events.length - 1]; break; }
    }
    if (!event) { showToast('No scoring action is available to undo.'); return; }
    const before = event.before;
    restoreSnapshot(before);
    persist(); render(); showToast('Last scoring action undone.');
  }
  function render() {
    if (!state) return;
    const current = inn();
    $('inningsLabel').textContent = state.currentInnings === 0 ? '1ST INNINGS' : '2ND INNINGS';
    $('battingTeamName').textContent = battingTeam(); $('bowlingTeamDisplay').textContent = `Bowling: ${bowlingTeam()}`;
    $('totalRuns').textContent = current.runs; $('totalWickets').textContent = current.wickets;
    $('oversDisplay').textContent = `${oversText(current.legalBalls)} / ${state.oversLimit} overs`;
    $('runRate').textContent = `CRR ${current.legalBalls ? (current.runs / (current.legalBalls / 6)).toFixed(2) : '0.00'}`;
    $('targetDisplay').textContent = state.target === null ? 'Target: —' : `Target: ${state.target}`;
    $('eventCount').textContent = `${current.events.length} event${current.events.length === 1 ? '' : 's'}`;
    const list = $('eventList'); list.replaceChildren();
    const events = [...current.events].reverse();
    if (!events.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'No balls recorded yet. Tap a score above to begin.'; list.append(empty); }
    events.slice(0, 40).forEach((event, i) => {
      const row = document.createElement('div'); row.className = 'event-item';
      const badge = document.createElement('div'); badge.className = `event-badge${event.wicket ? ' wicket' : ''}`; badge.textContent = event.wicket ? 'WKT' : event.label;
      const main = document.createElement('div'); main.className = 'event-main';
      const title = document.createElement('div'); title.className = 'event-title'; title.textContent = event.label;
      const meta = document.createElement('div'); meta.className = 'event-meta'; meta.textContent = `${event.legal ? 'Legal delivery' : 'Extra delivery'} · ${oversText(event.balls)} overs`;
      main.append(title, meta);
      const total = document.createElement('div'); total.className = 'event-total'; total.textContent = `${event.total}/${event.wickets}`;
      row.append(badge, main, total); list.append(row);
    });
    $('resultBanner').hidden = !state.finished;
    if (state.finished) $('resultBanner').textContent = `🏆 ${state.result}`;
    document.querySelectorAll('#runButtons button, #wideButton, #noBallButton, #byeButton, #legByeButton, #wicketButton, #endInningsButton').forEach(button => button.disabled = state.finished);
    $('undoButton').disabled = !state.inningsData.some(inning => inning.events.length > 0);
    $('connectionStatus').textContent = 'Saved on this device';
  }

  $('setupForm').addEventListener('submit', event => {
    event.preventDefault();
    const teamA = $('teamA').value.trim() || 'Team A', teamB = $('teamB').value.trim() || 'Team B';
    const oversLimit = Number($('oversLimit').value), playersLimit = Number($('playersLimit').value);
    if (teamA.toLowerCase() === teamB.toLowerCase()) { showToast('Please enter two different team names.'); return; }
    if (!Number.isInteger(oversLimit) || oversLimit < 1 || oversLimit > 50) { showToast('Overs must be between 1 and 50.'); return; }
    if (!Number.isInteger(playersLimit) || playersLimit < 2 || playersLimit > 15) { showToast('Players per side must be between 2 and 15.'); return; }
    start({ teamA, teamB, oversLimit, playersLimit });
  });
  $('runButtons').addEventListener('click', event => { const button = event.target.closest('[data-runs]'); if (button) addEvent(`${button.dataset.runs} run${button.dataset.runs === '1' ? '' : 's'}`, Number(button.dataset.runs)); });
  $('wideButton').addEventListener('click', () => {
    const value = prompt('Additional runs from the wide (excluding the 1-run wide penalty)? Enter 0–6.', '0');
    if (value === null) return;
    const extra = Number(value);
    if (Number.isInteger(extra) && extra >= 0 && extra <= 6) {
      addEvent(extra ? `Wide +${1 + extra} total` : 'Wide +1', 1 + extra, { legal: false });
    } else showToast('Enter a whole number from 0 to 6.');
  });
  $('noBallButton').addEventListener('click', () => {
    const value = prompt('Additional runs from the bat (excluding the 1-run no-ball penalty)? Enter 0–6.', '0');
    if (value === null) return;
    const batRuns = Number(value);
    if (Number.isInteger(batRuns) && batRuns >= 0 && batRuns <= 6) {
      addEvent(batRuns ? `No-ball +1 penalty, ${batRuns} bat run${batRuns === 1 ? '' : 's'}` : 'No-ball +1', 1 + batRuns, { legal: false });
    } else showToast('Enter a whole number from 0 to 6.');
  });
  $('byeButton').addEventListener('click', () => { const value = prompt('How many byes? (1–6)', '1'); if (value === null) return; const n = Number(value); if (Number.isInteger(n) && n >= 1 && n <= 6) addEvent(`Bye ${n}`, n); else showToast('Enter a whole number from 1 to 6.'); });
  $('legByeButton').addEventListener('click', () => { const value = prompt('How many leg-byes? (1–6)', '1'); if (value === null) return; const n = Number(value); if (Number.isInteger(n) && n >= 1 && n <= 6) addEvent(`Leg-bye ${n}`, n); else showToast('Enter a whole number from 1 to 6.'); });
  $('wicketButton').addEventListener('click', () => { if (confirm('Record one wicket on a legal ball?')) addEvent('Wicket', 0, { wicket: true }); });
  $('undoButton').addEventListener('click', undo); $('endInningsButton').addEventListener('click', () => { if (confirm('End this innings?')) endInnings(); });
  $('newMatchButton').addEventListener('click', () => { if (confirm('Start a new match? The current saved match on this device will be replaced.')) { localStorage.removeItem(STORAGE_KEY); state = null; $('matchPanel').hidden = true; $('setupPanel').hidden = false; $('resumeRow').hidden = true; } });
  $('resumeButton').addEventListener('click', () => { const saved = loadSaved(); if (!saved) { showToast('No valid saved match found.'); return; } state = saved; $('setupPanel').hidden = true; $('matchPanel').hidden = false; render(); });
  $('editMatchButton').addEventListener('click', () => { $('detailsText').textContent = `${state.teams[0]} vs ${state.teams[1]} · ${state.oversLimit} overs per innings · ${state.playersLimit} players per side.`; $('detailsDialog').showModal(); });
  $('closeDetails').addEventListener('click', () => $('detailsDialog').close());
  window.addEventListener('online', () => { $('connectionStatus').textContent = 'Online · local mode'; });
  window.addEventListener('offline', () => { $('connectionStatus').textContent = 'Offline · local mode'; });
  // Restore the latest match automatically after a refresh.
  const saved = loadSaved();
  if (saved) {
    state = saved;
    $('setupPanel').hidden = true;
    $('matchPanel').hidden = false;
    render();
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
