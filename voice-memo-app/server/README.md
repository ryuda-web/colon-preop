# 話者分離プロキシ (Cloudflare Worker)

ブラウザから Deepgram API を直接呼ぶことは CORS 制約で**できません**(Deepgram公式が
明言)。この Worker が中継役となり、**Deepgram APIキーをサーバー側に保管**することで、
端末にキーを置かずに「話者分離つき文字起こし」を実現します。

- 入力: 音声ファイル(原音声のまま。Deepgramは長尺m4a/mp3/wav等を直接処理)
- 出力: `話者1: …` `話者2: …` の発話単位 JSON
- 日本語モデル `nova-3` + `diarize=true` + `keyterm`(カスタム辞書)を1回のAPIで処理

## 前提

- **Cloudflare アカウント**(無料枠でOK)
- **Deepgram アカウントとAPIキー**(https://console.deepgram.com で発行。無料クレジットあり。
  料金目安: 約 $0.0043/分。1時間で約 $0.26)
- Node.js(`wrangler` CLI 実行用)

## デプロイ手順

```bash
cd voice-memo-app/server

# 1. Wrangler(Cloudflareのデプロイツール)を用意
npm install -g wrangler
wrangler login

# 2. Deepgram APIキーをシークレットとして登録(対話で貼り付け)
wrangler secret put DEEPGRAM_API_KEY

# 3. (推奨)悪用防止: 自分のGitHub Pages URLだけ許可する
#    wrangler.toml の [vars] ALLOWED_ORIGIN コメントを外して自分のURLに変更
#    例: ALLOWED_ORIGIN = "https://ryuda-web.github.io"

# 4. デプロイ
wrangler deploy
```

デプロイ後、`https://voice-memo-diarize.<あなたのサブドメイン>.workers.dev` のような
URL が表示されます。この URL をアプリの **設定 →「話者分離サーバーURL」** に貼り付ければ
完了です。

## 動作確認

```bash
curl -X POST "https://voice-memo-diarize.<...>.workers.dev" \
  -H "Content-Type: audio/m4a" \
  --data-binary @sample.m4a
# => {"utterances":[{"speaker":0,"text":"...","start":0.1,"end":3.4}, ...]}
```

## セキュリティ注意

- `ALLOWED_ORIGIN` を自分の公開URLに設定してください。`*`(全許可)のままだと、
  URLを知った第三者があなたのWorker経由でDeepgramクレジットを消費できてしまいます。
- Deepgram キーは Cloudflare のシークレットに暗号化保存され、レスポンスにも
  コードにも現れません。
- 音声データは文字起こしのため Deepgram のサーバーへ送信されます。患者情報・個人情報を
  含む録音の取り扱いは所属組織の規程に従ってください。

## 仕組み(参考)

```
PWA(ブラウザ)
   │  音声を POST(X-Keyterms ヘッダにカスタム辞書)
   ▼
Cloudflare Worker  ── Authorization: Token <DEEPGRAM_API_KEY> ──▶ Deepgram /v1/listen
   │                                                               (nova-3, diarize, ja)
   ◀── {utterances:[{speaker,text,start}]} ────────────────────────┘
```
