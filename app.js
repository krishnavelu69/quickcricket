(() => {
  'use strict';
  const STORAGE_KEY = 'quickcricket.match.v1';
  const $ = (id) => document.getElementById(id);

  let state = null;
  let toastTimer;

  // Optional Supabase cloud layer. Local scoring continues to work if cloud is unavailable.
  const CLOUD_CONFIG_KEY = 'quickcricket.supabase.config.v1';
  let supabaseClient = null;
  let signedInUser = null;
  let cloudMatchId = null;
  let cloudIsPublic = false;
  let cloudSyncTimer = null;
  let realtimeChannel = null;
  let spectatorPollTimer = null;
  let spectatorMatchId = null;
  let applyingRemoteState = false;

  // Reuse the existing client/session for merchant records.
  window.QCCloud = { getContext: () => ({client: supabaseClient, user: signedInUser}) };
  function notifyMerchantAuth() { window.dispatchEvent(new Event('qc-auth-changed')); }
  function cloudStatus(message) {
    const node = $('cloudState');
    if (node) node.textContent = message;
  }
  // Public application configuration. Authorization is enforced by Supabase RLS.
  const PUBLIC_CLOUD = Object.freeze({
    url: 'https://uarnciofwvipnafktvzw.supabase.co',
    key: 'sb_publishable_ICqoG0BAOhk-oG-NhXKS4g_igxQblw5',
    siteUrl: 'https://krishnavelu69.github.io/quickcricket/'
  });
  function initCloudConfig() {
    $('supabaseUrl').value = PUBLIC_CLOUD.url;
    $('supabaseKey').value = PUBLIC_CLOUD.key;
    $('cloudSettings').hidden = true;
    cloudStatus('Connecting…');
    connectCloud();
  }
  function getSupabaseLibrary() {
    return window.supabase && typeof window.supabase.createClient === 'function'
      ? window.supabase : null;
  }
  async function connectCloud() {
    const url = $('supabaseUrl').value.trim().replace(/\/+$/, '');
    const key = $('supabaseKey').value.trim();
    if (!url || !/^https:\/\/.+\.supabase\.co$/.test(url) || !key.startsWith('sb_publishable_')) {
      showToast('Enter the Supabase Project URL and sb_publishable_ key.');
      return;
    }
    const library = getSupabaseLibrary();
    if (!library) {
      cloudStatus('Cloud library unavailable');
      showToast('Cloud library could not load. Connect to the internet and refresh.');
      return;
    }
    try {
      supabaseClient = library.createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      // The shared configuration works even on a fresh browser; no setup storage needed.
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      signedInUser = data.session?.user || null;
      notifyMerchantAuth();
      cloudStatus(signedInUser ? 'Connected · signed in' : 'Connected · sign in');
      $('retryCloudButton').hidden = true;
      $('cloudAuthArea').hidden = false;
      $('signOutButton').hidden = !signedInUser;
      $('signUpButton').hidden = !!signedInUser;
      $('signInButton').hidden = !!signedInUser;
      $('authMessage').textContent = signedInUser
        ? `Signed in as ${signedInUser.email || 'your account'}.`
        : 'Sign in or create an account to request products, manage your business and save matches.';
      $('cloudMatchArea').hidden = !signedInUser;
      if (signedInUser) refreshCloudControls();
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        signedInUser = session?.user || null;
        notifyMerchantAuth();
        cloudStatus(signedInUser ? 'Connected · signed in' : 'Connected · sign in');
        $('signOutButton').hidden = !signedInUser;
        $('signUpButton').hidden = !!signedInUser;
        $('signInButton').hidden = !!signedInUser;
        $('authMessage').textContent = signedInUser
          ? `Signed in as ${signedInUser.email || 'your account'}.`
          : 'Sign in or create an account to request products, manage your business and save matches.';
        $('cloudMatchArea').hidden = !signedInUser;
        refreshCloudControls();
      });
      $('cloudSettings').open = false;
      await loadSharedMatchFromUrl();
    } catch (error) {
      supabaseClient = null;
      notifyMerchantAuth();
      $('retryCloudButton').hidden = false;
      cloudStatus('Connection failed');
      showToast(`Supabase connection failed: ${error.message || 'check settings'}`);
    }
  }
  function refreshCloudControls() {
    $('publishMatchButton').hidden = !signedInUser || !cloudMatchId || cloudIsPublic;
    $('shareMatchButton').hidden = !signedInUser || !cloudMatchId || !cloudIsPublic;
    $('saveCloudButton').textContent = cloudMatchId ? 'Sync match to cloud' : 'Save match to cloud';
    $('cloudMatchMessage').textContent = cloudMatchId
      ? `Cloud match ID: ${cloudMatchId}${cloudIsPublic ? ' · Public spectator link enabled' : ' · Private until published'}`
      : 'Save the current match to your cloud account to create a shareable match ID.';
  }
  async function signUp() {
    if (!supabaseClient) return showToast('Connect to Supabase first.');
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    if (!email || password.length < 8) return showToast('Enter an email and a password with at least 8 characters.');
    const { error } = await supabaseClient.auth.signUp({ email, password, options: { emailRedirectTo: PUBLIC_CLOUD.siteUrl } });
    if (error) return showToast(`Sign-up failed: ${error.message}`);
    showToast('Sign-up submitted. Check your email if confirmation is required, then sign in.');
  }
  async function signIn() {
    if (!supabaseClient) return showToast('Connect to Supabase first.');
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return showToast(`Sign-in failed: ${error.message}`);
    signedInUser = data.user;
    $('cloudAuthArea').hidden = false;
    $('cloudMatchArea').hidden = false;
    refreshCloudControls();
    showToast('Signed in successfully.');
  }
  async function signOut() {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signOut();
    if (error) return showToast(`Sign-out failed: ${error.message}`);
    signedInUser = null;
    cloudStatus('Connected · sign in');
    refreshCloudControls();
    showToast('Signed out.');
  }
  function rowFromState() {
    const current = state.inningsData[state.currentInnings];
    return {
      team_a: state.teams[0],
      team_b: state.teams[1],
      status: state.finished ? 'finished' : (state.currentInnings > 0 ? 'live' : 'scheduled'),
      overs_limit: state.oversLimit,
      current_innings: state.currentInnings + 1,
      score: current?.runs || 0,
      wickets: current?.wickets || 0,
      match_data: state
    };
  }
  async function saveMatchToCloud() {
    if (!supabaseClient || !signedInUser) return showToast('Connect and sign in first.');
    if (!state) return showToast('Start or resume a match before saving it to the cloud.');
    const row = { ...rowFromState(), created_by: signedInUser.id };
    try {
      let response;
      if (cloudMatchId) {
        const { data, error } = await supabaseClient.from('matches')
          .update(rowFromState()).eq('id', cloudMatchId).select('id').single();
        response = { data, error };
      } else {
        const { data, error } = await supabaseClient.from('matches')
          .insert(row).select('id').single();
        response = { data, error };
      }
      if (response.error) throw response.error;
      cloudMatchId = response.data.id;
      cloudStatus('Cloud match saved');
      refreshCloudControls();
      showToast('Match saved to Supabase.');
    } catch (error) {
      showToast(`Cloud save failed: ${error.message || 'check RLS policies'}`);
    }
  }
  async function loadExistingCloudMatch() {
    if (!supabaseClient || !signedInUser) return showToast('Connect and sign in first.');
    const id = $('existingCloudMatchId').value.trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) return showToast('Paste the full 36-character cloud match ID.');
    try {
      const { data, error } = await supabaseClient.from('matches')
        .select('id, team_a, team_b, status, overs_limit, current_innings, score, wickets, match_data, is_public')
        .eq('id', id).single();
      if (error) throw error;
      if (!data || !data.match_data) throw new Error('No saved match data was found for that ID.');
      applyCloudRow(data);
      $('existingCloudMatchId').value = data.id;
      cloudStatus(data.is_public ? 'Public cloud match loaded' : 'Private cloud match loaded');
      showToast('Existing cloud match loaded. Scoring will now sync to this match ID.');
    } catch (error) {
      showToast(`Could not load that match: ${error.message || 'check the ID and account permissions'}`);
    }
  }

  async function publishMatch() {
    if (!supabaseClient || !signedInUser || !cloudMatchId) return;
    try {
      const { error } = await supabaseClient.from('matches')
        .update({ is_public: true }).eq('id', cloudMatchId);
      if (error) throw error;
      cloudIsPublic = true;
      refreshCloudControls();
      showToast('Match is public. You can copy the spectator link.');
    } catch (error) {
      showToast(`Could not publish match: ${error.message || 'check RLS policies'}`);
    }
  }
  async function copySpectatorLink() {
    if (!cloudMatchId || !cloudIsPublic) return;
    const url = new URL(PUBLIC_CLOUD.siteUrl);
    url.search = '';
    url.hash = '';
    url.searchParams.set('match', cloudMatchId);
    try {
      await navigator.clipboard.writeText(url.toString());
      showToast('Spectator link copied.');
    } catch {
      prompt('Copy this spectator link:', url.toString());
    }
  }
  function applyCloudRow(row) {
    if (!row || !row.match_data || !Array.isArray(row.match_data.inningsData)) return;
    // Treat the scalar columns as authoritative for the currently displayed innings.
    // This protects the spectator scoreboard if an older client wrote stale nested JSON.
    const remoteState = JSON.parse(JSON.stringify(row.match_data));
    const inningIndex = Math.max(0, Math.min(remoteState.inningsData.length - 1, Number(row.current_innings || 1) - 1));
    const current = remoteState.inningsData[inningIndex];
    if (current) {
      if (Number.isFinite(Number(row.score))) current.runs = Number(row.score);
      if (Number.isFinite(Number(row.wickets))) current.wickets = Number(row.wickets);
    }
    if (Array.isArray(remoteState.teams)) {
      if (row.team_a) remoteState.teams[0] = row.team_a;
      if (row.team_b) remoteState.teams[1] = row.team_b;
    }
    if (Number.isFinite(Number(row.overs_limit)) && Number(row.overs_limit) > 0) remoteState.oversLimit = Number(row.overs_limit);
    applyingRemoteState = true;
    state = remoteState;
    cloudMatchId = row.id;
    cloudIsPublic = !!row.is_public;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    $('setupPanel').hidden = true;
    $('matchPanel').hidden = false;
    render();
    applyingRemoteState = false;
    refreshCloudControls();
  }
  async function refreshSpectatorMatch(id) {
    if (!supabaseClient || !id) return;
    try {
      const { data, error } = await supabaseClient.from('matches')
        .select('id, team_a, team_b, status, overs_limit, current_innings, score, wickets, match_data, is_public')
        .eq('id', id).eq('is_public', true).single();
      if (error) throw error;
      if (data) applyCloudRow(data);
    } catch (error) {
      console.warn('QuickCricket spectator refresh failed:', error.message || error);
      cloudStatus('Spectator refresh needs attention');
    }
  }
  function startSpectatorPolling(id) {
    spectatorMatchId = id;
    if (spectatorPollTimer) clearInterval(spectatorPollTimer);
    // Polling keeps spectators current even when a browser/network blocks WebSockets.
    spectatorPollTimer = setInterval(() => refreshSpectatorMatch(spectatorMatchId), 5000);
  }
  async function loadSharedMatchFromUrl() {
    if (!supabaseClient) return;
    const id = new URLSearchParams(window.location.search).get('match');
    if (!id) return;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      showToast('That match link does not contain a valid match ID.');
      return;
    }
    try {
      const { data, error } = await supabaseClient.from('matches')
        .select('id, team_a, team_b, status, overs_limit, current_innings, score, wickets, match_data, is_public')
        .eq('id', id).eq('is_public', true).single();
      if (error) throw error;
      if (!data?.match_data) throw new Error('No match data was found.');
      cloudMatchId = data.id;
      cloudIsPublic = !!data.is_public;
      applyCloudRow(data);
      cloudStatus('Viewing shared match');
      if (realtimeChannel) await supabaseClient.removeChannel(realtimeChannel);
      realtimeChannel = supabaseClient.channel(`public-match-${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` }, payload => {
          if (payload.new?.is_public && payload.new?.match_data) {
            applyCloudRow(payload.new);
            cloudStatus('Live spectator view · realtime');
          }
        }).subscribe(status => {
          if (status === 'SUBSCRIBED') cloudStatus('Live spectator view · realtime connected');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            cloudStatus('Live view · checking for updates');
            console.warn('QuickCricket Realtime status:', status);
          }
        });
      startSpectatorPolling(id);
      $('cloudSettings').open = false;
      $('cloudMatchArea').hidden = true;
      $('cloudAuthArea').hidden = true;
      showToast('Shared match loaded. Live updates are enabled when available.');
    } catch (error) {
      showToast(`Could not load shared match: ${error.message || 'check link and policies'}`);
    }
  }
  async function syncCloudMatch() {
    if (!supabaseClient || !signedInUser || !cloudMatchId || !state || applyingRemoteState || !navigator.onLine) return;
    try {
      const { error } = await supabaseClient.from('matches').update(rowFromState()).eq('id', cloudMatchId);
      if (error) throw error;
      cloudStatus(cloudIsPublic ? 'Live score synced' : 'Cloud score synced');
    } catch (error) {
      cloudStatus('Cloud sync needs attention');
      // Avoid a toast on every ball; retain local score if network is unavailable.
      console.warn('QuickCricket cloud sync failed:', error.message);
    }
  }
  function scheduleCloudSync() {
    if (!cloudMatchId || !signedInUser || applyingRemoteState) return;
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(syncCloudMatch, 500);
  }

  const emptyState = (setup) => ({
    version: 1,
    teams: [setup.teamA, setup.teamB],
    rosters: setup.rosters || null,
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
    scheduleCloudSync();
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
    state = emptyState(setup); if(state.rosters)inn().players=QCCricketPlayers.create(...state.rosters); persist();
    $('setupPanel').hidden = true; $('matchPanel').hidden = false; render();
  }
  // Store only the data needed to roll back one action. Copying full event
  // histories into every event causes rapidly growing, nested save data.
  function snapshot() {
    return {
      inningsData: state.inningsData.map(item => ({
        runs: item.runs, wickets: item.wickets, legalBalls: item.legalBalls,
        eventCount: item.events.length, players: item.players ? JSON.parse(JSON.stringify(item.players)) : null
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
        events: existing ? existing.events.slice(0, saved.eventCount) : [],
        players: saved.players ? JSON.parse(JSON.stringify(saved.players)) : null
      };
    });
    state.currentInnings = before.currentInnings;
    state.innings = before.innings;
    state.target = before.target;
    state.finished = before.finished;
    state.result = before.result;
  }
  function addEvent(label, runs, opts = {}) {
    if(new URLSearchParams(location.search).has("match"))return;
    if (!state || state.finished) { showToast('This match has finished. Start a new match to score again.'); return; }
    const current = inn();
    if(current.players&&!QCCricketPlayers.ready(current.players)){showToast("Choose batters and bowler first.");return;}
    const before = snapshot();
    current.runs += runs;
    if (opts.wicket) current.wickets += 1;
    if (opts.legal !== false) current.legalBalls += 1;
    if(current.players)QCCricketPlayers.record(current.players,runs,opts,current.legalBalls);
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
        state.inningsData.push({ runs: 0, wickets: 0, legalBalls: 0, events: [], players: state.rosters ? QCCricketPlayers.create(state.rosters[1],state.rosters[0]) : null });
      } else {
        const firstTotal = state.target - 1;
        state.finished = true;
        state.result = current.runs === firstTotal ? 'Match tied' : (current.runs > firstTotal ? `${battingTeam()} won` : `${bowlingTeam()} won by ${firstTotal - current.runs} run${firstTotal - current.runs === 1 ? '' : 's'}`);
      }
    }
  }
  function endInnings() {
    if(new URLSearchParams(location.search).has("match"))return;
    if (!state || state.finished) return;
    if (state.currentInnings === 0) {
      state.target = inn().runs + 1; state.currentInnings = 1; state.innings = 2;
      state.inningsData.push({ runs: 0, wickets: 0, legalBalls: 0, events: [], players: state.rosters ? QCCricketPlayers.create(state.rosters[1],state.rosters[0]) : null });
      persist(); render(); showToast(`Innings complete. Target: ${state.target}`);
    } else {
      const firstTotal = state.target - 1, current = inn(); state.finished = true;
      state.result = current.runs === firstTotal ? 'Match tied' : (current.runs > firstTotal ? `${battingTeam()} won` : `${bowlingTeam()} won by ${firstTotal - current.runs} runs`);
      persist(); render();
    }
  }
  function undo() {
    if(new URLSearchParams(location.search).has("match"))return;
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

  function renderPlayers(){
    const section=$('playerPanel'),p=inn().players;section.hidden=!p;$('legacyScoringNote').hidden=!!p;if(!p)return;
    const spectator=new URLSearchParams(location.search).has('match');
    for(const [id,items,chosen]of [['strikerSelect',p.bat,p.striker],['nonStrikerSelect',p.bat,p.nonStriker],['bowlerSelect',p.bowl,p.bowler]]){
      const select=$(id);select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose player';select.append(placeholder);
      items.forEach((item,i)=>{if(item.out)return;const option=document.createElement('option');option.value=i;option.textContent=item.name;select.append(option);});select.value=chosen===null?'':String(chosen);select.disabled=chosen!==null||state.finished||spectator;
    }
    $('confirmPlayers').disabled=state.finished||spectator||QCCricketPlayers.ready(p);
    $('playerStatus').textContent=state.finished?'Match complete.':QCCricketPlayers.ready(p)?`${p.bat[p.striker].name} on strike · ${p.bowl[p.bowler].name} bowling`:'Select openers / incoming batter and bowler, then confirm. A bowler cannot bowl consecutive overs.';
    const area=$('playerScorecards');area.replaceChildren();
    function table(title,headers,rows){const heading=document.createElement('h3');heading.textContent=title;area.append(heading);const wrap=document.createElement('div');wrap.className='scorecard-scroll';const t=document.createElement('table');t.className='player-table';const head=document.createElement('tr');for(const h of headers){const cell=document.createElement('th');cell.textContent=h;head.append(cell);}t.append(head);for(const row of rows){const tr=document.createElement('tr');for(const value of row){const td=document.createElement('td');td.textContent=value;tr.append(td);}t.append(tr);}wrap.append(t);area.append(wrap);}
    state.inningsData.forEach((inning,i)=>{if(!inning.players)return;const q=inning.players;table(state.teams[i]+' batting',['Batter','R','B','4','6','Status'],q.bat.map((b,j)=>[b.name+(j===q.striker?' *':''),b.runs,b.balls,b.fours,b.sixes,b.out||((j===q.striker||j===q.nonStriker||b.balls)?'not out':'yet to bat')]));table(state.teams[1-i]+' bowling',['Bowler','O','R','W'],q.bowl.map(b=>[b.name,oversText(b.balls),b.runs,b.wickets]));const extras=document.createElement('p');extras.textContent=`Extras: Wd ${q.extras.wide}, Nb ${q.extras.noBall}, B ${q.extras.bye}, Lb ${q.extras.legBye}`;area.append(extras);});
  }
  $('confirmPlayers').addEventListener('click',()=>{if(!state||state.finished||new URLSearchParams(location.search).has('match'))return;try{const ids=['strikerSelect','nonStrikerSelect','bowlerSelect'].map(id=>$(id).value===''?null:Number($(id).value));QCCricketPlayers.select(inn().players,...ids);persist();render();}catch(error){showToast(error.message);}});

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
    document.querySelectorAll('#runButtons button, #wideButton, #noBallButton, #byeButton, #legByeButton, #wicketButton, #endInningsButton').forEach(button => button.disabled = state.finished || new URLSearchParams(location.search).has("match"));
    $('undoButton').disabled = new URLSearchParams(location.search).has('match') || !state.inningsData.some(inning => inning.events.length > 0);
    renderPlayers();
    $('connectionStatus').textContent = 'Saved on this device';
  }

  $('setupForm').addEventListener('submit', event => {
    event.preventDefault();
    const teamA = $('teamA').value.trim() || 'Team A', teamB = $('teamB').value.trim() || 'Team B';
    const oversLimit = Number($('oversLimit').value), playersLimit = Number($('playersLimit').value);
    if (teamA.toLowerCase() === teamB.toLowerCase()) { showToast('Please enter two different team names.'); return; }
    if (!Number.isInteger(oversLimit) || oversLimit < 1 || oversLimit > 50) { showToast('Overs must be between 1 and 50.'); return; }
    if (!Number.isInteger(playersLimit) || playersLimit < 2 || playersLimit > 15) { showToast('Players per side must be between 2 and 15.'); return; }
    let rosters;try{rosters=[QCCricketPlayers.roster($('teamAPlayers').value,playersLimit),QCCricketPlayers.roster($('teamBPlayers').value,playersLimit)];}catch(error){showToast(error.message);return;}
    start({ teamA, teamB, oversLimit, playersLimit, rosters });
  });
  $('runButtons').addEventListener('click', event => { const button = event.target.closest('[data-runs]'); if (button) addEvent(`${button.dataset.runs} run${button.dataset.runs === '1' ? '' : 's'}`, Number(button.dataset.runs)); });
  $('wideButton').addEventListener('click', () => {
    const value = prompt('Additional runs from the wide (excluding the 1-run wide penalty)? Enter 0–6.', '0');
    if (value === null) return;
    const extra = Number(value);
    if (Number.isInteger(extra) && extra >= 0 && extra <= 6) {
      addEvent(extra ? `Wide +${1 + extra} total` : 'Wide +1', 1 + extra, { legal: false, kind: 'wide' });
    } else showToast('Enter a whole number from 0 to 6.');
  });
  $('noBallButton').addEventListener('click', () => {
    const value = prompt('Additional runs from the bat (excluding the 1-run no-ball penalty)? Enter 0–6.', '0');
    if (value === null) return;
    const batRuns = Number(value);
    if (Number.isInteger(batRuns) && batRuns >= 0 && batRuns <= 6) {
      addEvent(batRuns ? `No-ball +1 penalty, ${batRuns} bat run${batRuns === 1 ? '' : 's'}` : 'No-ball +1', 1 + batRuns, { legal: false, kind: 'noBall' });
    } else showToast('Enter a whole number from 0 to 6.');
  });
  $('byeButton').addEventListener('click', () => { const value = prompt('How many byes? (1–6)', '1'); if (value === null) return; const n = Number(value); if (Number.isInteger(n) && n >= 1 && n <= 6) addEvent(`Bye ${n}`, n, {kind:'bye'}); else showToast('Enter a whole number from 1 to 6.'); });
  $('legByeButton').addEventListener('click', () => { const value = prompt('How many leg-byes? (1–6)', '1'); if (value === null) return; const n = Number(value); if (Number.isInteger(n) && n >= 1 && n <= 6) addEvent(`Leg-bye ${n}`, n, {kind:'legBye'}); else showToast('Enter a whole number from 1 to 6.'); });
  $('wicketButton').addEventListener('click', () => { if(!state||state.finished)return;const choices=['bowled','caught','lbw','stumped','hit wicket','run out'];const answer=prompt('Wicket on a LEGAL ball with ZERO runs. Enter: 1 bowled, 2 caught, 3 LBW, 4 stumped, 5 hit wicket, 6 run out. Other situations are not supported yet.','1');if(answer===null)return;const dismissal=choices[Number(answer)-1];if(!dismissal){showToast('Choose 1–6.');return;}let dismissedEnd='striker';if(dismissal==='run out'){const end=prompt('Who was run out? Enter 1 for striker or 2 for non-striker.','1');if(end===null)return;if(!['1','2'].includes(end)){showToast('Choose 1 or 2.');return;}dismissedEnd=end==='2'?'nonStriker':'striker';}addEvent(dismissal,0,{wicket:true,dismissal,dismissedEnd}); });
  $('undoButton').addEventListener('click', undo); $('endInningsButton').addEventListener('click', () => { if (confirm('End this innings?')) endInnings(); });
  $('newMatchButton').addEventListener('click', () => { if (confirm('Start a new match? The current saved match on this device will be replaced.')) { localStorage.removeItem(STORAGE_KEY); state = null; $('matchPanel').hidden = true; $('setupPanel').hidden = false; $('resumeRow').hidden = true; } });
  $('resumeButton').addEventListener('click', () => { const saved = loadSaved(); if (!saved) { showToast('No valid saved match found.'); return; } state = saved; $('setupPanel').hidden = true; $('matchPanel').hidden = false; render(); });
  $('editMatchButton').addEventListener('click', () => { $('detailsText').textContent = `${state.teams[0]} vs ${state.teams[1]} · ${state.oversLimit} overs per innings · ${state.playersLimit} players per side.`; $('detailsDialog').showModal(); });
  $('closeDetails').addEventListener('click', () => $('detailsDialog').close());
  window.addEventListener('online', () => { $('connectionStatus').textContent = 'Online · local mode'; });
  window.addEventListener('offline', () => { $('connectionStatus').textContent = 'Offline · local mode'; });

  // Cloud beta controls. These are optional; local scoring does not depend on them.
  $('connectCloudButton').addEventListener('click', connectCloud);
  $('retryCloudButton').addEventListener('click', () => location.reload());
  $('signUpButton').addEventListener('click', signUp);
  $('signInButton').addEventListener('click', signIn);
  $('signOutButton').addEventListener('click', signOut);
  $('saveCloudButton').addEventListener('click', saveMatchToCloud);
  $('loadCloudMatchButton').addEventListener('click', loadExistingCloudMatch);
  $('publishMatchButton').addEventListener('click', publishMatch);
  $('shareMatchButton').addEventListener('click', copySpectatorLink);

  // Restore saved cloud configuration when the Supabase library is available.
  if (getSupabaseLibrary()) initCloudConfig();
  else {
    cloudStatus('Cloud library loading…');
    window.addEventListener('load', () => {
      if (getSupabaseLibrary()) initCloudConfig();
      else cloudStatus('Cloud library unavailable');
    }, { once: true });
  }

  // Restore the latest match automatically after a refresh.
  const saved = loadSaved();
  if (saved) {
    state = saved;
    $('setupPanel').hidden = true;
    $('matchPanel').hidden = false;
    render();
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => registration.update()).catch(() => {});


})();
