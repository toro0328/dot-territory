(() => {
  const GAME_KEY = 'komorebi-territory-demo-v1';

  function gameState() {
    try { return JSON.parse(localStorage.getItem(GAME_KEY) || '{}'); }
    catch { return {}; }
  }

  function makeStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .feedback-jump{white-space:nowrap}
      #feedbackDialog .dialog-inner{width:min(92vw,520px);max-height:min(82vh,680px);overflow:auto}
      #feedbackDialog .dialog-close{appearance:none;-webkit-appearance:none;width:28px;height:28px;padding:0;display:grid;place-items:center;background:linear-gradient(#3b5649,#2a4037);border:1px solid #71815c;border-radius:4px;color:#f1d783;font:700 17px/1 'DotGothic16',sans-serif;box-shadow:inset 0 -2px #1d2f29,0 1px 3px #0e1715;cursor:pointer}
      .feedback-form{display:grid;gap:9px;margin-top:10px}.feedback-form label{display:grid;gap:5px;font-size:9px;color:#d8ddbf}.feedback-form select,.feedback-form textarea{width:100%;box-sizing:border-box;background:#172a26;border:1px solid #60765f;color:#f0e7c2;border-radius:4px;padding:8px;font:10px/1.5 'DotGothic16',sans-serif}.feedback-form textarea{min-height:140px;resize:vertical}.feedback-form small{color:#9eab98;line-height:1.5}.feedback-status{min-height:18px;margin:2px 0 0;font-size:9px;line-height:1.5;color:#e7d78d}.feedback-status.error{color:#f0a59c}.feedback-reward{padding:7px 8px;background:#1f352d;border-left:3px solid #ddbf58;color:#e9dfad;font-size:9px;line-height:1.5}
      @media(max-width:600px){.feedback-jump{font-size:7px;padding:4px 6px}#feedbackDialog .dialog-inner{width:94vw;padding:16px}.feedback-form textarea{min-height:120px}}
    `;
    document.head.appendChild(style);
  }

  function buildUi() {
    const top = document.querySelector('.top-actions');
    if (!top || document.getElementById('feedbackBtn')) return;

    const button = document.createElement('button');
    button.id = 'feedbackBtn';
    button.type = 'button';
    button.className = 'small-button feedback-jump';
    button.textContent = '💬 感想・報告';
    top.appendChild(button);

    const dialog = document.createElement('dialog');
    dialog.id = 'feedbackDialog';
    dialog.innerHTML = `
      <div class="dialog-inner">
        <button class="dialog-close" type="button" aria-label="閉じる">×</button>
        <p class="eyebrow">FEEDBACK / REPORT</p>
        <h2>感想・報告を送る</h2>
        <p class="tile-description">遊んで気づいたこと、不具合、要望などを送れます。保存された内容は公開ページには表示されません。</p>
        <div class="feedback-reward">送信できたら、お礼に <strong>+1,000pt</strong>。ありがとう！</div>
        <form class="feedback-form">
          <label>種類
            <select id="feedbackKind">
              <option value="impression">感想</option>
              <option value="bug">不具合報告</option>
              <option value="request">要望</option>
              <option value="other">その他</option>
            </select>
          </label>
          <label>内容
            <textarea id="feedbackMessage" maxlength="1200" required placeholder="ここに入力してください"></textarea>
          </label>
          <small>※ 公開ページからは読み返せない、投稿専用の保存先へ送る設計です。</small>
          <p id="feedbackStatus" class="feedback-status" role="status" aria-live="polite"></p>
          <button id="feedbackSubmit" class="primary-button" type="submit">送信する</button>
        </form>
      </div>`;
    document.body.appendChild(dialog);

    button.addEventListener('click', () => dialog.showModal());
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    dialog.querySelector('form').addEventListener('submit', submitFeedback);
  }

  async function submitFeedback(event) {
    event.preventDefault();
    const dialog = document.getElementById('feedbackDialog');
    const status = document.getElementById('feedbackStatus');
    const submit = document.getElementById('feedbackSubmit');
    const message = document.getElementById('feedbackMessage').value.trim();
    const kind = document.getElementById('feedbackKind').value;
    const cfg = window.KOMOREBI_FEEDBACK_CONFIG || {};

    status.classList.remove('error');
    if (!message) {
      status.textContent = '内容を入力してね。';
      status.classList.add('error');
      return;
    }
    if (!cfg.supabaseUrl || !cfg.anonKey) {
      status.textContent = '非公開データベースの接続準備中です。まだ送信はされていません。';
      status.classList.add('error');
      return;
    }

    const id = (crypto.randomUUID?.() || `feedback-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const state = gameState();
    const payload = {
      client_report_id: id,
      player_name: String(state.name || '匿名の開拓者').slice(0, 40),
      report_type: kind,
      message: message.slice(0, 1200),
      client_time: new Date().toISOString(),
      page_path: location.pathname,
      game_label: 'komorebi-frontier-beta'
    };

    submit.disabled = true;
    status.textContent = '送信中…';
    try {
      const base = String(cfg.supabaseUrl).replace(/\/$/, '');
      const table = encodeURIComponent(cfg.table || 'feedback_reports');
      const response = await fetch(`${base}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          apikey: cfg.anonKey,
          Authorization: `Bearer ${cfg.anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      window.__komorebiFeedbackReward = { id: `feedback:${id}`, amount: 1000 };
      document.dispatchEvent(new Event('pointerdown'));
      document.getElementById('feedbackMessage').value = '';
      status.textContent = '送ってくれてありがとう！ +1,000ptをプレゼントしました。';
      setTimeout(() => { if (dialog.open) dialog.close(); }, 1800);
    } catch (error) {
      console.error(error);
      status.textContent = '送信に失敗しました。ポイントは増えていません。通信状態を確認してもう一度試してね。';
      status.classList.add('error');
    } finally {
      submit.disabled = false;
    }
  }

  makeStyles();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUi);
  else buildUi();
})();
