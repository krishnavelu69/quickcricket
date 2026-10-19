(() => {
  'use strict';
  const STORAGE_KEY = 'quickcricket.match.v1';
  const $ = (id) => document.getElementById(id);

  let state = null;
  let toastTimer;
  let localSaveMessage="On this device";
  let storageConflict=false;
  const isSpectator=()=>new URLSearchParams(location.search).has("match");

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
  let cloudWritePromise=null;

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
      $('cloudMatchArea').hidden = !signedInUser||isSpectator();
      if (signedInUser) {refreshCloudControls();scheduleCloudSync();}
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
        $('cloudMatchArea').hidden = !signedInUser||isSpectator();
        refreshCloudControls();
        if(signedInUser)scheduleCloudSync();
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
    if(isSpectator()){$('cloudMatchArea').hidden=true;return;}
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
    if(!canEdit())return;
    if(!supabaseClient||!signedInUser)return showToast('Connect and sign in first.');
    if(!state)return showToast('Start or resume a match first.');
    if(cloudWritePromise)return showToast('A cloud save is already running.');
    await syncCloudMatch(true);
  }
  window.QCMatches={open:loadExistingCloudMatch};
  async function loadExistingCloudMatch(requestedId) {
    if (!supabaseClient || !signedInUser) return showToast('Connect and sign in first.');
    if(!canEdit())return;
    if(cloudWritePromise)return showToast('A cloud save is running. Please wait before opening another match.');
    const id=typeof requestedId==='string'?requestedId:$('existingCloudMatchId').value.trim();
    if(state&&cloudMatchId===id)return showToast('This match is already open below.');
    if(state&&!confirm('Load this cloud match? Download the current match first if you need to keep it.'))return;
    const originalState=state,originalRevision=state?.localRevision,owner=signedInUser.id;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return showToast('Paste the full 36-character cloud match ID.');
    try {
      const { data, error } = await supabaseClient.from('matches')
        .select('id, team_a, team_b, status, overs_limit, current_innings, score, wickets, match_data, is_public')
        .eq('id', id).eq('created_by', signedInUser.id).single();
      if (error) throw error;
      if(state!==originalState||state?.localRevision!==originalRevision||signedInUser?.id!==owner)return showToast('The active match or account changed. Open the selected match again.');
      if (!data || !data.match_data) throw new Error('No saved match data was found for that ID.');
      clearTimeout(cloudSyncTimer);
      applyCloudRow(data);
      $('existingCloudMatchId').value = data.id;
      cloudStatus(data.is_public ? 'Public cloud match loaded' : 'Private cloud match loaded');
      showToast('Existing cloud match loaded. Scoring will now sync to this match ID.');
    } catch (error) {
      showToast(`Could not load that match: ${error.message || 'check the ID and account permissions'}`);
    }
  }

  async function publishMatch() {
    if (!canEdit() || !supabaseClient || !signedInUser || !cloudMatchId || state?.cloudRef?.owner!==signedInUser.id) return;
    try {
      const { error } = await supabaseClient.from('matches')
        .update({ is_public: true }).eq('id', cloudMatchId).select('id').single();
      if (error) throw error;
      cloudIsPublic = true;
      state.cloudRef={...state.cloudRef,isPublic:true};saveLocal();
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
    if (!row || !QCMatchStorage.valid(row.match_data)) throw Error('Saved cloud match has invalid data.');
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
    if(!isSpectator()){state.cloudRef={id:row.id,isPublic:!!row.is_public,owner:signedInUser?.id};saveLocal();}
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
  async function syncCloudMatch(manual=false) {
    if(isSpectator()||storageConflict||cloudWritePromise||!supabaseClient||!signedInUser||!state||applyingRemoteState)return;
    if(!navigator.onLine){cloudStatus('Offline · cloud sync pending');return;}
    if(!cloudMatchId&&!manual)return;
    if(cloudMatchId&&state.cloudRef?.owner!==signedInUser.id){cloudStatus('Sign in with the match owner account to sync');return;}
    const target=state,id=cloudMatchId,owner=signedInUser.id,revision=state.localRevision||0,payload=JSON.parse(JSON.stringify(rowFromState()));
    cloudStatus('Saving match to cloud…');
    cloudWritePromise=(async()=>{
      try{
        const query=id?supabaseClient.from('matches').update(payload).eq('id',id):supabaseClient.from('matches').insert({...payload,created_by:owner});
        const {data,error}=await query.select('id').single();if(error)throw error;
        if(state!==target||isSpectator()||signedInUser?.id!==owner)return;
        cloudMatchId=data.id;state.cloudRef={id:data.id,owner,isPublic:cloudIsPublic};saveLocal();refreshCloudControls();
        cloudStatus((state.localRevision||0)===revision?'Cloud score synced':'Cloud sync pending');
        if(manual){showToast('Match saved to cloud.');window.dispatchEvent(new Event('qc-match-saved'));}
        if((state.localRevision||0)!==revision)scheduleCloudSync();
      }catch(error){
        if(state===target){cloudStatus('Cloud not synced · local score retained');if(manual)showToast('Cloud save failed. Your local match is retained.');}
      }
    })();
    try{await cloudWritePromise;}finally{cloudWritePromise=null;}
  }
  function scheduleCloudSync() {
    if (isSpectator()||storageConflict||!cloudMatchId||!signedInUser||applyingRemoteState) return;
    clearTimeout(cloudSyncTimer);cloudSyncTimer=setTimeout(()=>syncCloudMatch(),500);
  }

  const emptyState = (setup) => ({
    version: 1,
    teams: [setup.teamA, setup.teamB],
    rosters: setup.rosters || null,
    roles: setup.roles || null,
    toss: setup.toss || null,
    rules: {freeHit:!!setup.freeHit},
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

  function saveLocal(){
    if(!state||isSpectator())return;
    const result=QCMatchStorage.write(localStorage,state);
    localSaveMessage=result.saved?(result.backup?'Saved on this device':'Saved · previous-copy backup unavailable'):'NOT SAVED · download backup';
    $('connectionStatus').textContent=localSaveMessage;
    if(!result.saved)showToast(result.error);
  }
  function persist() {
    if (!state||isSpectator()) return;
    state.updatedAt = new Date().toISOString();
    state.localRevision=(state.localRevision||0)+1;
    saveLocal();scheduleCloudSync();
  }
  function loadSaved() {
    if(isSpectator())return null;
    const result=QCMatchStorage.read(localStorage);
    if(result.recovered){localSaveMessage='Recovered previous save · check last delivery';showToast('Recovered the previous saved copy. Check the last delivery before continuing.');}
    else if(result.error){localSaveMessage=result.error;showToast(result.error);}
    else if(result.state)localSaveMessage='Saved on this device';
    return result.state;
  }
  function canEdit(){
    if(isSpectator())return false;
    if(storageConflict){showToast('Another tab changed this match. Download a backup if needed, then refresh before scoring.');return false;}
    return true;
  }
  function showToast(message) {
    const node = $('toast'); node.textContent = message; node.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 2300);
  }
  function start(setup) {
    if(!canEdit())return;
    clearTimeout(cloudSyncTimer);cloudMatchId=null;cloudIsPublic=false;
    state = emptyState(setup); if(state.rosters)inn().players=QCCricketPlayers.create(...state.rosters); persist();
    $('setupPanel').hidden = true; $('matchPanel').hidden = false; render();
  }
  // Store only the data needed to roll back one action. Copying full event
  // histories into every event causes rapidly growing, nested save data.
  function snapshot() {
    return {
      inningsData: state.inningsData.map(item => ({
        runs: item.runs, wickets: item.wickets, legalBalls: item.legalBalls,
        eventCount: item.events.length, freeHit:!!item.freeHit, players: item.players ? JSON.parse(JSON.stringify(item.players)) : null
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
        freeHit: !!saved.freeHit,
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
    if(!canEdit())return;
    if (!state || state.finished) { showToast('This match has finished. Start a new match to score again.'); return; }
    const current = inn();
    if(current.players&&!QCCricketPlayers.ready(current.players)){showToast("Choose batters and bowler first.");return;}
    try{QCCricketPlayers.validateDelivery(runs,opts,!!current.freeHit);}catch(error){showToast(error.message);return false;}
    const before = snapshot();
    state.redoActions=[];
    current.runs += runs;
    if (opts.wicket) current.wickets += 1;
    if (opts.legal !== false) current.legalBalls += 1;
    if(current.players)QCCricketPlayers.record(current.players,runs,opts,current.legalBalls);
    current.freeHit=!!state.rules?.freeHit&&((opts.kind==='noBall')||(!!current.freeHit&&opts.legal===false));
    current.events.push({ kind:opts.kind||'bat', id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, label, runs, wicket: !!opts.wicket, legal: opts.legal !== false, total: current.runs, wickets: current.wickets, balls: current.legalBalls, before, at: new Date().toISOString() });
    checkInningsEnd(); persist(); render(); return true;
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
    if(!canEdit())return;
    if (!state || state.finished) return;
    state.redoActions=[];
    const currentInning=inn();currentInning.events.push({id:crypto.randomUUID(),action:'endInnings',label:'Innings ended manually',runs:0,wicket:false,legal:false,total:currentInning.runs,wickets:currentInning.wickets,balls:currentInning.legalBalls,before:snapshot(),at:new Date().toISOString()});
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
    if(!canEdit())return;
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
    const redoEntry={after:snapshot(),events:state.inningsData.map((inning,i)=>inning.events.slice(before.inningsData[i]?.eventCount||0))};
    if(!Array.isArray(state.redoActions))state.redoActions=[];
    state.redoActions.push(redoEntry);if(state.redoActions.length>20)state.redoActions.shift();
    restoreSnapshot(before);
    persist(); render(); showToast('Last scoring action undone.');
  }

  function redo(){
    if(!canEdit()||!state)return;
    const actions=state.redoActions;if(!Array.isArray(actions)||!actions.length)return showToast('No undone action is available to redo.');
    const entry=actions[actions.length-1];
    try{
      if(!entry?.after||!Array.isArray(entry.events)||!Array.isArray(entry.after.inningsData))throw Error('Invalid redo entry.');
      const candidate={...state,...entry.after,inningsData:entry.after.inningsData.map((frame,i)=>({runs:frame.runs,wickets:frame.wickets,legalBalls:frame.legalBalls,freeHit:!!frame.freeHit,players:frame.players?JSON.parse(JSON.stringify(frame.players)):null,events:(state.inningsData[i]?.events||[]).concat(entry.events[i]||[])}))};
      if(!QCMatchStorage.valid(candidate)||candidate.inningsData.some((inning,i)=>inning.events.length!==entry.after.inningsData[i].eventCount))throw Error('Redo does not match the current match.');
      state.inningsData=candidate.inningsData;state.currentInnings=candidate.currentInnings;state.innings=candidate.innings;state.target=candidate.target;state.finished=candidate.finished;state.result=candidate.result;
      actions.pop();persist();render();showToast('Scoring action restored.');
    }catch(error){showToast('Could not redo this action. The current score has not changed.');}
  }
  function playerLabel(teamIndex,name){
    const roles=state.roles?.[teamIndex];
    return name+(roles?.captain===name?' (c)':'')+(roles?.keeper===name?' (wk)':'');
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
    state.inningsData.forEach((inning,i)=>{
      if(!inning.players)return;
      const q=inning.players,maidens=QCCricketPlayers.maidens(inning,i);
      table(`${state.teams[i]} · ${inning.runs}/${inning.wickets} (${oversText(inning.legalBalls)} overs)`,['Batter','R','B','4','6','SR','Status'],q.bat.map((b,j)=>[playerLabel(i,b.name)+(j===q.striker?' *':''),b.runs,b.balls,b.fours,b.sixes,QCCricketPlayers.rate(b.runs,b.balls,100),(b.dismissalText||b.out)||((j===q.striker||j===q.nonStriker||b.balls)?'not out':'yet to bat')]));
      const extras=document.createElement('p');extras.textContent=`Extras ${Object.values(q.extras).reduce((a,b)=>a+b,0)}: Wd ${q.extras.wide}, Nb ${q.extras.noBall}, B ${q.extras.bye}, Lb ${q.extras.legBye}`;area.append(extras);
      table(state.teams[1-i]+' bowling',['Bowler','O','M','R','W','Econ'],q.bowl.map((b,j)=>[playerLabel(1-i,b.name),oversText(b.balls),maidens[j],b.runs,b.wickets,QCCricketPlayers.rate(b.runs,b.balls,6)]));
      const wickets=inning.events.filter(e=>e.wicket);const fall=document.createElement('p');fall.textContent='Fall of wickets: '+(wickets.length?wickets.map(e=>`${e.total}/${e.wickets} (${oversText(e.balls)})`).join(' · '):'None');area.append(fall);
    });
    const legend=document.createElement('p');legend.className='fine-print';legend.textContent='SR: runs per 100 balls · M: maiden overs · Econ: runs conceded per over · * on strike · c: captain · wk: wicketkeeper';area.append(legend);
  }
  $('confirmPlayers').addEventListener('click',()=>{if(!canEdit())return;if(!state||state.finished||new URLSearchParams(location.search).has('match'))return;try{const ids=['strikerSelect','nonStrikerSelect','bowlerSelect'].map(id=>$(id).value===''?null:Number($(id).value));QCCricketPlayers.select(inn().players,...ids);state.redoActions=[];persist();render();}catch(error){showToast(error.message);}});

  function render() {
    if (!state) return;
    const current = inn();
    $('tossSummary').hidden=!state.toss;
    $('tossSummary').textContent=state.toss?`${state.toss.winner} won the toss and elected to ${state.toss.decision}.`:'';
    $('freeHitBanner').hidden=!current.freeHit||state.finished;
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
    $('redoButton').disabled=isSpectator()||!state.redoActions?.length;
    $('undoButton').disabled = new URLSearchParams(location.search).has('match') || !state.inningsData.some(inning => inning.events.length > 0);
    renderPlayers();
    $('connectionStatus').textContent = isSpectator()?'Spectator · read only':localSaveMessage;
  }

  function refreshSetupOptions(){
    for(const side of ['A','B']){
      const names=$('team'+side+'Players').value.split(/\r?\n/).map(n=>n.trim()).filter(Boolean);
      for(const role of ['captain','keeper']){
        const select=$(role+side),previous=select.value;select.replaceChildren();
        const blank=document.createElement('option');blank.value='';blank.textContent='Choose player';select.append(blank);
        for(const name of names){const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);}
        select.value=names.includes(previous)?previous:'';
      }
    }
    const winner=$('tossWinner');
    if(winner.options){winner.options[1].textContent=$('teamA').value.trim()||'Team A';winner.options[2].textContent=$('teamB').value.trim()||'Team B';}
  }
  for(const id of ['teamAPlayers','teamBPlayers','teamA','teamB'])$(id).addEventListener('input',refreshSetupOptions);
  refreshSetupOptions();
  function prepareTossSetup(teams,rosters,roles,winner,decision){
    if(!['0','1'].includes(winner)||!['bat','bowl'].includes(decision))throw new Error('Choose the toss winner and batting or bowling decision.');
    roles.forEach((r,i)=>{if(!rosters[i].includes(r.captain)||!rosters[i].includes(r.keeper))throw new Error('Choose a captain and wicketkeeper from each playing side.');});
    const first=decision==='bat'?Number(winner):1-Number(winner),order=[first,1-first];
    return {teamA:teams[first],teamB:teams[1-first],rosters:order.map(i=>rosters[i]),roles:order.map(i=>roles[i]),toss:{winner:teams[Number(winner)],decision}};
  }
  $('setupForm').addEventListener('submit', event => {
    event.preventDefault();
    const teamA = $('teamA').value.trim() || 'Team A', teamB = $('teamB').value.trim() || 'Team B';
    const oversLimit = Number($('oversLimit').value), playersLimit = Number($('playersLimit').value);
    if (teamA.toLowerCase() === teamB.toLowerCase()) { showToast('Please enter two different team names.'); return; }
    if (!Number.isInteger(oversLimit) || oversLimit < 1 || oversLimit > 50) { showToast('Overs must be between 1 and 50.'); return; }
    if (!Number.isInteger(playersLimit) || playersLimit < 2 || playersLimit > 15) { showToast('Players per side must be between 2 and 15.'); return; }
    let rosters;try{rosters=[QCCricketPlayers.roster($('teamAPlayers').value,playersLimit),QCCricketPlayers.roster($('teamBPlayers').value,playersLimit)];}catch(error){showToast(error.message);return;}
    try{const roles=['A','B'].map(side=>({captain:$('captain'+side).value,keeper:$('keeper'+side).value}));
      start({...prepareTossSetup([teamA,teamB],rosters,roles,$('tossWinner').value,$('tossDecision').value),oversLimit,playersLimit,freeHit:$('freeHitRule').checked});
    }catch(error){showToast(error.message);}
  });
  $('runButtons').addEventListener('click', event => { const button = event.target.closest('[data-runs]'); if (button) addEvent(`${button.dataset.runs} run${button.dataset.runs === '1' ? '' : 's'}`, Number(button.dataset.runs)); });
  let extrasContext=null;
  function previewExtra(){
    try{if($('extrasRuns').value==='')throw Error('Enter the number of runs.');const d=QCCricketPlayers.extraDelivery(extrasContext.kind,Number($('extrasRuns').value),$('noBallKind').value);$('extrasPreview').textContent=`Add ${d.runs} to team total · ${d.label} · ${d.opts.legal?'counts as a legal ball':'does not count as a legal ball'}`;$('extrasError').textContent='';}
    catch(error){$('extrasPreview').textContent='';$('extrasError').textContent=error.message;}
  }
  function openExtra(kind){
    if(!state||state.finished||new URLSearchParams(location.search).has('match'))return;
    if(inn().players&&!QCCricketPlayers.ready(inn().players)){showToast('Choose batters and bowler first.');return;}
    extrasContext={kind,state,inning:inn(),count:inn().events.length};$('extrasForm').reset();
    const penalty=kind==='wide'||kind==='noBall';
    $('extrasHeading').textContent={wide:'Record wide',noBall:'Record no-ball',bye:'Record byes',legBye:'Record leg byes'}[kind];
    $('extrasHelp').textContent=penalty?'The app adds the 1-run penalty automatically. Enter only additional runs below.':'Enter the runs signalled by the umpire.';
    $('noBallKindRow').hidden=kind!=='noBall';$('extrasRunsLabel').textContent=penalty?'Additional runs (excluding penalty)':'Runs';
    $('extrasRuns').min=penalty?'0':'1';$('extrasRuns').value=penalty?'0':'1';previewExtra();$('extrasDialog').showModal();
  }
  for(const [id,kind] of [['wideButton','wide'],['noBallButton','noBall'],['byeButton','bye'],['legByeButton','legBye']])$(id).addEventListener('click',()=>openExtra(kind));
  $('extrasRuns').addEventListener('input',previewExtra);$('noBallKind').addEventListener('change',previewExtra);
  $('cancelExtra').addEventListener('click',()=>$('extrasDialog').close());
  $('extrasForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(!state||state.finished||new URLSearchParams(location.search).has('match')||extrasContext?.state!==state||extrasContext.inning!==inn()||extrasContext.count!==inn().events.length){$('extrasDialog').close();showToast('Match changed. Open extras again.');return;}
    try{if($('extrasRuns').value==='')throw Error('Enter the number of runs.');const d=QCCricketPlayers.extraDelivery(extrasContext.kind,Number($('extrasRuns').value),$('noBallKind').value);addEvent(d.label,d.runs,d.opts);$('extrasDialog').close();}catch(error){$('extrasError').textContent=error.message;}
  });
  function updateWicketFields(){
    const kind=$('wicketDelivery').value,allowed=QCCricketPlayers.allowedDismissals(kind,!!inn().freeHit);
    for(const option of $('dismissalType').options)option.disabled=!allowed.includes(option.value);
    if(!allowed.includes($('dismissalType').value))$('dismissalType').value=allowed[0];
    const type=$('dismissalType').value,runout=type==='run out';
    $('wicketRunKind').disabled=kind==='wide';
    $('wicketRuleNote').textContent=inn().freeHit?'FREE HIT: only run-out is supported here. Record other outcomes without a wicket.':kind==='noBall'?'No-ball: only run-out is supported here. The 1-run penalty is added automatically.':kind==='wide'?'Wide: stumped, hit wicket or run-out. The 1-run penalty is added automatically.':'Legal delivery. Choose the dismissal signalled by the umpire.';
    $('runoutFields').hidden=!runout;$('fielderRow').hidden=!['caught','stumped','run out'].includes(type);
    $('survivorEnd').required=runout;
  }
  $('dismissalType').addEventListener('change',updateWicketFields);
  $('wicketDelivery').addEventListener('change',updateWicketFields);
  $('cancelWicket').addEventListener('click',()=>$('wicketDialog').close());
  let wicketContext=null;
  $('wicketButton').addEventListener('click',()=>{
    if(!state||state.finished||new URLSearchParams(location.search).has('match'))return;
    const p=inn().players;if(p&&!QCCricketPlayers.ready(p)){showToast('Choose batters and bowler first.');return;}
    wicketContext={state,inning:inn(),count:inn().events.length};
    $('wicketForm').reset();$('wicketError').textContent='';
    const field=$('dismissalFielder');field.replaceChildren();
    for(const name of ['',...(p?p.bowl.map(b=>b.name):[])]){const o=document.createElement('option');o.value=name;o.textContent=name||'Not recorded';field.append(o);}
    const dismissed=$('dismissedBatter');dismissed.replaceChildren();
    for(const slot of ['striker','nonStriker']){const o=document.createElement('option');o.value=slot;o.textContent=p?p.bat[p[slot]].name:slot;dismissed.append(o);}
    updateWicketFields();$('wicketDialog').showModal();
  });
  $('wicketForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(!state||state.finished||new URLSearchParams(location.search).has('match')||wicketContext?.state!==state||wicketContext.inning!==inn()||wicketContext.count!==inn().events.length){$('wicketDialog').close();showToast('Match changed. Open Wicket again.');return;}
    const dismissal=$('dismissalType').value,runout=dismissal==='run out',runs=runout?Number($('wicketRuns').value):0;
    if(!Number.isInteger(runs)||runs<0||runs>3){$('wicketError').textContent='Enter 0–3 completed runs.';return;}
    if(runout&&!['striker','nonStriker'].includes($('survivorEnd').value)){$('wicketError').textContent='Choose the surviving batter’s end.';return;}
    const delivery=$('wicketDelivery').value,penalty=delivery==='wide'||delivery==='noBall',total=runs+(penalty?1:0);
    if(state.currentInnings===1&&inn().runs+total>=state.target){$('wicketError').textContent='These runs reach the target before the wicket. Cancel and record the winning runs/extras instead.';return;}
    const fielder=['caught','stumped','run out'].includes(dismissal)?$('dismissalFielder').value:'';
    const kind=penalty?delivery:(runout?$('wicketRunKind').value:'bat');
    const scored=addEvent((penalty?delivery+' · ':'')+dismissal+(fielder?' ('+fielder+')':'')+(total?' +'+total:''),total,{wicket:true,dismissal,fielder,dismissedEnd:runout?$('dismissedBatter').value:'striker',survivorEnd:runout?$('survivorEnd').value:null,kind,legal:!penalty,...(delivery==='noBall'?{extraKind:$('wicketRunKind').value}:{})});
    if(!scored){$('wicketError').textContent='Wicket was not recorded. Check the dismissal and delivery type.';return;}
    $('wicketDialog').close();
  });
  $('redoButton').addEventListener('click',redo);
  $('undoButton').addEventListener('click', undo); $('endInningsButton').addEventListener('click', () => { if (confirm('End this innings?')) endInnings(); });
  $('newMatchButton').addEventListener('click',()=>{if(!canEdit())return;if(confirm('Start a new match? The current match stays saved until you start the new one. Download a backup to keep it permanently.')){clearTimeout(cloudSyncTimer);cloudMatchId=null;cloudIsPublic=false;state=null;$('matchPanel').hidden=true;$('setupPanel').hidden=false;$('resumeRow').hidden=false;refreshCloudControls();}});
  function restoreCloudReference(){cloudMatchId=state?.cloudRef?.id||null;cloudIsPublic=!!state?.cloudRef?.isPublic;refreshCloudControls();}
  $('resumeButton').addEventListener('click',()=>{if(!canEdit())return;const saved=loadSaved();if(!saved)return showToast('No valid saved match found.');state=saved;restoreCloudReference();$('setupPanel').hidden=true;$('matchPanel').hidden=false;render();});
  function exportScorecard(view){
    if(!state)return showToast('Start or load a match first.');
    try{
      const html=QCScorecardExport.build(state),url=URL.createObjectURL(new Blob([html],{type:'text/html'}));
      if(view){const popup=window.open(url,'_blank');if(popup){popup.opener=null;}else{URL.revokeObjectURL(url);showToast('Allow the scorecard tab to open, or use Download scorecard.');return;}}
      else{const a=document.createElement('a');a.href=url;a.download='quickcricket-scorecard.html';document.body.append(a);a.click();a.remove();}
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(error){showToast('Could not create scorecard: '+error.message);}
  }
  $('viewScorecard').addEventListener('click',()=>exportScorecard(true));
  $('downloadScorecard').addEventListener('click',()=>exportScorecard(false));
  $('downloadMatch').addEventListener('click',()=>{
    if(!state)return showToast('No match to download.');
    const blob=new Blob([JSON.stringify({app:'QuickCricket',exportVersion:2,match:state},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='quickcricket-match-backup.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('restoreMatch').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file||!canEdit())return;
    try{if(file.size>20000000)throw Error('Backup is too large.');const payload=JSON.parse(await file.text()),candidate=payload.match||payload;
      if(!QCMatchStorage.valid(candidate))throw Error('This is not a supported match backup.');
      if(!confirm('Restore this match as a local copy? It replaces the active match. Download the current match first if you need to keep it.'))return;
      const copy=JSON.parse(JSON.stringify(candidate));delete copy.cloudRef;clearTimeout(cloudSyncTimer);cloudMatchId=null;cloudIsPublic=false;state=copy;persist();refreshCloudControls();$('setupPanel').hidden=true;$('matchPanel').hidden=false;render();showToast('Backup restored as a local match. Save it to cloud to create a new shared match.');
    }catch(error){showToast(error.message||'Could not restore backup.');}
  });
  window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY&&state&&!isSpectator()){storageConflict=true;localSaveMessage='Changed in another tab · refresh before scoring';$('connectionStatus').textContent=localSaveMessage;clearTimeout(cloudSyncTimer);}});
  $('editMatchButton').addEventListener('click', () => { $('detailsText').textContent = `${state.teams[0]} vs ${state.teams[1]} · ${state.oversLimit} overs per innings · ${state.playersLimit} players per side.`; $('detailsDialog').showModal(); });
  $('closeDetails').addEventListener('click', () => $('detailsDialog').close());
  window.addEventListener('online', () => { if(!isSpectator())scheduleCloudSync(); });
  window.addEventListener('offline', () => { cloudStatus('Offline · cloud sync pending'); });

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
    state = saved;restoreCloudReference();
    $('setupPanel').hidden = true;
    $('matchPanel').hidden = false;
    render();
  }
  if(isSpectator()){$('setupPanel').hidden=true;$('cloudMatchArea').hidden=true;$('newMatchButton').hidden=true;$('backupControls').hidden=true;}
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => registration.update()).catch(() => {});


})();
