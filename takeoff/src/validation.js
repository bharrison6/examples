/* Shared structural checks. They cannot verify a publication's truth. */
const Validation = (() => {
function check(D,E) {
  const rows=[]; const ok=(name,pass,detail='')=>rows.push({name,pass:!!pass,detail});
  const refs=[];const walk=x=>{if(!x||typeof x!=='object')return;if(x.src)refs.push(x.src);(x.extraSrc||[]).forEach(s=>refs.push(s));Object.values(x).forEach(v=>{if(v&&typeof v==='object')walk(v);});};
  walk(D.ROUNDS);walk(D.MODELS);walk(D.DOMAINS);
  ok('Every evidence reference resolves to a source',refs.every(k=>D.SOURCES[k]));
  ok('Every source has a title, HTTPS link, and checked date',Object.values(D.SOURCES).every(s=>s.t&&/^https:\/\//.test(s.u)&&s.checked===D.SNAPSHOT));
  for(const r of D.ROUNDS) {
    const pts=E.allPoints(r);
    ok(r.metric+': source-backed numeric points',pts.every(p=>Number.isFinite(p.value)&&D.SOURCES[p.src]));
    ok(r.metric+': chronological, bounded history',pts.every((p,i)=>E.t(p.date)<=E.t(D.SNAPSHOT)&&(!i||E.t(p.date)>=E.t(pts[i-1].date))&&p.value>=r.yMin&&p.value<=r.yMax));
    ok(r.metric+': drawing endpoint matches final evidence date',r.askDate===r.hidden.at(-1).date&&E.t(r.hidden[0].date)>E.t(r.shown.at(-1).date));
    ok(r.metric+': ordered uncertainty intervals',pts.every(p=>p.lo==null||(p.lo>0&&p.lo<=p.value&&p.hi>=p.value)));
    ok(r.metric+': context and caveats supplied',r.plain&&r.human&&r.example&&r.reveal.caveat&&r.xLabel&&r.yLabel);
    const scale=E.makeScale(r.scale,r.yMin,r.yMax);
    ok(r.metric+': exact estimate matches final value',Math.abs(E.score(r,E.emptyGuess(scale.to(E.finalValue(r)))).predicted-E.finalValue(r))<1e-8);
  }
  ok('Every selected release has a source and known company',D.MODELS.every(m=>D.SOURCES[m.src]&&D.LABS[m.lab]&&E.t(m.d)<=E.t(D.SNAPSHOT)));
  ok('Selected release catalog is chronological',D.MODELS.every((m,i)=>!i||E.t(m.d)>=E.t(D.MODELS[i-1].d)));
  ok('Timeline includes both hosted and downloadable systems',D.MODELS.some(m=>m.open)&&D.MODELS.some(m=>!m.open));
  ok('Real-work evidence separates AI, people, and limitations',D.DOMAINS.every(d=>d.items.every(m=>m.machine&&m.human&&m.caveat&&D.SOURCES[m.src])));
  ok('Illustrative rules agree at both anchor points',[-1,0].every(t=>E.scenarios(t).every(r=>Math.abs(r.value-(t===-1?20:30))<1e-9)));
  return rows;
}
return {check};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=Validation;
