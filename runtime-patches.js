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
      const forwardPath = Array.isArray(trip.path) ? [...trip.path] : [];
      const cursor = Math.max(0, Math.min(forwardPath.length, Number(trip.cursor) || 0));
      bot.__raidReturnSeed = {
        origin: trip.origin || bot.lands?.[0] || bot.position,
        raidKey: trip.key || state.raid.key || bot.position,
        currentPosition: bot.position || trip.origin || bot.lands?.[0],
        forwardPath,
        cursor,
        stepMs: Math.max(900, Number(trip.stepMs) || 2500)
      };
      delete bot.__raidReturnTrip;
    }
  }

  function startReturnTrip(bot, now) {
    const seed = bot.__raidReturnSeed;
    if (!seed || bot.raidTrip || bot.__raidReturnTrip) return;

    const forward = Array.isArray(seed.forwardPath) ? seed.forwardPath : [];
    const cursor = Math.max(0, Math.min(forward.length, Number(seed.cursor) || 0));
    const current = seed.currentPosition || (cursor > 0 ? forward[cursor - 1] : seed.origin) || bot.position;
    const walked = forward.slice(0, cursor);
    const returnPath = walked.slice(0, -1).reverse();
    if (seed.origin && current !== seed.origin && returnPath[returnPath.length - 1] !== seed.origin) returnPath.push(seed.origin);

    bot.action = null;
    bot.position = current || seed.origin;

    if (!returnPath.length || bot.position === seed.origin) {
      bot.position = seed.origin || bot.position;
      delete bot.__raidReturnSeed;
      bot.nextActionAt = Math.max(Number(bot.nextActionAt) || 0, now + 4000 + Math.random() * 4000);
      return;
    }

    bot.__raidReturnTrip = {
      origin: seed.origin,
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
      bot.position = trip.origin || path[path.length - 1] || bot.position;
      delete bot.__raidReturnTrip;
      delete bot.__raidReturnSeed;
      bot.nextActionAt = Math.max(Number(bot.nextActionAt) || 0, now + 4000 + Math.random() * 4000);
      return;
    }

    if (due > 0) bot.position = path[due - 1];
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
    }
  };
})();
