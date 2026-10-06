(() => {
  const nativeStringify = JSON.stringify.bind(JSON);

  function isGameState(value) {
    return !!(value && typeof value === 'object' && Array.isArray(value.computers) && Array.isArray(value.lands) && value.raid);
  }

  const RAID_JOIN_CHANCE = { pioneer:.30, balanced:.55, challenger:.72, wanderer:.38, duelist:.42 };
  const toXY = key => String(key).split(',').map(Number);
  const toKey = (x,y) => `${x},${y}`;

  function largestConnectedTerritory(owned){
    const seen=new Set(); let best=0;
    for(const start of owned){
      if(seen.has(start))continue;
      let count=0,q=[start];seen.add(start);
      while(q.length){const k=q.shift();count++;const[x,y]=toXY(k);for(const n of [toKey(x+1,y),toKey(x-1,y),toKey(x,y+1),toKey(x,y-1)])if(owned.has(n)&&!seen.has(n)){seen.add(n);q.push(n)}}
      best=Math.max(best,count);
    }
    return best;
  }

  function territoryShapeBonuses(state) {
    const owned = new Set(state.lands || []), lineDefense = new Set(), encircledEnemies = new Set();
    // 5マス以上の縦・横一直線：その列の各土地へ自動防御+1。
    for (const k of owned) {
      const [x,y] = toXY(k);
      for (const [dx,dy] of [[1,0],[0,1]]) {
        if (owned.has(toKey(x-dx,y-dy))) continue;
        const run=[];
        for(let cx=x,cy=y; owned.has(toKey(cx,cy)); cx+=dx,cy+=dy) run.push(toKey(cx,cy));
        if(run.length>=5) run.forEach(cell=>lineDefense.add(cell));
      }
    }
    // 敵地の周囲8マスを「口」の字で完全に囲むと包囲成立。
    for(const bot of state.computers||[])for(const k of bot.lands||[]){
      const[x,y]=toXY(k),ring=[];
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)ring.push(toKey(x+dx,y+dy));
      if(ring.every(n=>owned.has(n)))encircledEnemies.add(k);
    }
    state.territoryShapeBonuses={lineDefense:[...lineDefense],encircledEnemies:[...encircledEnemies],largestConnected:largestConnectedTerritory(owned),updatedAt:Date.now()};
    window.__komorebiTerritoryShapeBonuses=state.territoryShapeBonuses;
    applyAutomaticLineDefense(state,lineDefense);
    applyEncirclementToOccupation(state,encircledEnemies);
  }

  function applyAutomaticLineDefense(state,lineDefense){
    state.landGear=state.landGear||{};
    const all=new Set([...Object.keys(state.landGear),...(state.lands||[])]);
    for(const k of all){
      const gear=state.landGear[k]=state.landGear[k]||{};
      const entry=gear.watchtower=gear.watchtower||{count:0,level:0};
      const oldAuto=Math.max(0,Number(entry.__shapeAuto)||0);
      const playerCount=Math.max(0,(Number(entry.count)||0)-oldAuto);
      const auto=lineDefense.has(k)?1:0;
      entry.count=playerCount+auto;
      entry.__shapeAuto=auto;
      if(!entry.count&&!entry.level){delete gear.watchtower;if(!Object.keys(gear).length)delete state.landGear[k]}
    }
  }

  function applyEncirclementToOccupation(state,encircledEnemies){
    const occ=state.occupy;if(!occ||occ.type!=='raid'||!encircledEnemies.has(occ.key)||occ.__encirclementApplied)return;
    const before=Math.max(1,Number(occ.required)||20),after=Math.max(12,Math.ceil(before*.55));
    occ.required=after;occ.__encirclementApplied=true;occ.encirclementMultiplier=.55;occ.encirclementOriginalRequired=before;
    state.log=Array.isArray(state.log)?state.log:[];
    state.log.unshift(`包囲効果！敵地をぐるっと囲んだため、占領時間が${before}秒→${after}秒に短縮された。`);
    state.log=state.log.slice(0,6);
  }

  window.KomorebiTerritoryShapes={
    defenseBonus(key){return window.__komorebiTerritoryShapeBonuses?.lineDefense?.includes(key)?1:0},
    isEncircled(key){return window.__komorebiTerritoryShapeBonuses?.encircledEnemies?.includes(key)||false},
    incomeMultiplier(){const n=Number(window.__komorebiTerritoryShapeBonuses?.largestConnected)||0;return n>=8?1.15:n>=5?1.10:n>=3?1.06:n>=2?1.03:1}
  };

  function chooseRaidParticipants(state, now) {
    const raid=state.raid;if(!raid?.active||!raid.key)return;const raidId=`${raid.startedAt||0}:${raid.key}`;if(raid.__npcChoiceId===raidId)return;raid.__npcChoiceId=raidId;
    const joining=new Set();for(const bot of state.computers||[]){const chance=RAID_JOIN_CHANCE[bot.style]??.5;if(Math.random()<chance)joining.add(bot.id)}
    if(!joining.size&&raid.type!=='mini'&&state.computers?.length&&Math.random()<.75)joining.add(state.computers[Math.floor(Math.random()*state.computers.length)].id);
    raid.allies=Array.isArray(raid.allies)?raid.allies.filter(ally=>joining.has(ally.id)):[];
    for(const bot of state.computers||[]){if(joining.has(bot.id)){bot.__raidDecision='join';continue}const trip=bot.raidTrip;if(trip){bot.position=trip.origin||bot.position||bot.lands?.[0];delete bot.raidTrip}delete bot.__raidReturnSeed;delete bot.__raidReturnTrip;bot.__raidDecision='skip';bot.nextActionAt=Math.min(Number(bot.nextActionAt)||now,now+1200+Math.random()*2800)}
  }

  function rememberRaidTrips(state){if(!state.raid?.active)return;for(const bot of state.computers||[]){if(bot.__raidDecision==='skip')continue;const trip=bot.raidTrip;if(!trip||trip.returning)continue;const forwardPath=Array.isArray(trip.path)?[...trip.path]:[],cursor=Math.max(0,Math.min(forwardPath.length,Number(trip.cursor)||0));bot.__raidReturnSeed={origin:trip.origin||bot.lands?.[0]||bot.position,raidKey:trip.key||state.raid.key||bot.position,currentPosition:bot.position||trip.origin||bot.lands?.[0],forwardPath,cursor,stepMs:Math.max(900,Number(trip.stepMs)||2500)};delete bot.__raidReturnTrip}}
  function startReturnTrip(bot,now){const seed=bot.__raidReturnSeed;if(!seed||bot.raidTrip||bot.__raidReturnTrip)return;const forward=Array.isArray(seed.forwardPath)?seed.forwardPath:[],cursor=Math.max(0,Math.min(forward.length,Number(seed.cursor)||0)),current=seed.currentPosition||(cursor>0?forward[cursor-1]:seed.origin)||bot.position,walked=forward.slice(0,cursor),returnPath=walked.slice(0,-1).reverse();if(seed.origin&&current!==seed.origin&&returnPath[returnPath.length-1]!==seed.origin)returnPath.push(seed.origin);bot.action=null;bot.position=current||seed.origin;if(!returnPath.length||bot.position===seed.origin){bot.position=seed.origin||bot.position;delete bot.__raidReturnSeed;delete bot.__raidDecision;bot.nextActionAt=Math.max(Number(bot.nextActionAt)||0,now+4000+Math.random()*4000);return}bot.__raidReturnTrip={origin:seed.origin,path:returnPath,startedAt:now,stepMs:seed.stepMs||2500};bot.nextActionAt=Math.max(Number(bot.nextActionAt)||0,now+returnPath.length*(seed.stepMs||2500)+4500)}
  function advanceReturnTrip(bot,now){const trip=bot.__raidReturnTrip;if(!trip)return;bot.action=null;const path=Array.isArray(trip.path)?trip.path:[],stepMs=Math.max(900,Number(trip.stepMs)||2500),due=Math.max(0,Math.floor((now-Number(trip.startedAt||now))/stepMs));if(!path.length||due>=path.length){bot.position=trip.origin||path[path.length-1]||bot.position;delete bot.__raidReturnTrip;delete bot.__raidReturnSeed;delete bot.__raidDecision;bot.nextActionAt=Math.max(Number(bot.nextActionAt)||0,now+4000+Math.random()*4000);return}if(due>0)bot.position=path[due-1];bot.nextActionAt=Math.max(Number(bot.nextActionAt)||0,now+stepMs+3500)}
  function keepNpcRaidMovementNatural(state,now){chooseRaidParticipants(state,now);rememberRaidTrips(state);if(!state.raid?.active)for(const bot of state.computers||[]){if(bot.__raidDecision==='skip')delete bot.__raidDecision;startReturnTrip(bot,now)}for(const bot of state.computers||[])advanceReturnTrip(bot,now)}

  function applyFeedbackReward(state){const reward=window.__komorebiFeedbackReward;if(!reward||!reward.id)return;state.feedbackRewardIds=Array.isArray(state.feedbackRewardIds)?state.feedbackRewardIds:[];if(!state.feedbackRewardIds.includes(reward.id)){state.feedbackRewardIds.push(reward.id);state.feedbackRewardIds=state.feedbackRewardIds.slice(-100);state.points=(Number(state.points)||0)+(Number(reward.amount)||1000);state.log=Array.isArray(state.log)?state.log:[];state.log.unshift(`感想・報告ありがとう！ +${(Number(reward.amount)||1000).toLocaleString()}ptを受け取りました。`);state.log=state.log.slice(0,6)}window.__komorebiFeedbackReward=null}

  JSON.stringify=function(value,replacer,space){try{if(isGameState(value)){const now=Date.now();territoryShapeBonuses(value);keepNpcRaidMovementNatural(value,now);applyFeedbackReward(value)}}catch(error){console.warn('komorebi runtime patch skipped',error)}return nativeStringify(value,replacer,space)};
  window.KomorebiRuntimePatch={rewardFeedback(id,amount=1000){window.__komorebiFeedbackReward={id,amount}}};
})();
