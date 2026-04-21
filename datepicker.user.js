// ==UserScript==
// @name         Auto Datepicker for filters Team B BETA
// @version      1.0.3
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

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function fmt(d) {
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function isMyTicketsSwitchOn() {
    const label = document.querySelector('.input-group.select-box .apm-form__switch');
    return label ? label.classList.contains('active') : false;
  }

  function getDateRange() {
    const now = new Date();

    if (isMyTicketsSwitchOn()) {
      const hour = now.getHours();

      const end = new Date(now);
      end.setHours(23, 59, 0, 0);

      if (hour >= 9) {
        // 09:00–23:59 → только сегодня
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return `${fmt(start)} ~ ${fmt(end)}`;
      } else {
        // 00:00–08:59 → вчера + сегодня
        const start = new Date(now);
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        return `${fmt(start)} ~ ${fmt(end)}`;
      }
    }

    // Стандартный режим: год назад + 1 день ~ сегодня 23:59
    const end = new Date(now);
    end.setHours(23, 59, 0, 0);

    const start = new Date(now);
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);

    return `${fmt(start)} ~ ${fmt(end)}`;
  }

  function setDatepickerValue(input, value) {
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

  document.addEventListener('click', (e) => {
    const applyBtn = e.target.closest('[data-v-3b29a2a9] .btn-success');
    if (!applyBtn) return;

    setTimeout(() => {
      if (!trySetDate()) {
        const interval = setInterval(() => {
          if (trySetDate()) clearInterval(interval);
        }, 100);
        setTimeout(() => clearInterval(interval), 3000);
      }
    }, 300);
  }, true);

})();
