const HEADERS = { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store',
  'x-content-type-options':'nosniff' };

export async function proxyGas(kind, env) {
  try {
    const url = new URL(env.GAS_API_URL);
    if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' ||
        !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) throw new Error('Invalid configuration');
    url.search = '';
    url.searchParams.set('api', 'v3-' + kind);
    const response = await fetch(url, {redirect:'follow',signal:AbortSignal.timeout(20000),
      headers:{Accept:'application/json'},cache:'no-store'});
    if (!response.ok) throw new Error('Upstream unavailable');
    const data = await response.json();
    const sheet = kind === 'matches' ? '02_試合前データ' : '06_公開用ダッシュボード';
    if (data.ok !== true || data.schemaVersion !== 3 || data.source !== 'api-football' ||
        data.sourceSheet !== sheet) throw new Error('Invalid upstream contract');
    const fields = kind === 'matches' ? ['matches','lastUpdatedAt'] :
      ['metrics','lastUpdatedAt','updatedLabel','condition','definition','analysisMode','trend','tendencies'];
    const output = {ok:true,schemaVersion:3,source:'api-football',sourceSheet:sheet,fetchedAt:data.fetchedAt};
    for (const field of fields) output[field] = data[field];
    return Response.json(output, {headers:HEADERS});
  } catch {
    return Response.json({error:'データを取得できませんでした。時間をおいて更新してください。'},
      {status:502,headers:HEADERS});
  }
}
