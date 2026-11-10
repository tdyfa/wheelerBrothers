/* WheelerBrothers v55.4 – Uniformisation de la saisie des téléphones.
 * Les numéros français sont présentés en notation nationale (06 12 34 56 78).
 * Les numéros internationaux restent utilisables avec leur indicatif.
 * Aucune migration des anciens numéros n'est nécessaire.
 */
(function (root) {
  'use strict';

  function raw(value) {
    return String(value == null ? '' : value).trim().replace(/[\u00a0\u202f]/g, ' ');
  }
  function pairs(digits) {
    return (digits.match(/.{1,2}/g) || []).join(' ');
  }
  function parse(value) {
    const input = raw(value);
    if (!input) return { display: '', dial: '', valid: false };
    // Ne pas transformer silencieusement un numéro contenant des lettres ou
    // des caractères qui ne sont pas des séparateurs usuels.
    if (!/^[0-9+\s().-]+$/.test(input) ||
        (input.match(/\+/g) || []).length > 1 ||
        (input.includes('+') && input[0] !== '+')) {
      return { display: input, dial: '', valid: false };
    }
    const digits = input.replace(/\D/g, '');
    const intl = input[0] === '+' || digits.startsWith('00');
    if (intl) {
      const n = digits.startsWith('00') && input[0] !== '+' ? digits.slice(2) : digits;
      if (n.startsWith('33')) {
        let local = n.slice(2);
        // Certains carnets contiennent +33 (0)6... : le 0 est facultatif ici.
        if (local.startsWith('0')) local = local.slice(1);
        if (/^[1-9][0-9]{8}$/.test(local)) {
          return { display: pairs('0' + local), dial: '+33' + local, valid: true };
        }
        if (local.length < 9) {
          const grouped = local ? local[0] + (local.length > 1 ? ' ' + pairs(local.slice(1)) : '') : '';
          return { display: '+33' + (grouped ? ' ' + grouped : ''), dial: '', valid: false };
        }
        return { display: input, dial: '', valid: false };
      }
      const valid = /^[1-9][0-9]{7,14}$/.test(n);
      return { display: '+' + n, dial: valid ? '+' + n : '', valid };
    }
    if (/^0[1-9][0-9]{8}$/.test(digits)) {
      return { display: pairs(digits), dial: '+33' + digits.slice(1), valid: true };
    }
    // Saisie mobile française sans le 0 initial : 612345678 -> 06 12 ...
    if (/^[67][0-9]{8}$/.test(digits)) {
      return { display: pairs('0' + digits), dial: '+33' + digits, valid: true };
    }
    if (/^0[0-9]{0,9}$/.test(digits)) {
      return { display: pairs(digits), dial: '', valid: false };
    }
    return { display: input, dial: '', valid: false };
  }

  function format(value) { return parse(value).display; }
  function isValid(value) { return parse(value).valid; }
  function dial(value) { return parse(value).dial; }
  function same(a, b) {
    const aa = dial(a), bb = dial(b);
    return aa && bb ? aa === bb : raw(a) === raw(b);
  }
  function formatInput(el) {
    if (!el) return;
    const original = el.value;
    const index = typeof el.selectionStart === 'number' ? el.selectionStart : original.length;
    const atEnd = index === original.length;
    const beforeDigits = (original.slice(0, index).match(/\d/g) || []).length;
    const formatted = format(original);
    if (formatted === original) return;
    el.value = formatted;
    if (typeof el.setSelectionRange === 'function') {
      let cursor = formatted.length;
      if (!atEnd && beforeDigits > 0) {
        let digitsSeen = 0;
        for (let i = 0; i < formatted.length; i++) {
          if (/\d/.test(formatted[i])) digitsSeen++;
          if (digitsSeen === beforeDigits) { cursor = i + 1; break; }
        }
      } else if (!atEnd) cursor = 0;
      try { el.setSelectionRange(cursor, cursor); } catch (_) { /* input non textuel */ }
    }
  }
  function bind(el) {
    if (!el || el.dataset.wbPhoneBound === '1') return;
    el.dataset.wbPhoneBound = '1';
    el.setAttribute('autocomplete', 'tel');
    el.setAttribute('inputmode', 'tel');
    el.value = format(el.value);
    el.addEventListener('input', () => { el.setCustomValidity(''); formatInput(el); });
    el.addEventListener('blur', () => formatInput(el));
  }
  function validOrReport(el) {
    if (!el) return true;
    const value = raw(el.value);
    const valid = !value || isValid(value);
    el.setCustomValidity(valid ? '' : 'Numéro invalide. Ex. : 06 12 34 56 78 ou +33 6 12 34 56 78.');
    if (!valid) { el.reportValidity(); el.focus(); }
    return valid;
  }
  const api = Object.freeze({ format, isValid, dial, same, bind, formatInput, validOrReport });
  root.WBPhone = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
