// ==UserScript==
// @name         Auto Datepicker for filters Team B 
// @version      1.0.1
// @updateURL    https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/datepicker.user.js
// @downloadURL  https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/datepicker.user.js
// @author       You
// @match        https://th-managment.com/en/admin/backoffice/paymentsupport*
// @match        https://my-managment.com/en/admin/backoffice/paymentsupport*
// @match        https://managment.io/en/admin/backoffice/paymentsupport*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=th-managment.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function getDateRange() {
    const now = new Date();

    const end = new Date(now);
    end.setHours(23, 59, 0, 0);

    const start = new Date(now);
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);

    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) =>
      `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

    return `${fmt(start)} ~ ${fmt(end)}`;
  }

  function setDatepickerValue(input, value) {
    // Устанавливаем значение через нативный setter (для Vue-реактивности)
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function trySetDate() {
    const input = document.querySelector('.mx-datepicker-range .mx-input');
    if (!input) return false;
    setDatepickerValue(input, getDateRange());
    return true;
  }

  // Следим за кликом на Apply внутри модалки
  document.addEventListener('click', (e) => {
    const applyBtn = e.target.closest('[data-v-3b29a2a9] .btn-success');
    if (!applyBtn) return;

    // Небольшая задержка — дать Vue время отрендерить пикер после применения фильтра
    setTimeout(() => {
      if (!trySetDate()) {
        // Если пикер ещё не появился — ждём ещё
        const interval = setInterval(() => {
          if (trySetDate()) clearInterval(interval);
        }, 100);
        setTimeout(() => clearInterval(interval), 3000);
      }
    }, 300);
  }, true);

})();
