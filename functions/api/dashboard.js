const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
};

export async function onRequestGet({ env }) {
  if (!env.GAS_API_URL) {
    return Response.json({ error: 'API configuration is missing' }, { status: 500, headers: JSON_HEADERS });
  }

  try {
    const url = new URL(env.GAS_API_URL);
    url.searchParams.set('api', 'dashboard');
    const upstream = await fetch(url, { redirect: 'follow', headers: { Accept: 'application/json' } });
    if (!upstream.ok) throw new Error(`GAS returned ${upstream.status}`);
    const data = await upstream.json();
    return Response.json(data, { headers: JSON_HEADERS });
  } catch (error) {
    console.error('dashboard proxy failed', error);
    return Response.json({ error: 'ダッシュボードを取得できませんでした' }, { status: 502, headers: JSON_HEADERS });
  }
}
