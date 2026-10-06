(() => {
  const nativeStringify = JSON.stringify.bind(JSON);

  function isGameState(value) {
    return !!(value && typeof value === 'object' && Array.isArray(value.computers) && Array.isArray(value.lands) && value.raid);
  }

  const RAID_JOIN_CHANCE = {
    pioneer: .30,
    balanced: .55,
    challenger: .72,
    wanderer: .38,
    duelist: .42
  };

  function chooseRaidParticipants(state, now) {
    const raid = state.raid;
    if (!raid?.active || !raid.key) return;
    const raidId = `${raid.startedAt || 0}:${raid.key}`;
    if (raid.__npcChoiceId === raidId) return;
    raid.__npcChoiceId = raidId;

    const joining = new Set();
    for (const bot of state.computers || []) {
      const chance = RAID_JOIN_CHANCE[bot.style] ?? .5;
      if (Math.random() < chance) joining.add(bot.id);
    }

    // 誰も来ない回もあってよいが、大型レイドは最低1人だけ来やすくする。
    if (!joining.size && raid.type !== 'mini' && state.computers?.length && Math.random() < .75) {
      joining.add(state.computers[Math.floor(Math.random() * state.computers.length)].id);
    }

    raid.allies = Array.isArray(raid.allies) ? raid.allies.filter(ally => joining.has(ally.id)) : [];

    for (const bot of state.computers || []) {
      if (joining.has(bot.id)) {
        bot.__raidDecision = 'join';
        continue;
      }

      // 不参加NPCはレイド移動を取り消し、元の行動へ戻す。
      const trip = bot.raidTrip;
      if (trip) {
        bot.position = trip.origin || bot.position || bot.lands?.[0];
        delete bot.raidTrip;
      }
      delete bot.__raidReturnSeed;
      delete bot.__raidReturnTrip;
      bot.__raidDecision = 'skip';
      bot.nextActionAt = Math.min(Number(bot.nextActionAt) || now, now + 1200 + Math.random() * 2800);
    }
  }

  function rememberRaidTrips(state) {
    if (!state.raid?.active) return;
    for (const bot of state.computers || []) {
      if (bot.__raidDecision === 'skip') continue;
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
      delete bot.__raidDecision;
      bot.nextActionAt = Math.max(Number(bot.nextActionAt) || 0, now + 4000 + Math.random() * 4000);
      return;
    }
    bot.__raidReturnTrip = { origin: seed.origin, path: returnPath, startedAt: now, stepMs: seed.stepMs || 2500 };
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
      delete bot.__raidDecision;
      bot.nextActionAt = Math.max(Number(bot.nextActionAt) || 0, now + 4000 + Math.random() * 4000);
      return;
    }
    if (due > 0) bot.position = path[due - 1];
    bot.nextActionAt = Math.max(Number(bot.nextActionAt) || 0, now + stepMs + 3500);
  }

  function keepNpcRaidMovementNatural(state, now) {
    chooseRaidParticipants(state, now);
    rememberRaidTrips(state);
    if (!state.raid?.active) {
      for (const bot of state.computers || []) {
        if (bot.__raidDecision === 'skip') delete bot.__raidDecision;
        startReturnTrip(bot, now);
      }
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
