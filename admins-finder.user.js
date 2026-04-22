// ==UserScript==
// @name         Ticket History — Admin Username Finder Team B BETA
// @version      1.0.3
// @updateURL    https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/admins-finder.user.js
// @downloadURL  https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/admins-finder.user.js
// @author       You
// @match        https://th-managment.com/en/admin/backoffice/paymentsupport*
// @match        https://my-managment.com/en/admin/backoffice/paymentsupport*
// @match        https://managment.io/en/admin/backoffice/paymentsupport*
// @icon         https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/admins-finder.svg
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwiywJJFQ2VrA6An1zd5-HRVZ0De0e4F0Irt_hD95gzDZlSkU-jBHW5pvL1fHGZjnIvdg/exec';

  // ── Стили ──────────────────────────────────────────────────────────────────
const style = document.createElement('style');
  style.textContent = `
    #adm-tt {
      position: fixed;
      z-index: 99999;
      background: rgba(22, 27, 34, 0.92);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      color: #e6edf3;
      border: 1px solid rgba(50, 194, 210, 0.45);
      border-radius: 9px;
      padding: 9px 14px;
      font-family: Inter, system-ui, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      max-width: 300px;
      pointer-events: none;
      box-shadow: 0 2px 12px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04);
      opacity: 0;
      transition: opacity 0.12s;
      word-break: break-word;
    }
    #adm-tt.show { opacity: 1; }
    #adm-tt .tt-label {
      font-size: 10px;
      color: #32c2d2;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 2px;
    }
    #adm-tt .tt-login {
      font-weight: 600;
      color: #e6edf3;
    }
    #adm-tt .tt-divider {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.1);
      margin: 6px 0;
    }
    #adm-tt .tt-value {
      color: #5dd8e5;
      font-weight: 600;
    }
    #adm-tt .tt-missing {
      color: #8b949e;
      font-style: italic;
    }
    #adm-tt .tt-loading {
      color: #8b949e;
    }
  `;
  document.head.appendChild(style);

  const tt = document.createElement('div');
  tt.id = 'adm-tt';
  document.body.appendChild(tt);

  let hideTimer = null;

  function place(x, y) {
    const m = 14, tw = tt.offsetWidth || 240, th = tt.offsetHeight || 56;
    const vw = window.innerWidth, vh = window.innerHeight;
    tt.style.left = (x + m + tw > vw ? x - tw - m : x + m) + 'px';
    tt.style.top  = (y + m + th > vh ? y - th - m : y + m) + 'px';
  }

  function show(x, y, html) {
    clearTimeout(hideTimer);
    tt.innerHTML = html;
    tt.classList.add('show');
    place(x, y);
  }

  function hide() {
    hideTimer = setTimeout(() => tt.classList.remove('show'), 80);
  }

  // ── Кэш ────────────────────────────────────────────────────────────────────
  const cache = new Map();

  async function lookup(login) {
    if (cache.has(login)) return cache.get(login);
    try {
      const res  = await fetch(`${WEB_APP_URL}?q=${encodeURIComponent(login)}`);
      const json = await res.json();
      const val  = json.found ? (json.value || '—') : null;
      cache.set(login, val);
      return val;
    } catch {
      cache.set(login, false);
      return false;
    }
  }

  function buildHtml(login, state, value) {
    const header = `
      <div class="tt-label">Admin username</div>
      <div class="tt-login">${login}</div>`;
    const divider = `<hr class="tt-divider">`;
    if (state === 'loading') return header + divider + `<span class="tt-loading">⟳ загрузка…</span>`;
    if (state === 'error')   return header + divider + `<span class="tt-missing">⚠ ошибка запроса</span>`;
    if (state === 'none') return header + divider + `<span class="tt-missing">— Логин не из нашей команды</span>`;
    return header + divider + `<div class="tt-label" style="margin-top:0">Сотрудник</div><div class="tt-value">${value}</div>`;
  }

  // ── Индекс колонки Admin username ──────────────────────────────────────────
  function adminColIdx(table) {
    const ths = table.querySelectorAll('tr.table-head th, thead th');
    for (let i = 0; i < ths.length; i++)
      if (ths[i].textContent.trim().toLowerCase() === 'admin username') return i;
    return -1;
  }

  // ── Навешиваем хендлеры ─────────────────────────────────────────────────────
  function attach(table) {
    const col = adminColIdx(table);
    if (col < 0) return;

    table.querySelectorAll('tbody tr, tr:not(.table-head)').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length <= col) return;
      const cell = cells[col];
      if (cell.dataset.admBound) return;
      cell.dataset.admBound = '1';

      let active = null;

      cell.addEventListener('mouseenter', async (e) => {
        const login = cell.textContent.trim();
        if (!login) return;
        active = login;

        show(e.clientX, e.clientY, buildHtml(login, 'loading'));

        const val = await lookup(login);
        if (active !== login) return;

        if (val === false) show(e.clientX, e.clientY, buildHtml(login, 'error'));
        else if (val === null) show(e.clientX, e.clientY, buildHtml(login, 'none'));
        else show(e.clientX, e.clientY, buildHtml(login, 'found', val));
      });

      cell.addEventListener('mousemove', (e) => place(e.clientX, e.clientY));
      cell.addEventListener('mouseleave', () => { active = null; hide(); });
    });
  }

  // ── MutationObserver ───────────────────────────────────────────────────────
  new MutationObserver(() => {
    document.querySelectorAll('.modal-in-iframe table, .modal .table-vertical table').forEach(t => {
      if (t.dataset.admDone) return;
      t.dataset.admDone = '1';
      attach(t);
    });
  }).observe(document.body, { childList: true, subtree: true });

})();
