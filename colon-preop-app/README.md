# 大腸術前検査スケジューラ

君津 外科レジデント教育用の、大腸癌術前検査の NG 組み合わせチェック付きオーダー支援ツール。

## 機能

- 検査(CS/BE/CT/MRI/PET)を日別に追加してスケジュールを組む
- 同日・翌日の NG/注意組み合わせをリアルタイム検知
- 24h / 48h マトリクス表で相性を俯瞰
- 実践 Tips（基本の順序・二大トラップ・高齢者配慮など）
- スケジュールは端末に自動保存(localStorage)
- PWA 対応 / スマホのホーム画面に追加して利用可能

## ファイル構成

```
index.html              # アプリ本体
manifest.webmanifest    # PWA マニフェスト
sw.js                   # Service Worker (オフライン対応)
icon-192.png            # PWA アイコン
icon-512.png            # PWA アイコン
icon-maskable-512.png   # Android maskable アイコン
apple-touch-icon.png    # iOS ホーム画面アイコン
```

## デプロイ手順 (GitHub Pages)

1. GitHub にログイン (アカウント未作成なら https://github.com で登録)
2. 右上「＋」→「New repository」
   - Repository name: `colon-preop` など
   - **Public** を選択
   - 「Create repository」
3. 「uploading an existing file」リンクから、このフォルダ内の全ファイルをドラッグ&ドロップでアップロード
   - `index.html`, `manifest.webmanifest`, `sw.js`, `icon-*.png`, `apple-touch-icon.png`
4. 「Commit changes」
5. リポジトリの「Settings」→「Pages」
   - Source: **Deploy from a branch**
   - Branch: **main** / **/ (root)** を選択 → Save
6. 数分待つと `https://<ユーザー名>.github.io/colon-preop/` で公開される

## アップデート方法

コード変更 → GitHub で該当ファイルを編集 or 再アップロード →
`index.html` の `APP_VERSION` と `sw.js` の `CACHE_NAME` を更新
(例: v1.0.0 → v1.0.1) してコミット。Service Worker が自動で最新版を取得。

## 注意事項

- このツールは **教育目的** であり、実際のオーダー時は各施設プロトコル・患者個別要因を優先してください
- 患者情報は入力しない設計(スケジュール名のみ端末内 localStorage 保存)
- GitHub Pages の無料プランは URL が公開されます。より厳密な限定公開が必要な場合は Cloudflare Access や Basic 認証付きホスティングへの切り替えを検討してください
