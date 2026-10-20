# サッカーデータbot V3.0

既存公開URL： https://soccer-data-bot-pages.pages.dev

閲覧専用。静的UIは `public/`、既存APIのプロキシは `functions/api/`、
GASに追加した読み取り専用APIのソースは `gas/SoccerV3ReadApi.gs`。

## データ契約

- `/api/matches` → GAS `api=v3-matches` → `02_試合前データ`
- `/api/dashboard` → GAS `api=v3-dashboard` → `06_公開用ダッシュボード`
- 読み取り対象はAPI-Football専用スプレッドシートのみ。GAS側で固定し、ブラウザから対象を指定できない。
- `schemaVersion: 3`、`source: api-football`、対象シート名を両側で検証。旧7Mデータへフォールバックしない。
- 欠損はnull、0は取得済みの0として保持。詳細はFixture IDでアプリ内ダイアログを開く。
- シーズン判定、KPI、参考傾向は保存値。Web側では判定・分析・予測確率を再計算しない。
- 日時は明示的なISOオフセットとAsia/Tokyoを使用。固定時刻の追記なし。
- GAS側は `SpreadsheetApp.openById` と読み取りのみ。API-Football取得・データ更新・トリガー操作なし。
- 既存GASの `doGet()` にV3用の2分岐を追加。旧matches/dashboardとHtmlServiceは維持。

## キャッシュと更新

同一ページ内は取得済みデータを再利用し、タブ切替・詳細の開閉・画面復帰では再取得しない。
5分以内のsessionStorageを初期表示に利用できるが、新規起動時は必ずバックグラウンド再検証する。
「↻ 更新」は両画面を再取得。失敗時は以前のデータであることを表示する。
日次11:30固定キャッシュ・固定時刻の追加・定期ポーリングは使用しない。

## 既存Cloudflare Pages設定

- Project: `soccer-data-bot-pages`（新規作成しない）
- GitHub: `show39-boop/soccer-data-bot-pages` / production branch: `main`
- Build command: 空欄 / output directory: `public` / root: `/`
- `GAS_API_URL`: 既存サーバー側環境変数。ブラウザやGitには含めない。
- production・preview両環境に設定済み。既存匿名GASデプロイのURLを維持する。
- Functionsの内部URL・例外詳細をブラウザやログへ出力しない。
- CSPによりスクリプト・通信先を同一オリジンに制限する。

## テスト

Node.js 22以降で `npm test`。有料API・本番シート書き込みは不要。
欠損/0、日付境界、保存済み判定の保持、検索・重複排除、キャッシュ期限、
旧API拒否、プロキシ秘匿、GASのヘッダー対応・読み取り専用性・06保存値保持を検証する。
実データ照合と390px/1440pxブラウザ確認は別途実施する。

## 復旧

V3導入前のGitコミット： `1782263bcab8c4007ffb36e9333160631f2f9b75`。
Cloudflareの既存プロジェクトのDeploymentsから、対応する成功済みproduction deploymentへロールバック可能。
元のdeployment ID： `a4fa8cdb-9377-4887-b18d-847cd3cb90b6`。
永続的に戻す場合はGitのV3コミットをrevertしてmainへ反映する。強制pushは不要。
GASの旧APIはそのまま残しているため、フロントのロールバック時も使用できる。
GAS自体を戻す必要がある場合だけ、既存GASデプロイのバージョンを導入前の6へ戻す。
既存バッチ・トリガー・シート構造を変更する必要はない。
