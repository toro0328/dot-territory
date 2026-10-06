(() => {
  const nativeStringify = JSON.stringify.bind(JSON);
  const GAME_KEY = 'komorebi-territory-demo-v1';

  function isGameState(value) {
    return !!(value && typeof value === 'object' && Array.isArray(value.computers) && Array.isArray(value.lands) && value.raid);
  }

  function rememberRaidTrips(state) {
    if (!state.raid?.active) return;
    for (const bot of state.computers || []) {
      const trip = bot.raidTrip;
      if (!trip || trip.returning) continue;
      bot.__raidReturnSeed = {
        origin: trip.origin || bot.lands?.[0] || bot.position,
        raidKey: trip.key || state.raid.key || bot.position,
        forwardPath: Array.isArray(trip.path) ? [...trip.path] : [],
        stepMs: Math.max(900, Number(trip.stepMs) || 2500)
      };
      delete bot.__raidReturnTrip;
    }
  }

  function startReturnTrip(bot, now) {
    const seed = bot.__raidReturnSeed;
    if (!seed || bot.raidTrip || bot.__raidReturnTrip) return;
    const forward = Array.isArray(seed.forwardPath) ? seed.forwardPath : [];
    const returnPath = [...forward.slice(0, -1).reverse()];
    if (seed.origin) returnPath.push(seed.origin);
    bot.action = null;
    bot.position = seed.raidKey || bot.position || seed.origin;
    bot.__raidReturnTrip = {
      origin: seed.origin,
      raidKey: seed.raidKey,
      path: returnPath,
      startedAt: now,
      stepMs: seed.stepMs || 2500
    };
    bot.nextActionAt = Math.max(Number(bot.nextActionAt) || 0, now + returnPath.length * (seed.stepMs || 2500) + 4500);
  }

  function advanceReturnTrip(bot, now) {
    const trip = bot.__raidReturnTrip;
    if (!trip) return;
    bot.action = null;
    const path = Array.isArray(trip.path) ? trip.path : [];
    const stepMs = Math.max(900, Number(trip.stepMs) || 2500);
    const due = Math.max(0, Math.floor((now - Number(trip.startedAt || now)) / stepMs));
    if (!path.length || due >= path.length) {
      bot.position = trip.origin || bot.position;
      delete bot.__raidReturnTrip;
      delete bot.__raidReturnSeed;
      bot.nextActionAt = Math.max(Number(bot.nextActionAt) || 0, now + 4000 + Math.random() * 4000);
      return;
    }
    bot.position = due > 0 ? path[due - 1] : (trip.raidKey || bot.position);
    bot.nextActionAt = Math.max(Number(bot.nextActionAt) || 0, now + stepMs + 3500);
  }

  function keepNpcRaidMovementNatural(state, now) {
    rememberRaidTrips(state);
    if (!state.raid?.active) {
      for (const bot of state.computers || []) startReturnTrip(bot, now);
    }
    for (const bot of state.computers || []) advanceReturnTrip(bot, now);
  }

  function applyFeedbackReward(state) {
    const reward = window.__komorebiFeedbackReward;
    if (!reward || !reward.id) return;
    state.feedbackRewardIds = Array.isArray(state.feedbackRewardIds) ? state.feedbackRewardIds : [];
    if (!state.feedbackRewardIds.includes(reward.id)) {
      state.feedbackRewardIds.push(reward.id);
      state.feedbackRewardIds = state.feedbackRewardIds.slice(-100);
      state.points = (Number(state.points) || 0) + (Number(reward.amount) || 1000);
      state.log = Array.isArray(state.log) ? state.log : [];
      state.log.unshift(`感想・報告ありがとう！ +${(Number(reward.amount) || 1000).toLocaleString()}ptを受け取りました。`);
      state.log = state.log.slice(0, 6);
    }
    window.__komorebiFeedbackReward = null;
  }

  JSON.stringify = function(value, replacer, space) {
    try {
      if (isGameState(value)) {
        const now = Date.now();
        keepNpcRaidMovementNatural(value, now);
        applyFeedbackReward(value);
      }
    } catch (error) {
      console.warn('komorebi runtime patch skipped', error);
    }
    return nativeStringify(value, replacer, space);
  };

  window.KomorebiRuntimePatch = {
    rewardFeedback(id, amount = 1000) {
      window.__komorebiFeedbackReward = { id, amount };
      try {
        const raw = localStorage.getItem(GAME_KEY);
        if (raw) localStorage.setItem(GAME_KEY, raw);
      } catch {}
    }
  };
})();
