/** V3 read-only projection. No API-Football requests, writes, or analysis. */
function soccerV3Api_(kind) {
  try {
    const ss = SpreadsheetApp.openById('1YhrgwN6K_M7TvS87-yQ4n2XbXwmm4en0PRZjFgiHpUI');
    const data = kind === 'matches' ? soccerV3Matches_(ss) : soccerV3Dashboard_(ss);
    return soccerWebApiJson_(Object.assign({ ok: true, schemaVersion: 3,
      source: 'api-football', fetchedAt: new Date().toISOString() }, data));
  } catch (error) {
    // Do not serialize exception objects or internal configuration to the browser.
    return soccerWebApiJson_({ ok: false, schemaVersion: 3,
      error: 'データを取得できませんでした。時間をおいて更新してください。' });
  }
}

function soccerV3Sheet_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Required data unavailable');
  const range = sheet.getDataRange();
  return { values: range.getValues(), display: range.getDisplayValues() };
}

function soccerV3Cell_(value) {
  return value === '' || value === null || value === undefined ? null : String(value);
}

function soccerV3Date_(value, display, format) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, 'Asia/Tokyo', format);
  }
  return String(display || '').trim();
}

function soccerV3Kickoff_(date, time) {
  const d = String(date).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  const t = String(time).match(/^(\d{1,2}):(\d{2})$/);
  if (!d || !t || Number(t[1]) > 23 || Number(t[2]) > 59) return null;
  const day = d[1] + '-' + ('0' + d[2]).slice(-2) + '-' + ('0' + d[3]).slice(-2);
  const text = day + 'T' + ('0' + t[1]).slice(-2) + ':' + t[2] + ':00+09:00';
  const parsed = new Date(text);
  if (isNaN(parsed.getTime()) || Utilities.formatDate(parsed, 'Asia/Tokyo', 'yyyy/MM/dd') !==
      d[1] + '/' + ('0' + d[2]).slice(-2) + '/' + ('0' + d[3]).slice(-2)) return null;
  return parsed.toISOString();
}

function soccerV3Matches_(ss) {
  const data = soccerV3Sheet_(ss, '02_試合前データ');
  const headers = data.display[0];
  function column(label) {
    const i = headers.indexOf(label);
    if (i < 0 || headers.lastIndexOf(label) !== i) throw new Error('Invalid data contract');
    return i;
  }
  const labels = ['Fixture ID', '試合日', '開始時刻', '取得日時', '大会', 'ホーム', 'アウェー',
    'ホーム順位', 'アウェー順位', '順位差', '取得状態', 'シーズン進行度判定'];
  const columns = {};
  labels.concat(headers.filter(function (h) { return h; })).forEach(function (h) { columns[h] = column(h); });
  let latest = null;
  const seen = {};
  const matches = [];
  data.values.slice(1).forEach(function (raw, i) {
    const shown = data.display[i + 1];
    function value(label) {
      if (columns[label] === undefined) throw new Error('Missing detail column');
      return soccerV3Cell_(shown[columns[label]]);
    }
    const id = value('Fixture ID');
    if (!id || !/^\d+$/.test(id) || seen[id]) return;
    seen[id] = true;
    const stamp = raw[columns['取得日時']];
    if (stamp instanceof Date && !isNaN(stamp.getTime()) && (!latest || stamp > latest)) latest = stamp;
    const date = soccerV3Date_(raw[columns['試合日']], value('試合日'), 'yyyy/MM/dd');
    const time = soccerV3Date_(raw[columns['開始時刻']], value('開始時刻'), 'HH:mm');
    const detail = {};
    // Explicit allowlist: internal notes/configuration/URLs never leave the server.
    [
      '平均オッズ_ホーム', '平均オッズ_引分', '平均オッズ_アウェー',
      '中央値オッズ_ホーム', '中央値オッズ_引分', '中央値オッズ_アウェー',
      'ホーム_ホーム平均得点', 'ホーム_ホーム平均失点',
      'アウェー_アウェー平均得点', 'アウェー_アウェー平均失点', 'ホーム_無得点率', 'アウェー_無得点率',
      'H2H直近5_試合数', 'H2H直近5_前半0-0数', 'H2H直近5_前半0-0率',
      'Prediction_ホーム攻撃', 'Prediction_ホーム守備', 'Prediction_アウェー攻撃', 'Prediction_アウェー守備',
      'Prediction_予測得点H', 'Prediction_予測得点A', 'Prediction_UnderOver',
      'H2H直近1_試合日', 'H2H直近1_ホーム', 'H2H直近1_アウェー', 'H2H直近1_前半', 'H2H直近1_結果',
      'H2H直近2_試合日', 'H2H直近2_ホーム', 'H2H直近2_アウェー', 'H2H直近2_前半', 'H2H直近2_結果',
      'ホーム年間予定試合数', 'ホーム消化済み試合数', 'ホーム残り試合数', 'ホーム消化率', 'ホーム残り率',
      'アウェー年間予定試合数', 'アウェー消化済み試合数', 'アウェー残り試合数', 'アウェー消化率', 'アウェー残り率'
    ].forEach(function (label) { detail[label] = value(label); });
    matches.push({ fixtureId: id, date: date || null, time: time || null,
      kickoffAt: soccerV3Kickoff_(date, time), league: value('大会'), home: value('ホーム'), away: value('アウェー'),
      homeRank: value('ホーム順位'), awayRank: value('アウェー順位'), rankGap: value('順位差'),
      seasonJudgement: value('シーズン進行度判定'), status: value('取得状態'), detail: detail });
  });
  matches.sort(function (a, b) {
    return (a.kickoffAt ? Date.parse(a.kickoffAt) : Infinity) -
      (b.kickoffAt ? Date.parse(b.kickoffAt) : Infinity) || a.fixtureId.localeCompare(b.fixtureId);
  });
  return { sourceSheet: '02_試合前データ', matches: matches,
    lastUpdatedAt: latest ? latest.toISOString() : null };
}

function soccerV3Dashboard_(ss) {
  const data = soccerV3Sheet_(ss, '06_公開用ダッシュボード');
  const rows = data.display;
  function metric(label) {
    const row = rows.find(function (r) { return r[0] === label; });
    if (!row) throw new Error('Missing dashboard metric');
    return soccerV3Cell_(row[1]);
  }
  function table(firstHeader, width) {
    const index = rows.findIndex(function (r) { return r[0] === firstHeader; });
    if (index < 0) throw new Error('Missing dashboard section');
    const output = [];
    for (let i = index + 1; i < rows.length && rows[i][0]; i++) {
      output.push(rows[i].slice(0, width).map(soccerV3Cell_));
    }
    return output;
  }
  const metrics = {};
  ['累計検証試合数', '前半ゴール率', '15〜45分初ゴール率', '平均初ゴール時間',
    'ホーム勝率', '引き分け率', 'アウェー勝率'].forEach(function (label) { metrics[label] = metric(label); });
  const updateRow = rows.findIndex(function (r) { return r[0] === '更新日時'; });
  const rawUpdate = updateRow >= 0 ? data.values[updateRow][1] : null;
  return { sourceSheet: '06_公開用ダッシュボード', metrics: metrics,
    lastUpdatedAt: rawUpdate instanceof Date && !isNaN(rawUpdate.getTime()) ? rawUpdate.toISOString() : null,
    updatedLabel: metric('更新日時'), condition: metric('対象条件'), definition: metric('定義'),
    analysisMode: metric('analysisMode'), trend: table('日付', 4), tendencies: table('条件', 5) };
}
