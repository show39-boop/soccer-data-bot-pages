import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../gas/SoccerV3ReadApi.gs',import.meta.url),'utf8');
const labels=['取得日時','試合日','開始時刻','Fixture ID','League ID','大会','ホームTeam ID','ホーム',
  'アウェーTeam ID','アウェー','ホーム順位','アウェー順位','順位差',
  ...['平均','中央値'].flatMap(type=>['ホーム','引分','アウェー'].map(t=>type+'オッズ_'+t)),
  'ホーム_ホーム平均得点','ホーム_ホーム平均失点','アウェー_アウェー平均得点','アウェー_アウェー平均失点',
  'ホーム_無得点率','アウェー_無得点率','H2H直近5_試合数','H2H直近5_前半0-0数','H2H直近5_前半0-0率',
  ...['ホーム攻撃','ホーム守備','アウェー攻撃','アウェー守備','予測得点H','予測得点A','UnderOver'].map(k=>'Prediction_'+k),
  '取得状態','メモ',...[1,2].flatMap(n=>['試合日','ホーム','アウェー','前半','結果'].map(k=>'H2H直近'+n+'_'+k)),
  'H2H取得元','H2H確認状態','リーグ経過試合数','リーグ残り試合数','シーズン中盤判定',
  ...['ホーム','アウェー'].flatMap(t=>['年間予定試合数','消化済み試合数','残り試合数','消化率','残り率'].map(k=>t+k)),
  'シーズン進行度判定'];
function setup() {
  const row=labels.map(()=>null);for(const [k,v] of Object.entries({'取得日時':new Date('2026-10-20T00:31:23Z'),
    '試合日':'2026/10/20','開始時刻':'21:00','Fixture ID':'1641321','League ID':39,'大会':'Premier League',
    'ホーム':'Alpha','アウェー':'Beta','ホーム順位':0,'シーズン進行度判定':'判定不可',
    '取得状態':'一部取得','ホーム_ホーム平均得点':0,'Prediction_ホーム攻撃':'0%','メモ':'secret config'}))row[labels.indexOf(k)]=v;
  const dashboard=[['更新日時',new Date('2026-10-19T11:04:44Z')],['累計検証試合数','32'],['前半ゴール率','71.9%'],
    ['15〜45分初ゴール率','31.3%'],['平均初ゴール時間','23.9'],['ホーム勝率','53.1%'],['引き分け率','9.4%'],
    ['アウェー勝率','37.5%'],['対象条件','合算'],['定義','検証済み母数'],['analysisMode','trend'],
    ['日付','検証済み試合数','前半ゴール率','15〜45分初ゴール率'],['2026/10/19','0','',''],[],
    ['条件','母数','前半ゴール率','平均との差_pt','信頼度'],['test','10','90%','+18.1','低'],[],['internal','private']];
  const values={'02_試合前データ':[Array.from(labels),row], '06_公開用ダッシュボード':dashboard,
    '08_リーグマスタ':[['APIリーグID','国','大会名'],[39,'England','Master name']]};
  const reads={};
  const ss={getSheetByName:name=>{assert.ok(values[name]);return {
    getLastRow:()=>values[name].length,
    getRange:(r,c,height,width)=>{assert.deepEqual([r,c,height,width],[1,1,values[name].length,2]);
      return {getValues:()=>{reads[name]=(reads[name]||0)+1;return values[name].map(r=>r.slice(0,2));}};},
    getDataRange:()=>({getValues:()=>values[name],
    getDisplayValues:()=>values[name].map(r=>r.map(v=>v instanceof Date?'2026/10/19 20:04:44':v==null?'':String(v)))})};}};
  const ctx={Date,Utilities:{formatDate:(date,tz,format)=>{
    assert.equal(tz,'Asia/Tokyo');const iso=new Date(date.getTime()+32400000).toISOString();
    return format==='HH:mm'?iso.slice(11,16):iso.slice(0,10).replaceAll('-','/');
  }},SpreadsheetApp:{openById:id=>{assert.equal(id,'1YhrgwN6K_M7TvS87-yQ4n2XbXwmm4en0PRZjFgiHpUI');return ss;}},
    soccerWebApiJson_:data=>data};
  vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,ss,values,row,reads};
}
test('GAS reads only 02/06/08; no network/write services; missing stays null, 0 stays 0',()=>{
  const s=setup(),r=s.ctx.soccerV3Api_('matches');assert.equal(r.ok,true);assert.equal(r.matches.length,1);
  assert.equal(r.matches[0].homeRank,'0');assert.equal(r.matches[0].detail['ホーム_ホーム平均得点'],'0');
  assert.equal(r.matches[0].detail['平均オッズ_ホーム'],null);assert.equal(r.matches[0].seasonJudgement,'判定不可');
  assert.equal(r.matches[0].kickoffAt,'2026-10-20T12:00:00.000Z');
  assert.ok(!JSON.stringify(r).includes('secret config'));assert.ok(!JSON.stringify(r).includes('7msaka'));
});

test('country joins exact League ID for all seven verified master entries, once per request',()=>{
  const s=setup(),pairs=[[637,'Vietnam'],[369,'Uzbekistan'],[542,'Iraq'],[760,'Liberia'],
    [622,'Brazil'],[929,'China'],[275,'Indonesia']];
  s.values['08_リーグマスタ']=[['APIリーグID','国','大会名'],...pairs.map(([id,country])=>
    [String(id),country,'Do not replace 02 league name','','','○'])];
  s.values['02_試合前データ'].splice(1,1,...pairs.map(([id],i)=>{
    const row=Array.from(s.row);row[3]=String(100+i);row[4]=id;return row;
  }));
  const r=s.ctx.soccerV3Api_('matches');assert.equal(r.schemaVersion,3);assert.equal(r.matches.length,7);
  r.matches.forEach((m,i)=>{assert.equal(m.country,pairs[i][1]);assert.equal(m.league,'Premier League');});
  assert.equal(s.reads['08_リーグマスタ'],1);
});

test('unknown IDs, empty countries and conflicting duplicate master IDs are omitted, never inferred',()=>{
  const s=setup();s.values['08_リーグマスタ'].push([139,'Different'],[39,'Conflicting'],[39,'England']);
  assert.equal(s.ctx.soccerV3Api_('matches').matches[0].country,null);
  for(const id of [9,'039','39junk',null]){
    s.row[4]=id;assert.equal(s.ctx.soccerV3Api_('matches').matches[0].country,null);
  }
  s.row[4]=39;s.values['08_リーグマスタ']=[['APIリーグID','国'],[39,'']];
  assert.equal(s.ctx.soccerV3Api_('matches').matches[0].country,null);
});

test('dashboard does not read the league master or change its projection',()=>{
  const s=setup();delete s.values['08_リーグマスタ'];
  assert.equal(s.ctx.soccerV3Api_('dashboard').ok,true);assert.deepEqual(s.reads,{});
});
test('GAS header-based read survives reordered columns; duplicate fixtures deduplicated',()=>{
  const s=setup();s.values['02_試合前データ'].push(Array.from(s.row));
  s.values['02_試合前データ'].forEach(r=>{[r[3],r[62]]=[r[62],r[3]];});
  const r=s.ctx.soccerV3Api_('matches');assert.equal(r.matches.length,1);assert.equal(r.matches[0].fixtureId,'1641321');
});
test('empty sheet is zero matches, not a loading hang; missing required column fails safely',()=>{
  const s=setup();s.values['02_試合前データ'].pop();assert.equal(s.ctx.soccerV3Api_('matches').matches.length,0);
  s.values['02_試合前データ'][0][3]='missing';assert.equal(s.ctx.soccerV3Api_('matches').ok,false);
});
test('invalid kickoff date/time not coerced into other date or zero',()=>{
  const s=setup();assert.equal(s.ctx.soccerV3Kickoff_('2026/02/30','20:00'),null);
  assert.equal(s.ctx.soccerV3Kickoff_('2026/10/20','25:00'),null);
  assert.equal(s.ctx.soccerV3Kickoff_('',''),null);
});
test('06 values, mode, tendencies, gaps and true update time preserved; no reanalysis',()=>{
  const s=setup(),r=s.ctx.soccerV3Api_('dashboard');assert.equal(r.metrics['累計検証試合数'],'32');
  assert.equal(r.metrics['前半ゴール率'],'71.9%');assert.equal(r.trend[0][1],'0');assert.equal(r.trend[0][2],null);
  assert.equal(r.tendencies[0][4],'低');assert.equal(r.analysisMode,'trend');
  assert.equal(r.lastUpdatedAt,'2026-10-19T11:04:44.000Z');assert.ok(!JSON.stringify(r).includes('private'));
});
