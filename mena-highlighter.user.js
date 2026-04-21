// ==UserScript==
// @name         Duplicate Highlighre Team B
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Подсветка дублей, бейджи, кнопки копирования
// @author       you
// @match        https://th-managment.com/en/admin/backoffice/paymentsupport
// @match        https://my-managment.com/en/admin/backoffice/paymentsupport
// @match        https://managment.io//en/admin/backoffice/paymentsupport
// @icon         https://www.google.com/s2/favicons?sz=64&domain=th-managment.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    (function () {

  const SKIP_SUBSTRINGS         = ['refferal', 'ticket id', 'external status', 'processing date'];
  const FULL_ONLY_SUBSTRINGS    = ['transaction id', 'file', 'amount'];
  const PART_ALLOWED_SUBSTRINGS = ['unique transfer number', 'inside comment'];
  const NO_COPY_SUBSTRINGS      = ['actions', 'ticket history'];
  const FILE_SUBSTRING = 'file';
        
  if (!document.getElementById('b-copy-style')) {
    const style = document.createElement('style');
    style.id = 'b-copy-style';
    style.textContent = `
      .b-wrap { position: relative; }
      .b-copy-btn {
        position: absolute; top: 0; right: 0;
        display: none; align-items: center; justify-content: center;
        width: 20px; height: 20px; border-radius: 4px;
        border: .5px solid #D3D1C7; background: #fff;
        cursor: pointer; opacity: 0; transition: opacity .15s;
        user-select: none; z-index: 10; padding: 0;
      }
      .b-wrap:hover .b-copy-btn { display: flex; opacity: 1; }
      .b-copy-btn svg { pointer-events: none; }
      .b-copy-btn.copied { border-color: #3B6D11; background: #EAF3DE; }
      .b-copy-btn.copied svg path { stroke: #3B6D11; }
    `;
    document.head.appendChild(style);
  }

  const copyIconSm  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  const checkIconSm = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;

  // ── Сброс ──────────────────────────────────────────────────────────────

  function resetTable(root) {
    root.querySelectorAll('td[data-b-wrapped]').forEach(td => {
      const vRow = td.querySelector('.b-value');
      if (vRow) while (vRow.firstChild) td.insertBefore(vRow.firstChild, td.firstChild);
      td.querySelector('.b-wrap')?.remove();
      delete td.dataset.bWrapped;
    });
    root.querySelectorAll('td span').forEach(span => { span.style.cssText = ''; });
    root.querySelectorAll('mark.b-mark').forEach(m => m.replaceWith(document.createTextNode(m.textContent)));
    root.querySelectorAll('tbody tr td').forEach(td => { td.style.background = ''; });
    root.querySelectorAll('td a').forEach(a => { a.style.cssText = ''; });
  }

  // ── Проверка фильтров ──────────────────────────────────────────────────

  function hasActiveFilters() {
    const placeholders = ['User ID', 'Ticket ID', 'Transaction ID', 'Unique transfer number'];
    return placeholders.some(ph => {
      const input = document.querySelector(`.filter input[placeholder="${ph}"]`);
      return input && input.value.trim() !== '';
    });
  }

  // ── run ────────────────────────────────────────────────────────────────

  function run() {
    if (!hasActiveFilters()) return;

    const root = document.querySelector('.table-wrapper');
    if (!root) return;

    resetTable(root);

    const headers = Array.from(root.querySelectorAll('thead th'));
    const rows    = Array.from(root.querySelectorAll('tbody tr'));
    if (!rows.length) return;

    function headerLabel(i)    { return headers[i]?.innerText.trim().toLowerCase() || ''; }
    function shouldSkip(td)    { return SKIP_SUBSTRINGS.some(s => headerLabel(td.cellIndex).includes(s)); }
    function isPartAllowed(td) { return PART_ALLOWED_SUBSTRINGS.some(s => headerLabel(td.cellIndex).includes(s)); }
    function noCopy(td)        { return NO_COPY_SUBSTRINGS.some(s => headerLabel(td.cellIndex).includes(s)); }
    function getSpan(td)       { return td?.querySelector('span'); }
    function normalize(t)      { return (t || '').replace(/\s+/g,' ').trim().toLowerCase(); }
    function extractNums(t)    { return t.match(/\d{5,}/g) || []; }

    function diff(a, b) {
      let d = 0;
      for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) d++; if (d > 4) return d; }
      return d;
    }

    let fullCI = 0, partCI = 0;
    const fullColorMap = new Map();
    const partColorMap = new Map();
    const GOLDEN = 137.508;

    function isRedHue(h) { return h <= 20 || h >= 340; }

    function nextHue(ci) {
      let h, attempts = 0;
      do { h = (ci * GOLDEN) % 360; if (isRedHue(h)) ci++; attempts++; }
      while (isRedHue(h) && attempts < 20);
      return { h, ci: ci + 1 };
    }

    function getFullColor(key) {
      if (!fullColorMap.has(key)) { const { h, ci } = nextHue(fullCI); fullCI = ci; fullColorMap.set(key, h); }
      const h = fullColorMap.get(key);
      return { bg: `hsl(${h},55%,90%)`, text: `hsl(${h},55%,28%)`, border: `hsl(${h},45%,80%)` };
    }

    function getPartColor(key) {
      if (!partColorMap.has(key)) { const { h, ci } = nextHue(partCI); partCI = ci; partColorMap.set(key, h); }
      const h = partColorMap.get(key);
      return { bg: `hsl(${h},55%,90%)`, text: `hsl(${h},55%,28%)`, border: `hsl(${h},45%,80%)` };
    }

    // ── Кнопка копирования ────────────────────────────────────────────────

    function makeCopyBtn(plainText) {
      const btn = document.createElement('button');
      btn.className = 'b-copy-btn';
      btn.title = 'Копировать';
      btn.innerHTML = copyIconSm;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        navigator.clipboard.writeText(plainText).then(() => {
          btn.classList.add('copied');
          btn.innerHTML = checkIconSm;
          setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = copyIconSm; }, 1500);
        });
      });
      return btn;
    }

    // ── Бейдж ────────────────────────────────────────────────────────────

    function makeBadge(type, label) {
      const C = {
        full:    { dot:'#378ADD', bg:'#E6F1FB', color:'#185FA5', border:'#B5D4F4' },
        part:    { dot:'#EF9F27', bg:'#FAEEDA', color:'#854F0B', border:'#FAC775' },
        closed:  { dot:'rgba(255,255,255,.8)', bg:'#E24B4A', color:'#fff', border:'#A32D2D' },
        wallet:  { dot:'#888780', bg:'#F1EFE8', color:'#5F5E5A', border:'#D3D1C7' },
        suspdup: { dot:'rgba(255,255,255,.8)', bg:'#7C3AED', color:'#fff', border:'#5B21B6' },
      }[type];
      const b = document.createElement('span');
      b.className = `b-badge b-${type}`;
      b.style.cssText = `display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:500;padding:2px 7px;border-radius:20px;letter-spacing:.02em;white-space:nowrap;background:${C.bg};color:${C.color};border:.5px solid ${C.border};flex-shrink:0;user-select:none;pointer-events:none;`;
      const dot = document.createElement('span');
      dot.style.cssText = `display:inline-block;width:6px;height:6px;border-radius:50%;background:${C.dot};flex-shrink:0;`;
      b.appendChild(dot);
      b.appendChild(document.createTextNode(label));
      return b;
    }

    function ensureWrap(td, plainText) {
      if (td.dataset.bWrapped) return;
      td.dataset.bWrapped = '1';
      const wrap = document.createElement('div');
      wrap.className = 'b-wrap';
      wrap.style.cssText = `display:flex;flex-direction:column;gap:5px;align-items:flex-start;${noCopy(td) ? '' : 'padding-right:22px;'}`;
      const vRow = document.createElement('div');
      vRow.className = 'b-value';
      vRow.style.cssText = 'display:flex;align-items:center;';
      while (td.firstChild) vRow.appendChild(td.firstChild);
      const bRow = document.createElement('div');
      bRow.className = 'b-badges';
      bRow.style.cssText = 'display:flex;align-items:center;gap:4px;flex-wrap:wrap;';
      wrap.appendChild(vRow);
      wrap.appendChild(bRow);
      if (!noCopy(td)) wrap.appendChild(makeCopyBtn(plainText));
      td.appendChild(wrap);
    }

    function addBadge(td, type, label, plainText) {
      if (!td || td.querySelector(`.b-${type}`)) return;
      ensureWrap(td, plainText);
      td.querySelector('.b-badges').appendChild(makeBadge(type, label));
    }

    // ── Шаг 1: plainText ДО изменений ─────────────────────────────────────

    const spanText = new Map();
    rows.forEach(row => {
      row.querySelectorAll('td').forEach(td => {
        const span = getSpan(td);
        if (span) spanText.set(span, span.innerText);
      });
    });

// ── Шаг 2: FULL ───────────────────────────────────────────────────────

    const fullMap = new Map();

    function splitLinks(text) {
      return text.split('\n').map(s => s.trim()).filter(Boolean);
    }

    // Обычные столбцы — считаем всю ячейку целиком
    rows.forEach(row => {
      row.querySelectorAll('td').forEach(td => {
        if (shouldSkip(td)) return;
        if (headerLabel(td.cellIndex).includes(FILE_SUBSTRING)) return;
        const span = getSpan(td);
        if (!span) return;
        const text = normalize(spanText.get(span) || '');
        if (text) fullMap.set(text, (fullMap.get(text) || 0) + 1);
      });
    });

    // Файловые столбцы — считаем каждую ссылку отдельно
    rows.forEach(row => {
      row.querySelectorAll('td').forEach(td => {
        if (!headerLabel(td.cellIndex).includes(FILE_SUBSTRING)) return;
        const span = getSpan(td);
        if (!span) return;
        const anchors = Array.from(span.querySelectorAll('a'));
        if (anchors.length > 0) {
          // Регистрируем по тексту и href каждой ссылки
          anchors.forEach(a => {
            const t = normalize(a.innerText || a.textContent || '');
            const h = normalize(a.getAttribute('href') || '');
            if (t) fullMap.set(t, (fullMap.get(t) || 0) + 1);
            if (h) fullMap.set(h, (fullMap.get(h) || 0) + 1);
          });
        } else {
          // Нет <a> — регистрируем по строкам текста
          splitLinks(spanText.get(span) || '').forEach(link => {
            const key = normalize(link);
            if (key) fullMap.set(key, (fullMap.get(key) || 0) + 1);
          });
        }
      });
    });

    // Применяем Full — обычные столбцы
    rows.forEach(row => {
      row.querySelectorAll('td').forEach(td => {
        if (shouldSkip(td)) return;
        if (headerLabel(td.cellIndex).includes(FILE_SUBSTRING)) return;
        const span = getSpan(td);
        if (!span) return;
        const text  = normalize(spanText.get(span) || '');
        const plain = spanText.get(span) || '';
        if ((fullMap.get(text) || 0) > 1) {
          const c = getFullColor(text);
          span.style.cssText = `background:${c.bg};color:${c.text};border:.5px solid ${c.border};padding:2px 6px;border-radius:4px;font-weight:500;display:inline-block;cursor:text;`;
          addBadge(td, 'full', 'Full', plain);
        }
      });
    });

    // Применяем Full — файловые столбцы
    rows.forEach(row => {
      row.querySelectorAll('td').forEach(td => {
        if (!headerLabel(td.cellIndex).includes(FILE_SUBSTRING)) return;
        const span = getSpan(td);
        if (!span) return;
        const plain = spanText.get(span) || '';
        const anchors = Array.from(span.querySelectorAll('a'));

        if (anchors.length > 0) {
          // Есть гиперссылки — стилизуем <a> не трогая DOM
          let anyMatch = false;
          anchors.forEach(a => {
            const t = normalize(a.innerText || a.textContent || '');
            const h = normalize(a.getAttribute('href') || '');
            const key = (fullMap.get(t) || 0) > 1 ? t
                      : (fullMap.get(h) || 0) > 1 ? h
                      : null;
            if (!key) return;
            anyMatch = true;
            const c = getFullColor(key);
            a.style.cssText = `background:${c.bg};color:${c.text};border:.5px solid ${c.border};border-radius:4px;padding:1px 5px;font-weight:500;display:block;margin-bottom:2px;`;
          });
          if (anyMatch) addBadge(td, 'full', 'Full', plain);

        } else {
          // Нет гиперссылок — заменяем текст через mark
          const links = splitLinks(plain);
          const matchedLinks = links.filter(link => (fullMap.get(normalize(link)) || 0) > 1);
          if (!matchedLinks.length) return;
          let html = plain;
          matchedLinks.forEach(link => {
            const c = getFullColor(normalize(link));
            const pill = `<mark class="b-mark" style="background:${c.bg};color:${c.text};border:.5px solid ${c.border};border-radius:4px;padding:1px 5px;font-weight:500;pointer-events:none;display:inline;">${link}</mark>`;
            html = html.split(link).join(pill);
          });
          span.innerHTML = html;
          addBadge(td, 'full', 'Full', plain);
        }
      });
    });

    // ── Шаг 3: PART ───────────────────────────────────────────────────────

    const all = [];
    rows.forEach(row => {
      row.querySelectorAll('td').forEach(td => {
        if (!isPartAllowed(td)) return;
        const span = getSpan(td);
        if (!span) return;
        const plain = spanText.get(span) || '';
        extractNums(plain).forEach(num => {
          all.push({ value: num, cell: td, span, plain, rowIndex: td.closest('tr')?.rowIndex });
        });
      });
    });

    const spanHtml  = new Map();
    const partDone  = new Map();
    all.forEach(({ span }) => {
      if (!spanHtml.has(span)) spanHtml.set(span, spanText.get(span) || span.innerText);
    });

    function applyPartHighlight(entry, other, pairKey) {
      if (!partDone.has(entry.span)) partDone.set(entry.span, new Set());
      const done = partDone.get(entry.span);
      if (done.has(entry.value)) return;
      done.add(entry.value);
      let html = spanHtml.get(entry.span);
      const idx = html.indexOf(entry.value);
      if (idx === -1) return;
      const c = getPartColor(pairKey);
      const highlighted = entry.value.split('').map((ch, ci) =>
        ch === other[ci]
          ? `<mark class="b-mark" style="background:${c.bg};color:${c.text};border:.5px solid ${c.border};border-radius:2px;padding:0 2px;pointer-events:none;">${ch}</mark>`
          : ch
      ).join('');
      spanHtml.set(entry.span, html.slice(0, idx) + highlighted + html.slice(idx + entry.value.length));
      addBadge(entry.cell, 'part', 'Part', entry.plain);
    }

    // Глобально по всей таблице
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (a.value.length !== b.value.length) continue;
        if (a.value === b.value) continue;
        if (diff(a.value, b.value) > 4) continue;
        const pairKey = [a.value, b.value].sort().join('|');
        applyPartHighlight(a, b.value, pairKey);
        applyPartHighlight(b, a.value, pairKey);
      }
    }

    // Внутри строки (между разными allowed-столбцами)
    rows.forEach(row => {
      const rowCandidates = all.filter(e => e.rowIndex === row.rowIndex);
      for (let i = 0; i < rowCandidates.length; i++) {
        for (let j = i + 1; j < rowCandidates.length; j++) {
          const a = rowCandidates[i], b = rowCandidates[j];
          if (a.cell === b.cell) continue;
          if (a.value.length !== b.value.length) continue;
          if (a.value === b.value) continue;
          if (diff(a.value, b.value) > 4) continue;
          const pairKey = [a.value, b.value].sort().join('|');
          applyPartHighlight(a, b.value, pairKey);
          applyPartHighlight(b, a.value, pairKey);
        }
      }
    });

    spanHtml.forEach((html, span) => {
      if (partDone.has(span)) span.innerHTML = html;
    });

    // ── Шаг 4: SUSPECTED DUPLICATE ────────────────────────────────────────

    const subagentIdx = headers.findIndex(h => h.innerText.trim().toLowerCase().includes('query subagent'));
    const amountIdx   = headers.findIndex(h => h.innerText.trim().toLowerCase() === 'amount');
    const ticketIdIdx = headers.findIndex(h => h.innerText.trim().toLowerCase().includes('ticket id'));

    if (subagentIdx !== -1 && amountIdx !== -1 && ticketIdIdx !== -1) {
      const rowData = rows.map(row => {
        const tds        = row.querySelectorAll('td');
        const subagentTd = tds[subagentIdx];
        const amountTd   = tds[amountIdx];
        const ticketTd   = tds[ticketIdIdx];
        return {
          ticketTd,
          subagentVal: normalize(getSpan(subagentTd)?.innerText || subagentTd?.innerText || ''),
          amountVal:   normalize(getSpan(amountTd)?.innerText   || amountTd?.innerText   || ''),
          ticketVal:   (getSpan(ticketTd)?.innerText || ticketTd?.innerText || '').trim(),
        };
      });

      const dupGroups = new Map();
      rowData.forEach((data, idx) => {
        if (!data.subagentVal || !data.amountVal) return;
        const key = `${data.subagentVal}|||${data.amountVal}`;
        if (!dupGroups.has(key)) dupGroups.set(key, []);
        dupGroups.get(key).push(idx);
      });

      dupGroups.forEach(indices => {
        if (indices.length < 2) return;
        indices.forEach(i => {
          const { ticketTd, ticketVal } = rowData[i];
          if (!ticketTd) return;
          const otherTickets = indices
            .filter(j => j !== i)
            .map(j => rowData[j].ticketVal)
            .filter(Boolean)
            .join(', ');
          const plain = spanText.get(getSpan(ticketTd)) || getSpan(ticketTd)?.innerText || '';
          addBadge(ticketTd, 'suspdup', `Suspected Duplicate ×${indices.length} | ${otherTickets}`, plain);
        });
      });
    }

    // ── CLOSED ───────────────────────────────────────────────────────────

    const CLOSED_LIST = new Set([
      'duplicated ticket (m)', 'credited (m)', 'closed (m)',
      'credited (fraud) (m)', 'approved by agent (m)',
      'credited to another account by agent (m)',
      'adjusted the amount (deposit) (m)',
      'closed', 'credited',
    ]);

    const statusIdx = headers.findIndex(h => h.innerText.trim().toLowerCase() === 'external status');
    if (statusIdx !== -1) {
      rows.forEach(row => {
        const td   = row.querySelectorAll('td')[statusIdx];
        const span = td?.querySelector('span');
        if (!span || !CLOSED_LIST.has(span.innerText.trim().toLowerCase())) return;
        row.querySelectorAll('td').forEach(cell => { cell.style.background = 'rgba(226,75,74,0.14)'; });
        addBadge(td, 'closed', 'Closed', spanText.get(span) || span.innerText);
      });
    }

    // ── WALLET ───────────────────────────────────────────────────────────

    const walletIdx = headers.findIndex(h => h.innerText.trim().toLowerCase() === "user's wallet");
    if (walletIdx !== -1) {
      rows.forEach(row => {
        const td   = row.querySelectorAll('td')[walletIdx];
        const span = td?.querySelector('span');
        if (!span) return;
        const plain = spanText.get(span) || span.innerText;
        const len = plain.trim().length;
        if (len > 0) addBadge(td, 'wallet', `${len} символов`, plain);
      });
    }

    // ── Кнопка копирования во всех остальных ячейках ──────────────────────

    rows.forEach(row => {
      row.querySelectorAll('td').forEach(td => {
        if (noCopy(td) || td.dataset.bWrapped) return;
        const span = getSpan(td);
        if (!span) return;
        const plain = spanText.get(span) || span.innerText;
        if (!plain.trim()) return;
        ensureWrap(td, plain);
      });
    });
  }

  // ── Запуск ─────────────────────────────────────────────────────────────

  run();

  document.addEventListener('mousedown', e => {
    if (e.target.closest('button.btn.btn-success')) setTimeout(run, 800);
  });

})();
})();
