// ボイスメモ文字起こし — 話者分離プロキシ (Cloudflare Worker)
//
// ブラウザから直接 Deepgram を呼ぶことは CORS 制約で不可。このWorkerが
// 中継し、Deepgram APIキーをサーバー側(Secret)に保管することで、
// 端末にキーを置かずに話者分離つき文字起こしを実現する。
//
// 必要な設定(server/README.md 参照):
//   wrangler secret put DEEPGRAM_API_KEY   … Deepgram APIキー(必須)
//   [vars] ALLOWED_ORIGIN = "https://<ユーザー名>.github.io"  … 悪用防止(推奨)

const DG_ENDPOINT = 'https://api.deepgram.com/v1/listen';
const MAX_BYTES = 90 * 1024 * 1024; // Worker無料枠の本文上限に対する安全マージン

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'POSTメソッドのみ対応' }, 405, cors);
    if (!env.DEEPGRAM_API_KEY) {
      return json({ error: 'サーバーに DEEPGRAM_API_KEY が設定されていません' }, 500, cors);
    }

    // 音声本文を取得(原音声をそのまま中継。Deepgramは長尺m4a等を直接処理可)
    const audio = await request.arrayBuffer();
    if (!audio.byteLength) return json({ error: '音声データが空です' }, 400, cors);
    if (audio.byteLength > MAX_BYTES) {
      return json({ error: `ファイルが大きすぎます(${(audio.byteLength / 1048576).toFixed(0)}MB)。約90MBまで対応` }, 413, cors);
    }

    // Deepgram パラメータ
    const reqUrl = new URL(request.url);
    const params = new URLSearchParams({
      model: reqUrl.searchParams.get('model') || 'nova-3',
      language: reqUrl.searchParams.get('language') || 'ja',
      diarize: 'true',
      smart_format: 'true',
      punctuate: 'true',
      utterances: 'true',
    });

    // カスタム辞書 → keyterm(Nova-3対応・最大100語)
    const ktHeader = request.headers.get('X-Keyterms');
    if (ktHeader) {
      let raw = '';
      try { raw = decodeURIComponent(ktHeader); } catch (_) { raw = ktHeader; }
      const terms = raw.split(/[,\n、]/).map(s => s.trim()).filter(Boolean).slice(0, 100);
      for (const t of terms) params.append('keyterm', t);
    }

    let dgRes;
    try {
      dgRes = await fetch(DG_ENDPOINT + '?' + params.toString(), {
        method: 'POST',
        headers: {
          Authorization: 'Token ' + env.DEEPGRAM_API_KEY,
          'Content-Type': request.headers.get('Content-Type') || 'application/octet-stream',
        },
        body: audio,
      });
    } catch (e) {
      return json({ error: 'Deepgramへの接続に失敗しました: ' + e.message }, 502, cors);
    }

    let data;
    try { data = await dgRes.json(); } catch (_) { data = {}; }
    if (!dgRes.ok) {
      const msg = data.err_msg || data.reason || data.error || ('Deepgramエラー (' + dgRes.status + ')');
      return json({ error: msg }, dgRes.status, cors);
    }

    // 発話単位(話者ラベル付き)に整形して返す
    const utterances = (data.results && data.results.utterances || []).map(u => ({
      speaker: u.speaker,
      text: (u.transcript || '').trim(),
      start: u.start,
      end: u.end,
    }));
    // フォールバック: utterancesが無い場合はwords[].speakerから組み立て
    if (!utterances.length) {
      const words = data.results?.channels?.[0]?.alternatives?.[0]?.words || [];
      let cur = null, buf = [];
      for (const w of words) {
        if (w.speaker !== cur) {
          if (buf.length) utterances.push({ speaker: cur, text: buf.join('') });
          cur = w.speaker; buf = [];
        }
        buf.push(w.punctuated_word || w.word || '');
      }
      if (buf.length) utterances.push({ speaker: cur, text: buf.join('') });
    }

    return json({ utterances }, 200, cors);
  },
};

function corsHeaders(request, env) {
  const allowed = env.ALLOWED_ORIGIN || '*';
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = allowed === '*' ? '*' : (origin === allowed ? origin : allowed);
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Keyterms',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });
}
