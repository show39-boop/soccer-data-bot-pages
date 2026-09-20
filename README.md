# サッカーデータbot — Cloudflare Pages

静的フロントエンドは `public/`、GASへの読み取り専用プロキシは `functions/api/` にあります。

## Cloudflare Pages 設定

- Production branch: `main`
- Build command: なし
- Build output directory: `public`
- Root directory: `/`
- 環境変数 `GAS_API_URL`: 公開中のGAS WebアプリURL

`GAS_API_URL` はCloudflareの「Variables and Secrets」に設定し、Gitへコミットしません。

## API

- `GET /api/matches` — 02シートの表示対象試合と最終更新日時
- `GET /api/dashboard` — 05シートのダッシュボード値

どちらもPages FunctionsがGASへアクセスするため、ブラウザはGAS URLへ直接アクセスしません。
