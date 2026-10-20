export const CACHE_VERSION = 'soccer-bot-v3';
export const display = value => value === null || value === undefined || value === '' ? '—' : String(value);
export const escape = value => display(value).replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : null;
}

export function japanTime(value) {
  const n = timestamp(value);
  if (n === null) return '—';
  return new Intl.DateTimeFormat('ja-JP', {timeZone:'Asia/Tokyo', year:'numeric',month:'2-digit',
    day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(n);
}

export function validatePayload(kind, data) {
  const sourceSheet = kind === 'matches' ? '02_試合前データ' : '06_公開用ダッシュボード';
  if (!data || data.ok !== true || data.schemaVersion !== 3 || data.source !== 'api-football' ||
      data.sourceSheet !== sourceSheet) throw new Error('接続先のデータ形式を確認できません。');
  if (kind === 'matches' && (!Array.isArray(data.matches) || data.matches.some(m =>
    !m || !/^\d+$/.test(m.fixtureId) || !m.detail || typeof m.detail !== 'object'))) {
    throw new Error('試合データの形式が正しくありません。');
  }
  if (kind === 'dashboard' && (!data.metrics || !Array.isArray(data.trend) ||
      !Array.isArray(data.tendencies))) throw new Error('集計データの形式が正しくありません。');
  return data;
}

export function uniqueMatches(matches) {
  const seen = new Set();
  return matches.filter(m => !seen.has(m.fixtureId) && seen.add(m.fixtureId)).sort((a,b) =>
    (timestamp(a.kickoffAt) ?? Infinity) - (timestamp(b.kickoffAt) ?? Infinity) ||
    a.fixtureId.localeCompare(b.fixtureId));
}

export function filterMatches(matches, team, league, judgement) {
  const norm = s => String(s ?? '').normalize('NFKC').toLocaleLowerCase('ja-JP').trim();
  return uniqueMatches(matches).filter(m =>
    (!norm(team) || norm(m.home).includes(norm(team)) || norm(m.away).includes(norm(team))) &&
    (!norm(league) || norm(m.league).includes(norm(league))) &&
    (!judgement || m.seasonJudgement === judgement));
}

// Chart positioning only; analysis and classifications remain GAS responsibilities.
export function chartNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).replace(/%$/, '').trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export function readCache(storage, kind, now = Date.now()) {
  try {
    const cache = JSON.parse(storage.getItem(CACHE_VERSION + ':' + kind));
    if (!cache || !Number.isFinite(cache.at) || now < cache.at || now - cache.at > 5 * 60000) return null;
    return validatePayload(kind, cache.data);
  } catch { return null; }
}

export function writeCache(storage, kind, data) {
  try { storage.setItem(CACHE_VERSION + ':' + kind, JSON.stringify({at:Date.now(),data})); } catch { /* optional */ }
}
