import {display,escape as esc,japanTime,validatePayload,uniqueMatches,filterMatches,
  chartNumber,readCache,writeCache} from './model.js';

const $ = selector => document.querySelector(selector);
const state = {matches:null,dashboard:null,busy:false,errors:{},active:'matches',detailOrigin:false};
const badge = value => '<span class="badge '+(value==='○'?'yes':value==='×'?'no':'')+'">'+esc(value)+'</span>';
const fields = entries => '<dl class="detail-grid">'+entries.map(([label,value])=>
  '<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl>';
const section = (title,body) => '<section class="detail-section"><h3>'+esc(title)+'</h3>'+body+'</section>';
const oddsKeys = ['ホーム','引分','アウェー'];

function renderMatches() {
  if (!state.matches) return;
  const all = uniqueMatches(state.matches.matches);
  const rows = filterMatches(all,$('#team-search').value,$('#league-search').value,$('#season-filter').value);
  $('#match-count').innerHTML=all.length+'<small> 試合</small>';
  $('#shown-count').textContent=rows.length+' / '+all.length+' 試合';
  $('#matches-updated').textContent='最終更新 '+japanTime(state.matches.lastUpdatedAt)+' ・JST';
  $('#match-list').setAttribute('aria-busy','false');
  if (!rows.length) {
    $('#match-list').innerHTML='<p class="state">'+(all.length?'条件に一致する試合はありません。':'本日の対象試合はありません。')+'</p>';
    return;
  }
  $('#match-list').innerHTML=rows.map(m=>'<button type="button" class="match-card" data-fixture="'+esc(m.fixtureId)+'" aria-label="'+esc(m.home)+' 対 '+esc(m.away)+' の詳細を開く">'+
    '<div class="match-top"><span class="kickoff">'+esc(m.date)+' '+esc(m.time)+'</span><span class="league">'+
    (m.country?'<span class="country">'+esc(m.country)+'</span><span aria-hidden="true">/</span>':'')+
    '<span class="league-name">'+esc(m.league)+'</span></span></div>'+
    '<div class="teams"><div class="team">'+esc(m.home)+'<span class="rank">ホーム順位 '+esc(m.homeRank)+'</span></div><span class="versus">VS</span><div class="team">'+esc(m.away)+'<span class="rank">アウェー順位 '+esc(m.awayRank)+'</span></div></div>'+
    '<div class="match-odds">'+oddsKeys.map(k=>'<div><span>'+k+'平均</span><strong>'+esc(m.detail['平均オッズ_'+k])+'</strong></div>').join('')+'</div>'+
    '<div class="match-bottom"><span>順位差 '+esc(m.rankGap)+'</span><span>進行度 '+badge(m.seasonJudgement)+'</span><span>'+esc(m.status)+'</span></div>'+
    '<span class="detail-hint"><span>試合前データを見る</span><span aria-hidden="true">↗</span></span></button>').join('');
}

function detailHtml(m) {
  const d=m.detail;
  const odds='<div class="scroll"><table class="data-table detail-table"><thead><tr><th>1X2オッズ</th><th>ホーム</th><th>引分</th><th>アウェー</th></tr></thead><tbody>'+
    ['平均','中央値'].map(type=>'<tr><td>'+type+'</td>'+oddsKeys.map(k=>'<td>'+esc(d[type+'オッズ_'+k])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  const recent=[1,2].map(i=>'<div class="h2h-item"><time>直近'+i+' ・'+esc(d['H2H直近'+i+'_試合日'])+'</time>'+esc(d['H2H直近'+i+'_ホーム'])+' vs '+esc(d['H2H直近'+i+'_アウェー'])+'<br>前半 '+esc(d['H2H直近'+i+'_前半'])+'　結果 '+esc(d['H2H直近'+i+'_結果'])+'</div>').join('');
  return (m.country?'<div class="detail-country">'+esc(m.country)+'</div>':'')+
    '<div class="detail-subtitle detail-league">'+esc(m.league)+'</div><h2 id="detail-title">'+esc(m.home)+'<br><small>vs</small> '+esc(m.away)+'</h2>'+
    '<div class="detail-subtitle detail-kickoff">'+esc(m.date)+' '+esc(m.time)+' JST</div>'+badge(m.seasonJudgement)+
    fields([['ホーム順位',m.homeRank],['アウェー順位',m.awayRank],['順位差',m.rankGap],['取得状態',m.status]])+
    section('1X2オッズ',odds)+
    section('ホーム／アウェー別チーム成績',fields([
      ['ホームのホーム平均得点',d['ホーム_ホーム平均得点']],['ホームのホーム平均失点',d['ホーム_ホーム平均失点']],
      ['アウェーのアウェー平均得点',d['アウェー_アウェー平均得点']],['アウェーのアウェー平均失点',d['アウェー_アウェー平均失点']],
      ['ホーム無得点率（%）',d['ホーム_無得点率']],['アウェー無得点率（%）',d['アウェー_無得点率']]]))+
    section('直接対戦 H2H',recent+fields([['直近5試合・取得試合数',d['H2H直近5_試合数']],
      ['前半0-0数',d['H2H直近5_前半0-0数']],['前半0-0率（%）',d['H2H直近5_前半0-0率']]]))+
    section('Prediction（API保存値）',fields([
      ['ホーム攻撃',d.Prediction_ホーム攻撃],['ホーム守備',d.Prediction_ホーム守備],
      ['アウェー攻撃',d.Prediction_アウェー攻撃],['アウェー守備',d.Prediction_アウェー守備],
      ['予測得点・ホーム',d.Prediction_予測得点H],['予測得点・アウェー',d.Prediction_予測得点A],
      ['Under / Over',d.Prediction_UnderOver]]))+
    section('シーズン進行状況',fields(['ホーム','アウェー'].flatMap(team=>[
      [team+'年間予定試合数',d[team+'年間予定試合数']],[team+'消化済み試合数',d[team+'消化済み試合数']],
      [team+'残り試合数',d[team+'残り試合数']],[team+'消化率',d[team+'消化率']],[team+'残り率',d[team+'残り率']]]))+
      '<p class="condition">ホーム＋アウェー合算で15%以上消化・残り10%以上。保存済み判定：'+esc(m.seasonJudgement)+'</p>')+
    '<p class="footnote">「—」は未取得です。表示値から再判定・推測は行っていません。</p>';
}

function table(headers,rows) {
  return '<div class="scroll"><table class="data-table"><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}

function chart(rows) {
  if (!rows.length) return '<p class="state">日別データはまだありません。</p>';
  const x=i=>45+(rows.length===1?0:i*750/(rows.length-1));
  const y=n=>210-Math.max(0,Math.min(100,n))*1.75;
  const max=Math.max(1,...rows.map(r=>chartNumber(r[1])??0));
  let svg='<svg class="chart" viewBox="0 0 840 260" role="img" aria-label="直近30日の日別推移。前半ゴール率と15〜45分初ゴール率。棒は検証済み試合数。数値は下の表でも確認できます。">';
  [0,25,50,75,100].forEach(n=>{svg+='<line x1="40" y1="'+y(n)+'" x2="805" y2="'+y(n)+'" stroke="#edf1f6"/><text x="5" y="'+(y(n)+4)+'">'+n+'%</text>';});
  rows.forEach((r,i)=>{
    const count=chartNumber(r[1]);
    if(count!==null)svg+='<rect x="'+(x(i)-5)+'" y="'+(210-count/max*85)+'" width="10" height="'+(count/max*85)+'" rx="2" fill="#d6e5fc"><title>'+esc(r[0])+' 検証済み '+esc(r[1])+'試合</title></rect>';
    if(i%Math.max(1,Math.ceil(rows.length/8))===0||i===rows.length-1)svg+='<text x="'+x(i)+'" y="238" text-anchor="middle">'+esc(String(r[0]).slice(5))+'</text>';
  });
  [2,3].forEach((col,line)=>{
    const color=line===0?'#2168e8':'#44a59b';let previous=null;
    rows.forEach((r,i)=>{const n=chartNumber(r[col]);if(n===null){previous=null;return;}
      const point=[x(i),y(n)];
      if(previous)svg+='<line x1="'+previous[0]+'" y1="'+previous[1]+'" x2="'+point[0]+'" y2="'+point[1]+'" stroke="'+color+'" stroke-width="2"/>';
      svg+='<circle cx="'+point[0]+'" cy="'+point[1]+'" r="3" fill="'+color+'"><title>'+esc(r[0])+' '+(col===2?'前半ゴール率':'15〜45分初ゴール率')+' '+esc(r[col])+'</title></circle>';
      previous=point;
    });
  });
  return '<div class="scroll">'+svg+'</svg></div><div class="legend"><span><i></i>前半ゴール率</span><span><i class="second"></i>15〜45分初ゴール率</span><span><i class="bar"></i>検証済み試合数（相対表示）</span></div>';
}

function renderDashboard() {
  const d=state.dashboard;if(!d)return;
  $('#dashboard-updated').textContent='データ更新 '+(d.lastUpdatedAt?japanTime(d.lastUpdatedAt):display(d.updatedLabel))+' ・JST';
  const metric=(label,icon,suffix='')=>'<article class="metric"><div class="metric-label"><span aria-hidden="true">'+icon+'</span>'+label+'</div><strong>'+esc(d.metrics[label])+(d.metrics[label]!=null&&suffix?'<small> '+suffix+'</small>':'')+'</strong></article>';
  const smallSample=d.analysisMode==='trend';
  $('#dashboard-content').innerHTML=(smallSample?'<p class="notice">参考値・信頼度低：まだ検証母数が少ない段階です。過去の実績であり、将来の結果や予測精度を保証するものではありません。</p>':'')+
    '<div class="metrics">'+metric('累計検証試合数','📋','試合')+metric('前半ゴール率','⚽')+metric('15〜45分初ゴール率','⏱')+metric('平均初ゴール時間','◷','分')+'</div>'+
    '<div class="rates">'+metric('ホーム勝率','⌂')+metric('引き分け率','🤝')+metric('アウェー勝率','✈')+'</div>'+
    '<section class="panel"><h2>日別推移 <small>直近30日</small></h2><p class="panel-note">06に保存された日別の検証値を表示。欠損率は0%として描画しません。</p>'+chart(d.trend)+
    '<details class="chart-table"><summary>日別の数値を確認</summary>'+table(['日付','検証済み試合数','前半ゴール率','15〜45分初ゴール率'],d.trend)+'</details></section>'+
    '<section class="panel"><h2>参考傾向</h2><p class="panel-note">GASの集計結果をそのまま表示しています。母数と信頼度を併せてご確認ください。分析モード：'+esc(d.analysisMode)+'</p>'+
    (d.tendencies.length?table(['条件','母数','前半ゴール率','全体平均との差（pt）','信頼度'],d.tendencies):'<p class="state">表示できる参考傾向はまだありません。</p>')+'</section>'+
    '<p class="condition">'+esc(d.condition)+'</p><p class="definition">前半ゴール率：検証済み試合のうち、前半にゴールがあった試合の割合。<br>15〜45分初ゴール率：検証済み試合のうち、初ゴールが15〜45分に記録された試合の割合（その時間帯の全ゴール割合ではありません）。<br>'+esc(d.definition)+'</p>';
  $('#dashboard-content').setAttribute('aria-busy','false');
}

function route() {
  const match=location.hash.match(/^#match\/(\d+)$/);
  state.active=location.hash==='#dashboard'?'dashboard':'matches';
  ['matches','dashboard'].forEach(page=>{
    $('#'+page).hidden=page!==state.active;
    $('#tab-'+page).setAttribute('aria-pressed',String(page===state.active));
  });
  if(match&&state.matches){
    const m=state.matches.matches.find(m=>m.fixtureId===match[1]);
    if(m){$('#detail-content').innerHTML=detailHtml(m);if(!$('#match-detail').open)$('#match-detail').showModal();}
    else {$('#feedback').textContent='この試合は現在の一覧にありません。';if($('#match-detail').open)$('#match-detail').close();}
  } else if($('#match-detail').open)$('#match-detail').close();
}

function closeDetail() {
  if(state.detailOrigin){state.detailOrigin=false;history.back();}
  else location.hash='matches';
}

async function load(kind) {
  try {
    const response=await fetch('/api/'+kind,{cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw new Error('データ取得に失敗しました。');
    const data=validatePayload(kind,await response.json());
    state[kind]=data;delete state.errors[kind];
    if(kind==='matches')renderMatches();else renderDashboard();
    try {writeCache(sessionStorage,kind,data);} catch { /* storage denied; rendering is unaffected */ }
  } catch {
    state.errors[kind]=true;
    if(!state[kind]) {
      const root=$(kind==='matches'?'#match-list':'#dashboard-content');
      root.innerHTML='<p class="state error">データを取得できませんでした。<br>上部の「↻ 更新」から再試行してください。</p>';
      root.setAttribute('aria-busy','false');
      $(kind==='matches'?'#matches-updated':'#dashboard-updated').textContent='更新日時を確認できません';
    }
  }
}

async function refresh() {
  if(state.busy)return;
  state.busy=true;$('#refresh').disabled=true;$('#refresh').textContent='更新中…';
  $('#feedback').textContent='最新データを確認しています…';
  await Promise.all([load('matches'),load('dashboard')]);
  $('#feedback').innerHTML=Object.keys(state.errors).length?'<p class="feedback-message">最新データを取得できない画面があります。取得済み表示は以前のデータです。時間をおいて更新してください。</p>':'';
  state.busy=false;$('#refresh').disabled=false;$('#refresh').textContent='↻ 更新';route();
}

document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{location.hash=button.dataset.page;}));
['team-search','league-search','season-filter'].forEach(id=>$('#'+id).addEventListener('input',renderMatches));
$('#match-list').addEventListener('click',event=>{const card=event.target.closest('[data-fixture]');if(card){state.detailOrigin=true;location.hash='match/'+card.dataset.fixture;}});
$('#close-detail').addEventListener('click',closeDetail);
$('#match-detail').addEventListener('cancel',event=>{event.preventDefault();closeDetail();});
$('#match-detail').addEventListener('click',event=>{if(event.target===$('#match-detail')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDetail();}});
$('#refresh').addEventListener('click',refresh);
window.addEventListener('hashchange',route);
for(const kind of ['matches','dashboard']) {
  try {state[kind]=readCache(sessionStorage,kind);} catch { /* storage denied */ }
}
if(state.matches)renderMatches();if(state.dashboard)renderDashboard();route();
refresh();
