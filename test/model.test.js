import test from 'node:test';
import assert from 'node:assert/strict';
import {display,escape,filterMatches,uniqueMatches,japanTime,validatePayload,
  chartNumber,readCache,writeCache,CACHE_VERSION} from '../public/model.js';
const payload={ok:true,schemaVersion:3,source:'api-football',sourceSheet:'02_試合前データ',matches:[]};
const m=(id,time,mark='○')=>({fixtureId:id,kickoffAt:time,home:'FC Alpha',away:'Beta',league:'Premier League',seasonJudgement:mark,detail:{}});
test('blank is dash; true numeric/string zero is retained',()=>{
  for(const v of [null,undefined,''])assert.equal(display(v),'—');
  assert.equal(display(0),'0');assert.equal(display('0%'),'0%');
});
test('HTML values are escaped',()=>assert.equal(escape('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;'));
test('only exact V3 and new source accepted',()=>{
  assert.equal(validatePayload('matches',payload),payload);
  for(const patch of [{schemaVersion:2},{source:'7m'},{sourceSheet:'02_直近2試合前半0-0'},{ok:false}])
    assert.throws(()=>validatePayload('matches',{...payload,...patch}));
  assert.throws(()=>validatePayload('matches',{...payload,matches:[{}]}));
});
test('deduplicate Fixture IDs, sort across midnight, invalid times last',()=>{
  const a=m('1','2026-10-20T18:00:00+09:00'),b=m('2','2026-10-21T02:00:00+09:00');
  assert.deepEqual(uniqueMatches([b,m('3','invalid'),a,a]).map(m=>m.fixtureId),['1','2','3']);
});
test('team/league normalization, independent stored mark filters; no auto rejudge',()=>{
  const rows=[m('1',null,'×'),m('2',null,'判定不可'),m('3',null,'○')];
  assert.equal(filterMatches(rows,'ＦＣ ＡＬＰＨＡ','premier','×').length,1);
  assert.equal(filterMatches(rows,'beta','','判定不可')[0].fixtureId,'2');
  assert.equal(filterMatches(rows,'missing','','').length,0);
  assert.equal(filterMatches(rows,'','','').length,3);
});
test('JST rendering and invalid update labels do not invent a time',()=>{
  assert.equal(japanTime('2026-10-20T23:30:00Z'),'2026/10/21 08:30');
  assert.equal(japanTime('2026/10/20'),'—');assert.equal(japanTime('invalid'),'—');
});
test('chart uses saved percentages, null is not zero',()=>{
  assert.equal(chartNumber('71.9%'),71.9);assert.equal(chartNumber('0%'),0);
  assert.equal(chartNumber(''),null);assert.equal(chartNumber('NaN'),null);
});
test('cache is versioned, bounded, refuses old data, storage denial safe',()=>{
  const map=new Map();const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
  writeCache(storage,'matches',payload);assert.deepEqual(readCache(storage,'matches'),payload);
  assert.equal(readCache(storage,'matches',Date.now()+301000),null);
  map.set(CACHE_VERSION+':matches',JSON.stringify({at:Date.now(),data:{ok:true,matches:[]}}));
  assert.equal(readCache(storage,'matches'),null);
  writeCache({setItem(){throw Error();}},'matches',payload);
});

test('V3 cached matches without country remain compatible with optional V3.1 country',()=>{
  const old={...payload,matches:[m('1',null)]};
  const storage={getItem:()=>JSON.stringify({at:Date.now(),data:old})};
  assert.equal(readCache(storage,'matches').matches[0].country,undefined);
  const updated={...old,matches:[{...old.matches[0],country:'Vietnam'}]};
  assert.equal(validatePayload('matches',updated).matches[0].country,'Vietnam');
});
