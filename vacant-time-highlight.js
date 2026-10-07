(() => {
  const KEY='komorebi-territory-demo-v1';
  const css=document.createElement('style');
  css.textContent=`
    .cell.vacant-time-super-target{position:relative!important;z-index:30!important;animation:vacantSuperFlash .52s steps(2,end) infinite!important;outline:5px solid #fff36b!important;outline-offset:-2px!important;box-shadow:inset 0 0 0 4px #ff8a24,0 0 10px #fff36b,0 0 26px #ffb12b!important}
    .cell.vacant-time-super-target::after{content:'🌱 +3000';position:absolute;left:50%;top:-12px;transform:translateX(-50%);z-index:40;min-width:52px;padding:3px 4px;background:#fff36b;border:2px solid #fffbd0;border-radius:4px;color:#302817;font:700 7px/1 'DotGothic16',sans-serif;text-align:center;white-space:nowrap;filter:drop-shadow(0 2px 2px #172019);pointer-events:none}
    @keyframes vacantSuperFlash{0%,49%{filter:brightness(1.55) saturate(1.35);transform:scale(1.035)}50%,100%{filter:brightness(.82);transform:scale(.985)}}
    #vacantEventGo.vacant-time-go-live{animation:vacantGoPulse .7s steps(2,end) infinite;box-shadow:0 0 12px #ffd84c!important}
    @keyframes vacantGoPulse{50%{filter:brightness(1.45)}}
    @media(max-width:600px){.cell.vacant-time-super-target::after{top:-10px;min-width:45px;font-size:6px;padding:2px 3px}}
    @media(prefers-reduced-motion:reduce){.cell.vacant-time-super-target,#vacantEventGo.vacant-time-go-live{animation:none!important}}
  `;
  document.head.appendChild(css);
  function state(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}}
  function eventTarget(s){const e=s.vacantTimeEvent;if(!e)return null;const now=Date.now();if(e.active===false)return null;if(Number(e.endsAt)&&now>=Number(e.endsAt))return null;return e.key||e.target||e.landKey||e.targetKey||null}
  function sync(){
    const s=state(),target=eventTarget(s),map=document.getElementById('map');
    if(!map)return;
    for(const el of map.querySelectorAll('.vacant-time-super-target'))el.classList.remove('vacant-time-super-target');
    const go=document.getElementById('vacantEventGo');if(go)go.classList.toggle('vacant-time-go-live',!!target);
    if(!target)return;
    let cell=map.querySelector(`[data-key="${CSS.escape(String(target))}"]`);
    if(!cell){const [x,y]=String(target).split(',').map(Number),cells=[...map.querySelectorAll('.cell')];if(Number.isFinite(x)&&Number.isFinite(y))cell=cells[y*13+x]}
    if(cell){cell.classList.add('vacant-time-super-target');cell.setAttribute('aria-label',`${cell.getAttribute('aria-label')||'空き地'}・あきとちたいむ対象・獲得で3000ポイント`)}
  }
  const observer=new MutationObserver(sync);
  function start(){const map=document.getElementById('map');if(map)observer.observe(map,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});sync();setInterval(sync,500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();