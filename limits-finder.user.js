// ==UserScript==
// @name         Limit's Finder Team B BETA
// @namespace    team-bestie
// @version      1.0.2
// @updateURL    https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/limits-finder.user.js
// @downloadURL  https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/limits-finder.user.js
// @author       You
// @description  Выделение текста в Query Subagent → инлайн-поиск по таблицам Confluence
// @match        https://th-managment.com/en/admin/backoffice/paymentsupport*
// @match        https://my-managment.com/en/admin/backoffice/paymentsupport*
// @match        https://managment.io/en/admin/backoffice/paymentsupport*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=th-managment.com
// @grant        GM_xmlhttpRequest
// @connect      doc.office.lan
// ==/UserScript==

(function () {
  'use strict';

  const CONFLUENCE_PAGE =
    'https://doc.office.lan/spaces/MENA/pages/373073072/%D0%9B%D0%98%D0%9C%D0%98%D0%A2%D0%AB+%D0%A0%D0%A3%D0%A7%D0%9D%D0%AB%D0%95';

  /* ─── Styles ──────────────────────────────────────────────────── */
  const css = `
    #qs-popup {
      position: fixed;
      z-index: 999999;
      display: none;
      flex-direction: column;
      background: #fcfcfd;
      border: 1px solid #dbdfe6;
      border-radius: 10px;
      box-shadow: 0 2px 6px rgba(59,67,84,0.08), 0 8px 20px rgba(59,67,84,0.13);
      overflow: visible;
      font-family: "Open Sans", Tahoma, Arial, sans-serif;
      font-size: 12px;
      color: #3b4354;
      width: 340px;
      max-height: calc(100vh - 32px);
      pointer-events: auto;
      animation: qs-appear 0.16s cubic-bezier(0.34,1.4,0.64,1) both;
      transform-origin: top center;
      /* Скрываем выход за border-radius */
      clip-path: inset(0 round 10px);
    }
    @keyframes qs-appear {
      from { opacity:0; transform:scale(0.88) translateY(-4px); }
      to   { opacity:1; transform:scale(1)    translateY(0);    }
    }
    #qs-popup.qs-hiding {
      animation: qs-vanish 0.1s ease both;
    }
    @keyframes qs-vanish {
      to { opacity:0; transform:scale(0.94) translateY(-3px); }
    }

    /* Шапка */
    #qs-header {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 9px 12px 8px;
      background: linear-gradient(135deg, #32c2d2 0%, #269eab 100%);
      flex-shrink: 0;
    }
    #qs-header-icon {
      width: 22px; height: 22px;
      border-radius: 5px;
      background: rgba(255,255,255,0.2);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    #qs-header-icon svg { width: 12px; height: 12px; }
    #qs-header-text { flex: 1; min-width: 0; }
    #qs-label {
      font-size: 9px; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
      color: rgba(255,255,255,0.8); margin-bottom: 1px;
    }
    #qs-query-preview {
      font-size: 11.5px; font-weight: 600;
      color: #fff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #qs-open-link {
      color: rgba(255,255,255,0.7);
      text-decoration: none;
      flex-shrink: 0;
      display: flex; align-items: center;
      transition: color 0.1s;
    }
    #qs-open-link:hover { color: #fff; }
    #qs-open-link svg { width: 13px; height: 13px; }

    /* Состояния: загрузка / не найдено */
    #qs-state {
      display: none;
      align-items: center;
      gap: 8px;
      padding: 14px 14px;
      color: #65738f;
      font-size: 11.5px;
    }
    #qs-state svg { width: 15px; height: 15px; flex-shrink: 0; }
    #qs-state.loading { color: #32c2d2; }
    #qs-state.empty   { color: #9fa8bc; }

    /* Навигация между результатами */
    #qs-nav {
      display: none;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: #f6f7f8;
      border-bottom: 1px solid #edeef2;
      flex-shrink: 0;
    }
    #qs-nav-counter {
      flex: 1;
      font-size: 11px; font-weight: 600;
      color: #65738f;
    }
    #qs-nav-counter b { color: #3b4354; }
    .qs-nav-btn {
      width: 24px; height: 24px;
      border-radius: 5px;
      border: 1px solid #dbdfe6;
      background: #fcfcfd;
      color: #3b4354;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      padding: 0;
      transition: background 0.1s, border-color 0.1s;
    }
    .qs-nav-btn:hover    { background: #edeef2; border-color: #bdc3d1; }
    .qs-nav-btn:disabled { opacity: 0.35; cursor: default; }
    .qs-nav-btn svg { width: 11px; height: 11px; }

    /* Таблица результата */
    #qs-result {
      display: none;
      flex-direction: column;
      overflow-y: auto;
      overscroll-behavior: contain;
      min-height: 0;        /* позволяет flex-child сжиматься */
      flex-shrink: 1;
      flex-grow: 1;
    }
    /* Тонкий скроллбар */
    #qs-result::-webkit-scrollbar { width: 4px; }
    #qs-result::-webkit-scrollbar-track { background: transparent; }
    #qs-result::-webkit-scrollbar-thumb { background: #dbdfe6; border-radius: 4px; }
    #qs-result::-webkit-scrollbar-thumb:hover { background: #bdc3d1; }
    .qs-row {
      display: flex;
      border-bottom: 1px solid #edeef2;
    }
    .qs-row:last-child { border-bottom: none; }
    .qs-col-label {
      width: 110px;
      flex-shrink: 0;
      padding: 7px 10px;
      background: #f6f7f8;
      border-right: 1px solid #edeef2;
      font-size: 10px;
      font-weight: 700;
      color: #65738f;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      line-height: 1.3;
      word-break: break-word;
      display: flex;
      align-items: flex-start;
    }
    .qs-col-value {
      flex: 1;
      padding: 7px 10px;
      font-size: 11.5px;
      color: #3b4354;
      line-height: 1.45;
      word-break: break-word;
      min-width: 0;
    }
    /* Заголовок раздела */
    #qs-section-heading {
      display: none;
      align-items: center;
      gap: 6px;
      padding: 7px 12px 6px;
      background: rgba(50,194,210,0.07);
      border-bottom: 1px solid rgba(50,194,210,0.15);
      font-size: 11px;
      font-weight: 700;
      color: #269eab;
      line-height: 1.3;
    }
    #qs-section-heading svg {
      width: 11px; height: 11px;
      flex-shrink: 0;
      opacity: 0.7;
    }

    /* Подсветка найденного слова в первой строке */
    .qs-match-hl {
      background: #fde047;
      color: #1c1917;
      border-radius: 2px;
      padding: 0 1px;
      font-weight: 700;
    }
    /* Зачёркнутые строки — серые */
    .qs-row.qs-striked .qs-col-value {
      color: #9fa8bc;
      text-decoration: line-through;
    }
    .qs-row.qs-striked .qs-col-label { color: #bdc3d1; }

    /* Стрелочка */
    #qs-arrow {
      position: fixed;
      z-index: 999998;
      display: none;
      pointer-events: none;
      width: 12px; height: 7px;
    }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ─── Markup ──────────────────────────────────────────────────── */
  const popup = document.createElement('div');
  popup.id = 'qs-popup';
  popup.innerHTML = `
    <div id="qs-header">
      <div id="qs-header-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <div id="qs-header-text">
        <div id="qs-label">Query Subagent</div>
        <div id="qs-query-preview">…</div>
      </div>
      <a id="qs-open-link" href="${CONFLUENCE_PAGE}" target="_blank" rel="noopener" title="Открыть страницу Confluence">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </a>
    </div>

    <div id="qs-state">
      <svg id="qs-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
      <span id="qs-state-text"></span>
    </div>

    <div id="qs-nav">
      <span id="qs-nav-counter"></span>
      <button class="qs-nav-btn" id="qs-prev" title="Предыдущий (←)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <button class="qs-nav-btn" id="qs-next" title="Следующий (→)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>

    <div id="qs-section-heading">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="15" y2="12"/>
        <line x1="3" y1="18" x2="18" y2="18"/>
      </svg>
      <span id="qs-section-heading-text"></span>
    </div>
    <div id="qs-result"></div>
  `;
  document.body.appendChild(popup);

  const arrowEl = document.createElement('div');
  arrowEl.id = 'qs-arrow';
  arrowEl.innerHTML = `<svg width="12" height="7" viewBox="0 0 12 7">
    <path id="qs-arrow-path" d="M6 0L12 7H0Z" fill="#fcfcfd"/>
  </svg>`;
  document.body.appendChild(arrowEl);

  /* ─── State ───────────────────────────────────────────────────── */
  let hideTimer   = null;
  let currentText = '';
  let results     = []; // [{headers[], cells[], striked}]
  let curIdx      = 0;
  let cfCache     = null; // кэш DOM страницы Confluence
  let cfLoading   = false;

  /* ─── Confluence fetch ────────────────────────────────────────── */
  function fetchConfluence() {
    return new Promise((resolve, reject) => {
      if (cfCache) { resolve(cfCache); return; }
      if (cfLoading) {
        // Ждём пока загрузится
        const check = setInterval(() => {
          if (cfCache) { clearInterval(check); resolve(cfCache); }
        }, 100);
        setTimeout(() => { clearInterval(check); reject(new Error('timeout')); }, 15000);
        return;
      }
      cfLoading = true;
      GM_xmlhttpRequest({
        method: 'GET',
        url: CONFLUENCE_PAGE,
        onload(resp) {
          const parser = new DOMParser();
          const doc    = parser.parseFromString(resp.responseText, 'text/html');
          cfCache   = doc;
          cfLoading = false;
          resolve(doc);
        },
        onerror(e) {
          cfLoading = false;
          reject(e);
        }
      });
    });
  }

  /* ─── Find h2 heading before a table ─────────────────────────── */
  // Идём вверх по previousElementSibling, пропускаем параграфы и div-обёртки,
  // останавливаемся на h2/h3 или если встретили другую таблицу / крупный блок
  function findHeadingBefore(tableEl, doc) {
    // Берём все h2 на странице в порядке документа
    const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4'));
    if (!headings.length) return null;

    // Находим последний заголовок, который идёт ДО таблицы в DOM
    let best = null;
    for (const h of headings) {
      // DOCUMENT_POSITION_FOLLOWING = 4 — h стоит ПЕРЕД tableEl
      const pos = h.compareDocumentPosition(tableEl);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
        best = h; // каждый следующий подходящий перезаписывает — в итоге возьмём ближайший
      }
    }

    if (!best) return null;

    const clone = best.cloneNode(true);
    clone.querySelectorAll(
      '.copy-heading-link-container, button, .aui-icon, [aria-label]'
    ).forEach(n => n.remove());
    return clone.textContent.trim().replace(/\s+/g, ' ');
  }

  /* ─── Search in parsed DOM ────────────────────────────────────── */
  function searchTables(doc, query) {
    const q = query.trim().toLowerCase();
    const found = [];

    // Все таблицы на странице
    const tables = doc.querySelectorAll('table');

    tables.forEach(table => {
      // Собираем заголовки из thead или первой строки
      let headers = [];
      const theadCells = table.querySelectorAll('thead td, thead th');
      if (theadCells.length) {
        theadCells.forEach(th => headers.push(th.textContent.trim()));
      } else {
        const firstRow = table.querySelector('tr');
        if (firstRow) {
          firstRow.querySelectorAll('td, th').forEach(c => headers.push(c.textContent.trim()));
        }
      }

      // Заголовок раздела перед таблицей
      const sectionHeading = findHeadingBefore(table, doc);

      // Строки данных
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (!cells.length) return;

        // Ищем совпадение в ПЕРВОМ столбце
        const firstCellText = cells[0].textContent.trim().toLowerCase();
        if (!firstCellText.includes(q)) return;

        // Зачёркнута ли вся строка?
        const isStriked = !!cells[0].querySelector('s');

        // Собираем данные всех ячеек
        const cellData = [];
        cells.forEach((td, i) => {
          cellData.push({
            label: headers[i] || `Столбец ${i + 1}`,
            html:  td.innerHTML,
            text:  td.textContent.trim(),
          });
        });

        found.push({
          cells: cellData,
          striked: isStriked,
          raw: cells[0].textContent.trim(),
          heading: sectionHeading,
        });
      });
    });

    return found;
  }

  /* ─── Render result ───────────────────────────────────────────── */
  function highlightQuery(text, query) {
    const q = query.trim();
    if (!q) return escHtml(text);
    const regex = new RegExp(escRx(q), 'gi');
    return escHtml(text).replace(regex, m => `<span class="qs-match-hl">${m}</span>`);
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function escRx(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Очищает HTML от стилей Confluence, оставляет читаемый текст со структурой
  function cleanHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;

    // Убираем скрытые .tj-source дубли если есть
    div.querySelectorAll('.tj-source, .tj-hidden').forEach(el => el.remove());

    // Текст с переносами для <p> и <br>
    div.querySelectorAll('p').forEach(p => {
      p.insertAdjacentText('afterend', '\n');
    });
    div.querySelectorAll('br').forEach(br => {
      br.replaceWith('\n');
    });

    return div.textContent.trim().replace(/\n{3,}/g, '\n\n');
  }

  function renderResult(idx) {
    const res    = results[idx];
    const resultEl = document.getElementById('qs-result');
    resultEl.innerHTML = '';

    // Заголовок раздела
    const headingWrap = document.getElementById('qs-section-heading');
    const headingText = document.getElementById('qs-section-heading-text');
    if (res.heading) {
      headingText.textContent = res.heading;
      headingWrap.style.display = 'flex';
    } else {
      headingWrap.style.display = 'none';
    }

    res.cells.forEach((cell, i) => {
      const text = i === 0
        ? res.raw  // первый столбец — оригинальный текст
        : cleanHtml(cell.html);

      if (!text.trim()) return;

      const row = document.createElement('div');
      row.className = 'qs-row' + (res.striked ? ' qs-striked' : '');

      const label = document.createElement('div');
      label.className = 'qs-col-label';
      label.textContent = cell.label;

      const value = document.createElement('div');
      value.className = 'qs-col-value';

      if (i === 0) {
        // Подсвечиваем совпадение
        value.innerHTML = highlightQuery(text, currentText);
      } else {
        // Простой текст с переносами
        value.style.whiteSpace = 'pre-line';
        value.textContent = text;
      }

      row.appendChild(label);
      row.appendChild(value);
      resultEl.appendChild(row);
    });

    resultEl.style.display = 'flex';
    // Сброс скролла в начало после отрисовки
    requestAnimationFrame(() => { resultEl.scrollTop = 0; });
  }

  function renderNav() {
    const nav = document.getElementById('qs-nav');
    const counter = document.getElementById('qs-nav-counter');

    if (results.length > 1) {
      nav.style.display = 'flex';
      counter.innerHTML = `<b>${curIdx + 1}</b> из <b>${results.length}</b>`;
      document.getElementById('qs-prev').disabled = results.length < 2;
      document.getElementById('qs-next').disabled = results.length < 2;
    } else {
      nav.style.display = 'none';
    }
  }

  function showState(type, text, iconPath) {
    const stateEl = document.getElementById('qs-state');
    const iconEl  = document.getElementById('qs-state-icon');
    const textEl  = document.getElementById('qs-state-text');
    stateEl.className = type;
    stateEl.style.display = 'flex';
    iconEl.innerHTML = iconPath;
    textEl.textContent = text;
    document.getElementById('qs-result').style.display = 'none';
    document.getElementById('qs-nav').style.display = 'none';
  }

  function hideState() {
    document.getElementById('qs-state').style.display = 'none';
  }

  /* ─── Main search flow ────────────────────────────────────────── */
  async function runSearch(query) {
    currentText = query.trim();
    document.getElementById('qs-query-preview').textContent =
      currentText.length > 36 ? currentText.slice(0, 36) + '…' : currentText;

    // Показываем загрузку
    showState('loading', 'Загружаю страницу…',
      '<circle cx="12" cy="12" r="9" stroke-dasharray="28 57" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite"/></circle>');

    try {
      const doc = await fetchConfluence();
      results   = searchTables(doc, currentText);
      curIdx    = 0;

      if (!results.length) {
        showState('empty', `«${currentText}» не найдено на странице`,
          '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>');
        return;
      }

      hideState();
      renderResult(curIdx);
      renderNav();

    } catch (e) {
      showState('empty', 'Ошибка загрузки страницы Confluence',
        '<circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>');
    }
  }

  /* ─── Nav buttons ─────────────────────────────────────────────── */
  document.getElementById('qs-prev').addEventListener('click', () => {
    curIdx = ((curIdx - 1) + results.length) % results.length;
    renderResult(curIdx);
    renderNav();
  });
  document.getElementById('qs-next').addEventListener('click', () => {
    curIdx = (curIdx + 1) % results.length;
    renderResult(curIdx);
    renderNav();
  });

  /* ─── Column detection ────────────────────────────────────────── */
  function getQuerySubagentCell(node) {
    const td = node?.closest?.('td');
    if (!td) return null;
    const tr    = td.closest('tr');
    const table = td.closest('table');
    if (!tr || !table) return null;
    const headers = table.querySelectorAll('thead th');
    const tdIndex = Array.from(tr.children).indexOf(td);
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].textContent.trim().toLowerCase().includes('query subagent')) {
        return i === tdIndex ? td : null;
      }
    }
    return null;
  }

  /* ─── Popup position ──────────────────────────────────────────── */
  function placePopup(selRect) {
    popup.style.display = 'flex';
    popup.classList.remove('qs-hiding');

    const gap    = 10;
    const margin = 8;
    const maxH   = window.innerHeight - margin * 2;

    // Сначала сбрасываем max-height чтобы измерить естественную высоту
    popup.style.maxHeight = maxH + 'px';

    const pw = popup.offsetWidth  || 340;
    const ph = Math.min(popup.offsetHeight || 80, maxH);

    // Горизонталь
    let left = selRect.left + selRect.width / 2 - pw / 2;
    if (left + pw > window.innerWidth - margin) left = window.innerWidth - pw - margin;
    if (left < margin) left = margin;

    // Вертикаль: пробуем сверху, потом снизу, потом прижимаем к краю
    let top   = selRect.top - ph - gap;
    let below = false;
    if (top < margin) {
      // Попробуем снизу
      const topIfBelow = selRect.bottom + gap;
      if (topIfBelow + ph <= window.innerHeight - margin) {
        top   = topIfBelow;
        below = true;
      } else {
        // Не влезает ни сверху ни снизу — прижимаем к верху с отступом
        top   = margin;
        below = false;
      }
    }

    popup.style.left = left + 'px';
    popup.style.top  = top  + 'px';

    // Стрелочка
    const ax = Math.min(Math.max(selRect.left + selRect.width / 2 - 6, left + 12), left + pw - 18);
    document.getElementById('qs-arrow-path')?.setAttribute('fill', below ? '#32c2d2' : '#fcfcfd');
    const svg = arrowEl.querySelector('svg');
    if (below) {
      arrowEl.style.top  = (top - 7) + 'px';
      arrowEl.style.left = ax + 'px';
      svg.style.transform = 'rotate(0deg)';
    } else {
      arrowEl.style.top  = (top + ph) + 'px';
      arrowEl.style.left = ax + 'px';
      svg.style.transform = 'rotate(180deg)';
    }
    arrowEl.style.display = 'block';
  }

  function showPopup(text, rect) {
    clearTimeout(hideTimer);
    popup.querySelector('#qs-query-preview').textContent = text;
    // Сначала показываем попап с заглушкой, потом подгружаем
    placePopup(rect);
    runSearch(text).then(() => {
      // После загрузки данных пересчитываем позицию (высота изменилась)
      placePopup(rect);
    });
  }

  function hidePopup() {
    clearTimeout(hideTimer);
    popup.classList.add('qs-hiding');
    arrowEl.style.display = 'none';
    hideTimer = setTimeout(() => {
      popup.style.display = 'none';
      popup.classList.remove('qs-hiding');
      // Сбрасываем результаты
      document.getElementById('qs-result').style.display = 'none';
      document.getElementById('qs-nav').style.display = 'none';
      document.getElementById('qs-state').style.display = 'none';
      results = []; curIdx = 0;
    }, 110);
  }

  /* ─── Selection events ────────────────────────────────────────── */
  document.addEventListener('mouseup', (e) => {
    if (popup.contains(e.target)) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { hidePopup(); return; }
      const text = sel.toString().trim();
      if (!text) { hidePopup(); return; }
      const ae = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
      const fe = sel.focusNode?.nodeType  === 3 ? sel.focusNode.parentElement  : sel.focusNode;
      if (!getQuerySubagentCell(ae) && !getQuerySubagentCell(fe)) { hidePopup(); return; }
      showPopup(text, sel.getRangeAt(0).getBoundingClientRect());
    }, 15);
  });

  document.addEventListener('mousedown', (e) => {
    // Не скрываем если клик внутри попапа или на стрелочке
    if (popup.contains(e.target) || arrowEl.contains(e.target)) return;
    hidePopup();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hidePopup(); return; }
    if (popup.style.display !== 'none' && results.length > 1) {
      if (e.key === 'ArrowLeft')  { document.getElementById('qs-prev').click(); }
      if (e.key === 'ArrowRight') { document.getElementById('qs-next').click(); }
    }
  });
  document.addEventListener('scroll', (e) => {
    // Не закрываем если скроллят внутри попапа
    if (popup.contains(e.target)) return;
    hidePopup();
  }, { passive: true, capture: true });

  // Предзагрузка при наведении на колонку Query Subagent
  document.addEventListener('mouseover', (e) => {
    const ae = e.target?.nodeType === 3 ? e.target.parentElement : e.target;
    if (getQuerySubagentCell(ae) && !cfCache) {
      fetchConfluence().catch(() => {});
    }
  }, { passive: true });

})();
