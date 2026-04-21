// ==UserScript==
// @name         Edit Helper Team B
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @updateURL    https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/apply-confirm.user.js
// @downloadURL  https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/apply-confirm.user.js
// @description  Двойное подтверждение + шаблоны комментариев
// @author       You
// @match        https://th-managment.com/en/admin/backoffice/paymentsupport
// @match        https://my-managment.com/en/admin/backoffice/paymentsupport
// @match        https://managment.io//en/admin/backoffice/paymentsupport
// @icon         https://www.google.com/s2/favicons?sz=64&domain=th-managment.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const STATUSES_REQUIRE_TXN = [
    '219 Credited (M)',
    '221 Credited (Fraud) (M)',
    '225 Approved by agent (M)',
    '231 Adjusted the amount (Deposit) (M)'
  ];

  const STATUSES_WITH_COMMENTS = ['209', '207', '210', '216', '243'];

  const COMMENTS_209 = [
    { label: 'Корректировка даты', full: 'Sir, please check the date and time. They have been corrected.', hasInput: false },
    { label: 'Другой субагент', full: 'Sir, please check this ticket. The payment was made to your wallet.', hasInput: false },
    { label: 'Корректировка суммы', full: 'Sir, please check the amount. It has been corrected.', hasInput: false },
    { label: 'Ошибка агента (найдено зачисление)', full: null, hasInput: true, inputPlaceholder: 'Номер транзакции', template: (val) => `Sir, please check ${val || '(вставьте транзакцию)'} and set the right status.` },
    { label: 'Ошибка агента (не найдено зачисление)', full: 'Sir, please attach the approved transaction related to the payment from the ticket or set the right status.', hasInput: false }
  ];

  const COMMENTS_207 = [
    { label: 'Ниже лимита', full: 'Sir, the amount is below the limit, please refund the money to the user and provide a screenshot.' },
    { label: 'Выше лимита', full: 'Sir, the amount is above the limit, please refund the money to the user and provide a screenshot.' }
  ];

  const COMMENT_243_TEMPLATE = (val) => `Credited to another account - ${val || '(номер транзакции)'}`;

  function withPrefix(text) {
    if (!text) return text;
    return '// ' + text;
  }

  const css = `
    .--cmt-trigger-wrap {
      display: block;
      width: 100%;
      margin: 8px 0 6px 0;
    }
    .--cmt-trigger-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border: none;
      border-radius: 6px;
      background: #32c2d2;
      color: #fff;
      font-family: Inter, system-ui, sans-serif;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.02em;
      transition: background 0.18s, box-shadow 0.18s;
      box-shadow: 0 2px 6px rgba(50,194,210,0.30);
    }
    .--cmt-trigger-btn:hover {
      background: #269eab;
      box-shadow: 0 3px 10px rgba(50,194,210,0.40);
    }
    .--cmt-trigger-btn svg { flex-shrink: 0; opacity: 0.9; }

    #__cmt-overlay {
      position: fixed;
      inset: 0;
      background: rgba(59,67,84,0.45);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Inter, system-ui, sans-serif;
      font-size: 12px;
      color: #535353;
    }
    #__cmt-modal {
      background: #fcfcfd;
      border-radius: 10px;
      border: 1px solid #dbdfe6;
      padding: 22px 26px;
      max-width: 480px;
      width: 92%;
      box-sizing: border-box;
      max-height: 90vh;
      overflow-y: auto;
      scrollbar-width: thin;
    }
    #__cmt-modal .modal-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #edeef2;
    }
    #__cmt-modal .modal-header-icon {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: #32c2d2;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    #__cmt-modal h3 { margin: 0; font-size: 13px; font-weight: 600; color: #3b4354; line-height: 1.3; }
    #__cmt-modal .modal-subtitle { font-size: 11px; color: #9fa8bc; margin-top: 2px; }
    #__cmt-modal .section-label {
      font-size: 10px;
      font-weight: 700;
      color: #9fa8bc;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 14px 0 7px;
    }
    #__cmt-modal .comment-options { display: flex; flex-direction: column; gap: 5px; }
    #__cmt-modal .comment-option {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 9px 12px;
      border: 1px solid #dbdfe6;
      border-radius: 7px;
      cursor: pointer;
      background: #fff;
      text-align: left;
      font-family: Inter, system-ui, sans-serif;
      font-size: 12px;
      color: #3b4354;
      line-height: 1.4;
      width: 100%;
      box-sizing: border-box;
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
      position: relative;
    }
    #__cmt-modal .comment-option:hover { border-color: #32c2d2; background: #f8feff; box-shadow: 0 2px 6px rgba(50,194,210,0.10); }
    #__cmt-modal .comment-option.selected { border-color: #32c2d2; background: #edfbfc; }
    #__cmt-modal .comment-option.selected::before {
      content: '';
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 3px;
      background: #32c2d2;
      border-radius: 7px 0 0 7px;
    }
    #__cmt-modal .opt-label { font-weight: 600; color: #3b4354; font-size: 12px; }
    #__cmt-modal .opt-preview { color: #9fa8bc; font-size: 11px; margin-top: 3px; line-height: 1.5; font-family: Inter, system-ui, sans-serif; }
    #__cmt-modal .txn-input-wrap {
      display: none;
      flex-direction: column;
      gap: 4px;
      margin-top: 9px;
      padding-top: 9px;
      border-top: 1px dashed #dbdfe6;
    }
    #__cmt-modal .txn-input-wrap.visible { display: flex; }
    #__cmt-modal .txn-input-wrap label { font-size: 10px; color: #798495; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    #__cmt-modal .field-inp {
      width: 100%;
      box-sizing: border-box;
      padding: 6px 10px;
      border: 1px solid #dbdfe6;
      border-radius: 6px;
      font-family: Inter, system-ui, sans-serif;
      font-size: 12px;
      color: #3b4354;
      background: #fff;
      outline: none;
    }
    #__cmt-modal .field-inp:focus { border-color: #32c2d2; box-shadow: 0 0 0 2px rgba(50,194,210,0.12); }
    #__cmt-modal .preview-wrap {
      margin-top: 12px;
      border-radius: 7px;
      overflow: hidden;
      border: 1px solid #dbdfe6;
    }
    #__cmt-modal .preview-label {
      padding: 5px 10px;
      background: #f0f1f4;
      font-size: 10px;
      font-weight: 700;
      color: #9fa8bc;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-bottom: 1px solid #dbdfe6;
    }
    #__cmt-modal .preview-box {
      padding: 9px 11px;
      background: #f6f7f8;
      font-size: 12px;
      color: #3b4354;
      line-height: 1.6;
      word-break: break-word;
      white-space: pre-wrap;
      min-height: 30px;
      font-family: Inter, system-ui, sans-serif;
    }
    #__cmt-modal .radio-row {
      display: flex;
      gap: 0;
      margin-bottom: 12px;
      border: 1px solid #dbdfe6;
      border-radius: 7px;
      overflow: hidden;
    }
    #__cmt-modal .radio-row label {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 7px 10px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 500;
      color: #798495;
      background: #f6f7f8;
      transition: background 0.15s, color 0.15s;
      border-right: 1px solid #dbdfe6;
    }
    #__cmt-modal .radio-row label:last-child { border-right: none; }
    #__cmt-modal .radio-row input[type=radio] { display: none; }
    #__cmt-modal .radio-row label:has(input:checked) { background: #edfbfc; color: #2674ab; font-weight: 600; }
    #__cmt-modal .ticket-ids { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
    #__cmt-modal .ticket-id-row { display: flex; gap: 6px; align-items: center; }
    #__cmt-modal .ticket-id-row input {
      flex: 1; padding: 6px 10px; border: 1px solid #dbdfe6; border-radius: 6px;
      font-family: Inter, system-ui, sans-serif; font-size: 12px; color: #3b4354;
      background: #fff; outline: none; box-sizing: border-box;
    }
    #__cmt-modal .ticket-id-row input:focus { border-color: #32c2d2; }
    #__cmt-modal .btn-rm {
      padding: 5px 9px; border: 1px solid #dbdfe6; border-radius: 5px;
      background: #f6f7f8; color: #9fa8bc; cursor: pointer; font-size: 14px;
      line-height: 1; font-family: Inter, system-ui, sans-serif; transition: all 0.15s;
    }
    #__cmt-modal .btn-rm:hover { background: #fce8e8; color: #ea8886; border-color: #f5c0c0; }
    #__cmt-modal .btn-add-ticket {
      padding: 5px 12px; border: 1px dashed #bdc3d1; border-radius: 6px;
      background: transparent; color: #9fa8bc; cursor: pointer; font-size: 11px;
      font-family: Inter, system-ui, sans-serif; margin-bottom: 12px; transition: all 0.15s;
    }
    #__cmt-modal .btn-add-ticket:hover { border-color: #32c2d2; color: #32c2d2; background: #f8feff; }
    #__cmt-modal .txn-approved-wrap { display: none; flex-direction: column; gap: 4px; margin-bottom: 10px; }
    #__cmt-modal .txn-approved-wrap.visible { display: flex; }
    #__cmt-modal .txn-approved-wrap label { font-size: 10px; color: #798495; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    #__cmt-modal .btn-row {
      display: flex; gap: 8px; justify-content: flex-end;
      margin-top: 16px; border-top: 1px solid #edeef2; padding-top: 14px;
    }
    #__cmt-modal button.btn-back {
      padding: 6px 16px; border-radius: 6px; font-size: 12px;
      font-family: Inter, system-ui, sans-serif; font-weight: 500;
      cursor: pointer; border: 1px solid #bdc3d1; background: #edeef2; color: #464f61;
    }
    #__cmt-modal button.btn-insert {
      padding: 6px 18px; border-radius: 6px; font-size: 12px;
      font-family: Inter, system-ui, sans-serif; font-weight: 600;
      cursor: pointer; border: none; background: #32c2d2; color: #fff;
      display: flex; align-items: center; gap: 5px;
      box-shadow: 0 2px 6px rgba(50,194,210,0.30);
    }
    #__cmt-modal button:hover { opacity: 0.85; }

    #__apply-overlay {
      position: fixed; inset: 0; background: rgba(59,67,84,0.55); z-index: 999999;
      display: flex; align-items: center; justify-content: center;
      font-family: Inter, system-ui, sans-serif; font-size: 12px; color: #535353;
    }
    #__apply-modal {
      background: #fcfcfd; border-radius: 10px; border: 1px solid #dbdfe6;
      padding: 24px 28px; max-width: 400px; width: 92%; box-sizing: border-box;
    }
    #__apply-modal h3 { margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #3b4354; }
    #__apply-modal .info-box {
      padding: 9px 12px; background: #f6f7f8; border: 1px solid #dbdfe6;
      border-radius: 6px; font-size: 12px; color: #4f5b71; margin-bottom: 14px;
    }
    #__apply-modal .info-box strong { color: #3b4354; }
    #__apply-modal .warn-box {
      padding: 10px 12px; background: #fff8ed; border: 1px solid #ffa500;
      border-radius: 6px; color: #7a4f00; font-size: 12px; line-height: 1.5; margin-bottom: 14px;
    }
    #__apply-modal .warn-box strong { color: #7a4f00; }
    #__apply-modal .btn-row {
      display: flex; gap: 8px; justify-content: flex-end;
      border-top: 1px solid #edeef2; padding-top: 14px; margin-top: 4px;
    }
    #__apply-modal button.btn-back {
      padding: 6px 16px; border-radius: 6px; font-size: 12px;
      font-family: Inter, system-ui, sans-serif; font-weight: 500;
      cursor: pointer; border: 1px solid #bdc3d1; background: #edeef2; color: #464f61;
    }
    #__apply-modal button.btn-confirm {
      padding: 6px 16px; border-radius: 6px; font-size: 12px;
      font-family: Inter, system-ui, sans-serif; font-weight: 600;
      cursor: pointer; border: none; background: #32c2d2; color: #fff;
      box-shadow: 0 2px 6px rgba(50,194,210,0.30);
    }
    #__apply-modal button.btn-force {
      padding: 6px 16px; border-radius: 6px; font-size: 12px;
      font-family: Inter, system-ui, sans-serif; font-weight: 500;
      cursor: pointer; border: 1px solid #bdc3d1; background: #edeef2; color: #464f61;
    }
    #__apply-modal button:hover { opacity: 0.85; }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ─── Хелперы ───────────────────────────────────────────────────────────────

  function mk(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function getSelectedStatus() {
    for (const group of document.querySelectorAll('.input-group')) {
      const title = group.querySelector('.title');
      if (!title || !title.textContent.trim().startsWith('Status')) continue;
      const sp = group.querySelector('.multiselect__single span');
      if (sp && sp.textContent.trim()) return sp.textContent.trim();
      const s = group.querySelector('.multiselect__single');
      if (s && s.textContent.trim()) return s.textContent.trim();
      const t = group.querySelector('.multiselect__tag span');
      if (t && t.textContent.trim()) return t.textContent.trim();
      return null;
    }
    return null;
  }

  function getTransactionId() {
    for (const group of document.querySelectorAll('.input-group')) {
      const title = group.querySelector('.title');
      if (!title || title.textContent.trim() !== 'Transaction ID') continue;
      const inp = group.querySelector('input[type="text"]');
      return inp ? inp.value.trim() : null;
    }
    return null;
  }

  function getCommentTextarea() {
    for (const group of document.querySelectorAll('.input-group')) {
      const title = group.querySelector('.title');
      if (title && title.textContent.trim() === 'Comment (internal)') {
        return group.querySelector('textarea');
      }
    }
    return null;
  }

  function appendComment(textarea, text) {
    if (!textarea || !text) return;
    textarea.value = textarea.value ? textarea.value + '\n' + text : text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }

 function isTargetApplyButton(el) {
    const btn = el.closest('button');
    if (!btn) return null;
    const label = btn.querySelector('.btn-label');
    const text = label ? label.textContent.trim() : btn.textContent.trim();
    if (text !== 'Apply') return null;
    const inputGroup = btn.closest('.input-group');
    if (!inputGroup || inputGroup.classList.contains('btn-block')) return null;
    const filterBlock = inputGroup.parentElement;
    if (!filterBlock || !filterBlock.classList.contains('filter') || !filterBlock.classList.contains('btn-block')) return null;

    // Исключаем попапы не связанные с тикетами
    const modalContent = btn.closest('.modal_content');
    if (!modalContent) return null;
    const modalTitle = modalContent.querySelector('.title');
    if (!modalTitle) return null;
    if (!modalTitle.textContent.trim().startsWith('Change ticket')) return null;

    return btn;
  }

  // ─── Модалка комментария ───────────────────────────────────────────────────

  function removeCmtModal() {
    const el = document.getElementById('__cmt-overlay');
    if (el) el.remove();
  }

  function makePreviewWrap(initialText) {
    const wrap = mk('div', 'preview-wrap');
    const label = mk('div', 'preview-label'); label.textContent = 'Итоговый комментарий';
    const box = mk('div', 'preview-box'); box.textContent = initialText || '';
    wrap.appendChild(label); wrap.appendChild(box);
    return { wrap, box };
  }

  function showCommentModal(status, textarea) {
    removeCmtModal();

    const overlay = mk('div'); overlay.id = '__cmt-overlay';
    const modal = mk('div'); modal.id = '__cmt-modal';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Шапка
    const header = mk('div', 'modal-header');
    const iconWrap = mk('div', 'modal-header-icon');
    iconWrap.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    const headerText = mk('div');
    const h3 = mk('h3'); h3.textContent = 'Шаблонный комментарий';
    const sub = mk('div', 'modal-subtitle'); sub.textContent = status || '';
    headerText.appendChild(h3); headerText.appendChild(sub);
    header.appendChild(iconWrap); header.appendChild(headerText);
    modal.appendChild(header);

    let getComment = () => null;

    // ── 209 ──
    if (status && status.startsWith('209')) {
      const lbl = mk('div', 'section-label'); lbl.textContent = 'Выберите вариант';
      modal.appendChild(lbl);

      const optsWrap = mk('div', 'comment-options');
      let selectedIdx = null;
      let txnInputEl = null;
      const { wrap: pvWrap, box: pvBox } = makePreviewWrap('');

      COMMENTS_209.forEach((item, i) => {
        const optBtn = mk('button', 'comment-option');
        const optLabel = mk('div', 'opt-label'); optLabel.textContent = item.label;
        const optPreview = mk('div', 'opt-preview');
        optPreview.textContent = withPrefix(item.hasInput ? item.template('') : item.full);
        optBtn.appendChild(optLabel); optBtn.appendChild(optPreview);

        if (item.hasInput) {
          const txnWrap = mk('div', 'txn-input-wrap');
          const txnLbl = mk('label'); txnLbl.textContent = 'Номер транзакции';
          txnInputEl = mk('input', 'field-inp');
          txnInputEl.type = 'text'; txnInputEl.placeholder = item.inputPlaceholder;
          txnInputEl.addEventListener('click', e => e.stopPropagation());
          txnInputEl.addEventListener('input', () => {
            const t = withPrefix(item.template(txnInputEl.value.trim()));
            optPreview.textContent = t;
            if (selectedIdx === i) pvBox.textContent = t;
          });
          txnWrap.appendChild(txnLbl); txnWrap.appendChild(txnInputEl);
          optBtn.appendChild(txnWrap);
        }

        optBtn.addEventListener('click', () => {
          optsWrap.querySelectorAll('.comment-option').forEach(o => {
            o.classList.remove('selected');
            const tw = o.querySelector('.txn-input-wrap');
            if (tw) tw.classList.remove('visible');
          });
          optBtn.classList.add('selected');
          selectedIdx = i;
          if (item.hasInput) {
            optBtn.querySelector('.txn-input-wrap').classList.add('visible');
            pvBox.textContent = withPrefix(item.template(txnInputEl ? txnInputEl.value.trim() : ''));
          } else {
            pvBox.textContent = withPrefix(item.full);
          }
        });

        optsWrap.appendChild(optBtn);
      });

      modal.appendChild(optsWrap);
      modal.appendChild(pvWrap);

      getComment = () => {
        if (selectedIdx === null) return null;
        const item = COMMENTS_209[selectedIdx];
        return item.hasInput ? withPrefix(item.template(txnInputEl ? txnInputEl.value.trim() : '')) : withPrefix(item.full);
      };
    }

    // ── 207 ──
    if (status && status.startsWith('207')) {
      const lbl = mk('div', 'section-label'); lbl.textContent = 'Выберите вариант';
      modal.appendChild(lbl);

      const optsWrap = mk('div', 'comment-options');
      let selectedFull = null;
      const { wrap: pvWrap, box: pvBox } = makePreviewWrap('');

      COMMENTS_207.forEach((item) => {
        const optBtn = mk('button', 'comment-option');
        const optLabel = mk('div', 'opt-label'); optLabel.textContent = item.label;
        const optPreview = mk('div', 'opt-preview'); optPreview.textContent = withPrefix(item.full);
        optBtn.appendChild(optLabel); optBtn.appendChild(optPreview);
        optBtn.addEventListener('click', () => {
          optsWrap.querySelectorAll('.comment-option').forEach(o => o.classList.remove('selected'));
          optBtn.classList.add('selected');
          selectedFull = withPrefix(item.full);
          pvBox.textContent = selectedFull;
        });
        optsWrap.appendChild(optBtn);
      });

      modal.appendChild(optsWrap);
      modal.appendChild(pvWrap);
      getComment = () => selectedFull;
    }

    // ── 210 ──
    if (status && status.startsWith('210')) {
      const lbl = mk('div', 'section-label'); lbl.textContent = 'Original Ticket ID';
      modal.appendChild(lbl);

      const inp = mk('input', 'field-inp');
      inp.type = 'text'; inp.placeholder = 'Номер оригинального тикета';
      inp.style.marginBottom = '4px';

      const { wrap: pvWrap, box: pvBox } = makePreviewWrap(withPrefix('Original Ticket — '));
      inp.addEventListener('input', () => {
        pvBox.textContent = withPrefix(`Original Ticket — ${inp.value.trim() || '(не указан)'}`);
      });

      modal.appendChild(inp); modal.appendChild(pvWrap);
      getComment = () => withPrefix(`Original Ticket — ${inp.value.trim() || '(не указан)'}`);
    }

    // ── 216 ──
    if (status && status.startsWith('216')) {
      const lbl = mk('div', 'section-label'); lbl.textContent = 'Тип';
      modal.appendChild(lbl);

      const radioRow = mk('div', 'radio-row');
      function makeRadio(value, labelText, checked) {
        const l = mk('label');
        const r = mk('input'); r.type = 'radio'; r.name = '__216type'; r.value = value;
        if (checked) r.checked = true;
        const sp = mk('span'); sp.textContent = labelText;
        l.appendChild(r); l.appendChild(sp);
        return { l, r };
      }
      const { l: l1, r: r1 } = makeRadio('no', 'Нет одобренной транзакции', true);
      const { l: l2, r: r2 } = makeRadio('yes', 'Есть одобренная транзакция', false);
      radioRow.appendChild(l1); radioRow.appendChild(l2);
      modal.appendChild(radioRow);

      const txnApprWrap = mk('div', 'txn-approved-wrap');
      const txnApprLbl = mk('label'); txnApprLbl.textContent = 'Номер одобренной транзакции';
      const txnApprInp = mk('input', 'field-inp');
      txnApprInp.type = 'text'; txnApprInp.placeholder = 'например: 21078117761';
      txnApprWrap.appendChild(txnApprLbl); txnApprWrap.appendChild(txnApprInp);
      modal.appendChild(txnApprWrap);

      const ticketLbl = mk('div', 'section-label'); ticketLbl.textContent = 'Ticket ID';
      modal.appendChild(ticketLbl);

      const ticketContainer = mk('div', 'ticket-ids');
      modal.appendChild(ticketContainer);
      let ticketInputs = [];

      const btnAdd = mk('button', 'btn-add-ticket'); btnAdd.textContent = '+ Добавить тикет';
      modal.appendChild(btnAdd);

      const { wrap: pvWrap, box: pvBox } = makePreviewWrap('');
      modal.appendChild(pvWrap);

      function update216() {
        const ids = ticketInputs.map(i => i.value.trim()).filter(Boolean);
        let raw;
        if (r2.checked) {
          raw = `To Antifraud / Spam of complaints with approved payment ${txnApprInp.value.trim() || '(номер транзакции)'} / ${ids.join(' / ') || '(тикеты)'}`;
        } else {
          raw = `To Antifraud / Who is the owner of payments? Received/Not Received / ${ids.join(' / ') || '(тикеты)'}`;
        }
        pvBox.textContent = withPrefix(raw);
      }

      function addTicketRow(val) {
        const row = mk('div', 'ticket-id-row');
        const inp = mk('input'); inp.type = 'text'; inp.placeholder = 'Ticket ID'; inp.value = val || '';
        inp.addEventListener('input', update216);
        ticketInputs.push(inp);
        const rm = mk('button', 'btn-rm'); rm.textContent = '×';
        rm.addEventListener('click', () => { ticketInputs = ticketInputs.filter(i => i !== inp); row.remove(); update216(); });
        row.appendChild(inp); row.appendChild(rm);
        ticketContainer.appendChild(row);
        update216();
      }

      addTicketRow('');
      btnAdd.addEventListener('click', () => addTicketRow(''));
      r1.addEventListener('change', () => { txnApprWrap.classList.remove('visible'); update216(); });
      r2.addEventListener('change', () => { txnApprWrap.classList.add('visible'); update216(); });
      txnApprInp.addEventListener('input', update216);
      update216();

      getComment = () => pvBox.textContent.trim();
    }

    // ── 243 ──
    if (status && status.startsWith('243')) {
      const lbl = mk('div', 'section-label'); lbl.textContent = 'Номер транзакции';
      modal.appendChild(lbl);

      const inp = mk('input', 'field-inp');
      inp.type = 'text'; inp.placeholder = 'Номер транзакции';
      inp.style.marginBottom = '4px';

      const { wrap: pvWrap, box: pvBox } = makePreviewWrap(withPrefix(COMMENT_243_TEMPLATE('')));
      inp.addEventListener('input', () => {
        pvBox.textContent = withPrefix(COMMENT_243_TEMPLATE(inp.value.trim()));
      });

      modal.appendChild(inp); modal.appendChild(pvWrap);
      getComment = () => withPrefix(COMMENT_243_TEMPLATE(inp.value.trim()));
    }

    // Кнопки
    const btnRow = mk('div', 'btn-row');
    const backBtn = mk('button', 'btn-back'); backBtn.textContent = '← Назад';
    backBtn.addEventListener('click', removeCmtModal);
    btnRow.appendChild(backBtn);

    const insertBtn = mk('button', 'btn-insert');
    insertBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Вставить`;
    insertBtn.addEventListener('click', () => {
      const text = getComment();
      if (text) appendComment(textarea, text);
      removeCmtModal();
    });
    btnRow.appendChild(insertBtn);

    modal.appendChild(btnRow);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) removeCmtModal(); });
  }

  // ─── Инжект кнопки над textarea ───────────────────────────────────────────

  function updateCommentButton() {
    const status = getSelectedStatus();
    const hasTemplate = status && STATUSES_WITH_COMMENTS.some(s => status.startsWith(s));

    let commentGroup = null;
    for (const group of document.querySelectorAll('.input-group')) {
      const title = group.querySelector('.title');
      if (title && title.textContent.trim() === 'Comment (internal)') {
        commentGroup = group; break;
      }
    }
    if (!commentGroup) return;

    const existing = commentGroup.querySelector('.--cmt-trigger-wrap');
    if (!hasTemplate) { if (existing) existing.remove(); return; }
    if (existing) return;

    const textarea = commentGroup.querySelector('textarea');
    if (!textarea) return;

    const wrap = mk('div', '--cmt-trigger-wrap');
    const btn = mk('button', '--cmt-trigger-btn');
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Добавить шаблонный комментарий`;
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      showCommentModal(getSelectedStatus(), textarea);
    });
    wrap.appendChild(btn);

    // Вставляем wrap как отдельный блок ПОСЛЕ .title, ПЕРЕД textarea
    const titleEl = commentGroup.querySelector('.title');
    if (titleEl && titleEl.nextSibling) {
      commentGroup.insertBefore(wrap, titleEl.nextSibling);
    } else {
      commentGroup.insertBefore(wrap, textarea);
    }
  }

  // ─── Модалка подтверждения Apply ──────────────────────────────────────────

  function removeApplyModal() {
    const el = document.getElementById('__apply-overlay');
    if (el) el.remove();
  }

  function doConfirm(btn) {
    btn.dataset.__bypass = '1';
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    delete btn.dataset.__bypass;
  }

  function showApplyModal(btn, status, txnId) {
    removeApplyModal();

    const overlay = mk('div'); overlay.id = '__apply-overlay';
    const modal = mk('div'); modal.id = '__apply-modal';
    overlay.appendChild(modal); document.body.appendChild(overlay);

    const txnMissing = (!txnId || txnId === '') && status && STATUSES_REQUIRE_TXN.includes(status);

    const h3 = mk('h3'); h3.textContent = 'Подтверждение действия';
    modal.appendChild(h3);

    const infoBox = mk('div', 'info-box');
    infoBox.innerHTML = `Статус: <strong>${status || '[не выбран]'}</strong>`;
    modal.appendChild(infoBox);

    if (txnMissing) {
      const wb = mk('div', 'warn-box');
      wb.innerHTML = `⚠ Поле <strong>Transaction ID</strong> не заполнено. Для статуса <strong>${status}</strong> это поле обязательно.`;
      modal.appendChild(wb);
    }

    const btnRow = mk('div', 'btn-row');
    const backBtn = mk('button', 'btn-back'); backBtn.textContent = '← Назад';
    backBtn.addEventListener('click', removeApplyModal);
    btnRow.appendChild(backBtn);

    if (txnMissing) {
      const forceBtn = mk('button', 'btn-force'); forceBtn.textContent = 'Всё равно отправить';
      forceBtn.addEventListener('click', () => { removeApplyModal(); doConfirm(btn); });
      btnRow.appendChild(forceBtn);
    } else {
      const confirmBtn = mk('button', 'btn-confirm'); confirmBtn.textContent = 'Да, отправить';
      confirmBtn.addEventListener('click', () => { removeApplyModal(); doConfirm(btn); });
      btnRow.appendChild(confirmBtn);
    }

    modal.appendChild(btnRow);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) removeApplyModal(); });
  }

  // ─── Перехват Apply ────────────────────────────────────────────────────────

  document.addEventListener('mousedown', (e) => {
    const btn = isTargetApplyButton(e.target);
    if (!btn) return;
    e.preventDefault();
    showApplyModal(btn, getSelectedStatus(), getTransactionId());
  }, true);

  document.addEventListener('click', (e) => {
    const btn = isTargetApplyButton(e.target);
    if (!btn) return;
    if (btn.dataset.__bypass) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // ─── MutationObserver ─────────────────────────────────────────────────────

  const observer = new MutationObserver(() => {
    if (document.querySelector('.modal_content')) updateCommentButton();
  });

  observer.observe(document.body, { childList: true, subtree: true });

})();
