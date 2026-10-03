(() => {
  const W=13,H=11,KEY='komorebi-territory-demo-v1',BASE=Date.now();
  const items=[
    {id:'flower',name:'野の花の花壇',icon:'🌼',cost:30,bonus:8,desc:'土地の収入 +8%'},
    {id:'lamp',name:'きのこのランプ',icon:'🍄',cost:55,bonus:15,desc:'土地の収入 +15%'},
    {id:'cottage',name:'ちいさな小屋',icon:'🏡',cost:100,bonus:25,desc:'土地の収入 +25%'},
    {id:'fence',name:'木の柵',icon:'🪵',cost:45,bonus:0,desc:'防衛施設（見た目のみ）'}
  ];
  const initial=()=>({name:'こもれびさん',points:80,morale:3,lastTick:Date.now(),decor:[],lands:['6,5'],home:'6,5',pos:'6,5',ownedSince:{'6,5':Date.now()},past:['6,5'],attacks:{},attempts:{},selected:'6,5',occupy:null,log:['世界にやってきた！拠点を飾ってみよう。']});
  let state;try{state={...initial(),...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{state=initial()}
  const $=id=>document.getElementById(id),key=(x,y)=>`${x},${y}`,xy=k=>k.split(',').map(Number),has=k=>state.lands.includes(k);
  const map=$('map');let cells=[];let selected=state.selected||state.home;
  // Stable handcrafted landmarks plus pseudo-random forest and wild tiles.
  const water=new Set(['0,0','1,0','2,0','0,1','12,0','12,1','12,2','0,10','1,10','12,9','12,10','2,9','3,9']);
  const forest=new Set(['3,2','4,2','5,2','9,1','10,1','10,2','2,7','3,7','9,8','10,8','11,8','7,1','8,1','1,4','11,5']);
  const landmarks={'9,3':'🪨','3,5':'🌳','8,7':'🪷','5,8':'🌳','10,5':'🪨'};
  const cellData={};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const k=key(x,y),el=document.createElement('button');el.className='cell';el.type='button';el.setAttribute('role','gridcell');el.dataset.key=k;
    const hash=(x*37+y*71+x*y*13)%17;let type=water.has(k)?'water':forest.has(k)?'forest':'path';cellData[k]={type,wild:!water.has(k)&&!forest.has(k)&&hash===0};
    if(landmarks[k])cellData[k].icon=landmarks[k];
    el.addEventListener('click',()=>clickCell(k));map.appendChild(el);cells.push(el);
  }
  // Demo neighbors, with one vacant frontier close to home and two reclaimable plots.
  const demoOthers={'8,4':'@mugi','9,4':'@mugi','10,4':'@mugi','3,4':'@ao','3,3':'@ao'};
  const demoReclaim=new Set(['8,4','9,4']);
  const staticLands=new Set(Object.keys(demoOthers));
  function save(){state.selected=selected;localStorage.setItem(KEY,JSON.stringify(state));}
  function timeLabel(s){return `${Math.floor(s/60)}分${String(s%60).padStart(2,'0')}秒`;}
  function ownedCount(){return state.lands.length}
  function perMinute(){return ownedCount()*6*(1+Math.min(1,state.decor.reduce((a,id)=>a+(items.find(i=>i.id===id)?.bonus||0),0)/100));}
  function tick(){const now=Date.now(),elapsed=Math.max(0,now-(state.lastTick||now));if(elapsed>0){state.points+=perMinute()*elapsed/60000;state.lastTick=now;const rec=Math.min(3,(state.morale||0)+elapsed/3600000*3);state.morale=rec;}if(state.occupy){const occ=state.occupy;const seconds=(now-occ.startedAt)/1000;occ.progress=Math.max(0,Math.min(occ.required,seconds));if(occ.progress>=occ.required){finishOccupation();}}save();render();}
  function log(msg){state.log.unshift(msg);state.log=state.log.slice(0,6);}
  function ownedElse(k){return staticLands.has(k)&&!has(k)}
  function drawMap(){for(const el of cells){const k=el.dataset.key,info=cellData[k],mine=has(k),other=ownedElse(k),player=state.pos===k;el.className=`cell ${info.type}${mine?' yours':''}${other?' other':''}${demoReclaim.has(k)?' reclaim':''}${selected===k?' selected':''}${player?' player':''}${k===state.home?' home':''}`;el.innerHTML='';const icon=document.createElement('span');icon.className='cell-icon';icon.textContent=mine?(k===state.home?'🏠':(state.decor.length?items.find(i=>i.id===state.decor[state.decor.length-1])?.icon:'🌿')):(other?'🏡':(info.wild?'✨':(info.icon||'')));el.appendChild(icon);if(mine&&k!==state.home){const mark=document.createElement('span');mark.className='land-mark';mark.textContent='✿';el.appendChild(mark)}el.setAttribute('aria-label',`${xLabel(k)}${mine?' あなたの土地':other?' '+demoOthers[k]+'の土地':info.wild?' 無人地':''}`);}}
  function xLabel(k){const [x,y]=xy(k);return `マス ${x+1},${y+1}`}
  function clickCell(k){const [x,y]=xy(k),[px,py]=xy(state.pos);selected=k;if(Math.abs(x-px)+Math.abs(y-py)===1){moveTo(k)}else if(k===state.pos){render()}else{log('まずは隣のマスへ移動しよう。');render()}save();}
  function moveTo(k){if(cellData[k]?.type==='water'){log('水辺は通れないみたい。');return}const prev=state.pos;if(state.occupy&&state.occupy.key!==k)cancelOccupation('場所を離れたので占領が中断。気力を少し消耗した。');state.pos=k;if(has(k)){log(k===state.home?'拠点でひと休み。':'自分の土地に戻った。');}else if(ownedElse(k)){if(state.morale<.2){log('気力が足りない。少し休んでから挑戦しよう。');state.pos=prev;return}startOccupation(k,demoReclaim.has(k)?'reclaim':'raid')}else if(cellData[k].wild){startOccupation(k,'wild')}else{log('草地を歩いている。近くの無人地を探そう。')}selected=k;save();render();}
  function targetType(k){if(has(k))return 'own';if(ownedElse(k))return demoReclaim.has(k)?'reclaim':'raid';return cellData[k]?.wild?'wild':'path'}
  function durationFor(k,type){if(type==='wild')return 30;if(type==='reclaim')return 15;const attempts=state.attempts[k]||0;return Math.min(240,60+Math.max(0,attempts-1)*30)}
  function startOccupation(k,type){if(type==='path'||type==='own')return;const required=durationFor(k,type);state.occupy={key:k,type,required,startedAt:Date.now(),progress:0};log(type==='wild'?'無人地の開拓を始めた。':'土地の占領を始めた。');}
  function cancelOccupation(message='占領を中断した。気力を少し消耗した。'){const o=state.occupy;if(o&&(o.type==='raid'||o.type==='reclaim')){state.attempts[o.key]=(state.attempts[o.key]||0)+1;state.morale=Math.max(0,state.morale-.5)}state.occupy=null;log(message)}
  function finishOccupation(){const o=state.occupy;if(!o)return;const k=o.key;if(o.type==='wild'){state.lands.push(k);state.past.push(k);state.ownedSince[k]=Date.now();state.morale=Math.min(3,state.morale+1.5);log('新しい土地を開拓！気力が少し回復した。')}else if(o.type==='reclaim'){if(staticLands.has(k)){staticLands.delete(k);delete demoOthers[k]}state.lands.push(k);state.ownedSince[k]=Date.now();state.attempts[k]=0;state.morale=Math.min(3,state.morale+1.5);log('土地を取り返した！収入も戻ってきた。')}else{if(state.morale<.2){state.occupy=null;return}state.attacks[k]=(state.attacks[k]||0)+1;staticLands.delete(k);delete demoOthers[k];state.lands.push(k);state.past.push(k);state.ownedSince[k]=Date.now();state.morale=Math.min(3,state.morale+1.5);state.attempts[k]=0;log('土地を占領した！飾りや施設を置いて育てよう。気力も少し回復した。')}state.occupy=null;}
  function actionButtons(){const wrap=$('tileActions');wrap.innerHTML='';const k=selected,typ=targetType(k),name=typ==='own'?'あなたの土地':typ==='raid'?`${demoOthers[k]||'ほかの人'}の土地`:typ==='reclaim'?'以前のあなたの土地':typ==='wild'?'無人地':'草地';$('tileTitle').textContent=k===state.home?'拠点':name;$('tileBadge').textContent=k===state.home?'ホーム':typ==='own'?'所有中':typ==='wild'?'無人地':typ==='reclaim'?'奪還できる':typ==='raid'?'ほかの人':'草地';$('tileDescription').textContent=typ==='own'?(k===state.home?'ここが帰る場所。飾りを置くと、世界全体の土地収入が上がるよ。':'あなたの土地。ここからポイントが生まれているよ。'):typ==='wild'?'まだ誰もいない土地。隣に移動して、30秒いると開拓できる。':typ==='reclaim'?'以前あなたが持っていた土地。15秒いると取り返せるよ。':typ==='raid'?`持ち主がいる土地。${durationFor(k,'raid')}秒の占領が必要。繰り返し攻めると時間が延びるよ。`:'草地。移動して周りを探索しよう。';
    if(k!==state.pos){const b=document.createElement('button');b.textContent='ここへ移動';b.disabled=Math.abs(xy(k)[0]-xy(state.pos)[0])+Math.abs(xy(k)[1]-xy(state.pos)[1])!==1||typ==='path'&&cellData[k].type==='water';b.addEventListener('click',()=>moveTo(k));wrap.appendChild(b)}
    if(typ==='own'&&k===state.home){const d=document.createElement('button');d.textContent='拠点の土地を広げる · 70pt';d.disabled=state.points<70;d.addEventListener('click',buyPlot);wrap.appendChild(d)}
  }
  function buyPlot(){if(state.points<70)return;const [hx,hy]=xy(state.home);let candidate=null;for(let r=1;r<7&&!candidate;r++)for(let y=Math.max(0,hy-r);y<=Math.min(H-1,hy+r)&&!candidate;y++)for(let x=Math.max(0,hx-r);x<=Math.min(W-1,hx+r);x++){const k=key(x,y);if(Math.abs(x-hx)+Math.abs(y-hy)<=r&&cellData[k].type!=='water'&&!has(k)&&!ownedElse(k)){candidate=k;break}}if(!candidate){log('近くに購入できる土地が見つからない。');render();return}state.points-=70;state.lands.push(candidate);state.past.push(candidate);state.ownedSince[candidate]=Date.now();selected=candidate;log(`${xLabel(candidate)}を購入した。`);render();}
  function renderShop(){const box=$('shopItems');box.innerHTML='';items.forEach(item=>{const card=document.createElement('div');card.className='shop-item';card.innerHTML=`<span class="emoji">${item.icon}</span><strong>${item.name}</strong><small>${item.desc}</small>`;const count=state.decor.filter(id=>id===item.id).length,cost=item.cost+count*10;const btn=document.createElement('button');btn.textContent=count>=5?'設置上限':`${cost} pt · 買う (${count}/5)`;btn.disabled=state.points<cost||count>=5;btn.addEventListener('click',()=>{state.points-=cost;state.decor.push(item.id);log(`${item.name}を飾った。土地の収入が上がった！`);render()});card.appendChild(btn);box.appendChild(card)})}
  function render(){drawMap();actionButtons();renderShop();$('points').textContent=Math.floor(state.points).toLocaleString();$('income').textContent=`${perMinute().toFixed(1)} pt / 分`;$('bonus').textContent=`+${Math.min(100,state.decor.reduce((a,id)=>a+(items.find(i=>i.id===id)?.bonus||0),0))}%`;$('moraleValue').textContent=`${Math.floor(state.morale)} / 3`;$('moraleBar').style.width=`${Math.max(0,state.morale)/3*100}%`;$('playerName').textContent=state.name;$('tileCount').textContent=ownedCount();$('locationLabel').textContent=state.pos===state.home?'拠点にいます':xLabel(state.pos);const occ=state.occupy;$('occupation').classList.toggle('hidden',!occ);if(occ){const left=Math.max(0,occ.required-occ.progress);$('occLabel').textContent=occ.type==='wild'?'無人地を開拓中…':occ.type==='reclaim'?'土地を取り返し中…':'土地を占領中…';$('occTime').textContent=`${Math.ceil(left)}秒`;$('occBar').style.width=`${Math.min(100,occ.progress/occ.required*100)}%`}$('eventLog').innerHTML=state.log.map(x=>`<li><time>✦</time>${escapeHtml(x)}</li>`).join('');}
  function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function move(dir){const [x,y]=xy(state.pos),d={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[dir],nx=x+d[0],ny=y+d[1];if(nx>=0&&ny>=0&&nx<W&&ny<H)moveTo(key(nx,ny));}
  document.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click',()=>move(b.dataset.move)));
  $('centerBtn').addEventListener('click',()=>{const [x,y]=xy(state.pos),[hx,hy]=xy(state.home);if(state.occupy)state.occupy=null;state.pos=state.home;selected=state.home;log('拠点へ戻ってひと休み。');render()});
  $('interruptBtn').addEventListener('click',()=>{cancelOccupation();render()});
  $('helpBtn').addEventListener('click',()=>$('helpDialog').showModal());document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  $('renameBtn').addEventListener('click',()=>{$('nameInput').value=state.name;$('nameDialog').showModal()});$('nameDialog').addEventListener('close',()=>{if($('nameDialog').returnValue==='save'){state.name=$('nameInput').value.trim().slice(0,12)||'こもれびさん';render();save()}});
  $('resetBtn').addEventListener('click',()=>{if(confirm('このブラウザの試作データを最初からに戻す？')){localStorage.removeItem(KEY);location.reload()}});
  document.body.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();move(({ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'})[e.key])}});
  // Server time will replace this client clock in the multiplayer build.
  const born=BASE;function clock(){const sec=Math.floor((Date.now()-born)/1000);$('clock').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
  state.lastTick=state.lastTick||Date.now();render();clock();setInterval(()=>{tick();clock()},1000);
})();
