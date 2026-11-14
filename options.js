(function () {
  'use strict';
  const A = AsciiAnimals;
  const $ = (id) => document.getElementById(id);
  const sync = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync ? chrome.storage.sync : null;
  // Shown next to a label where the effect is not the reference's exactly (see README).
  const NOTES = { refraction: 'approx.', ripple: 'approx.' };
  const decimals = (t) => (String(t.step).split('.')[1] || '').length;
  const fmt = (t, v) => Number(v).toFixed(decimals(t));

  // One group per heading, one control per tweak; each <label for> is bound to its input.
  let group = null;
  for (const t of A.TWEAKS) {
    if (!group || group.dataset.name !== t.group) {
      group = document.createElement('fieldset');
      group.dataset.name = t.group;
      const h = document.createElement('legend');
      h.textContent = t.group + (t.group === 'Chat glass' ? ' (new tab search panel)' : '');
      group.append(h);
      $('tweaks').append(group);
    }
    const row = document.createElement('div'), label = document.createElement('label'), input = document.createElement('input');
    row.className = 'tw' + (typeof t.def === 'boolean' ? ' check' : '');
    input.id = 't-' + t.key;
    label.htmlFor = input.id;
    label.textContent = t.label + (NOTES[t.key] ? ' (' + NOTES[t.key] + ')' : '');
    if (typeof t.def === 'boolean') {
      input.type = 'checkbox';
      row.append(input, label);
    } else {
      Object.assign(input, { type: 'range', min: t.min, max: t.max, step: t.step });
      const out = document.createElement('output');
      out.id = input.id + '-out'; out.htmlFor = input.id;
      input.addEventListener('input', () => { out.textContent = fmt(t, input.value); });
      row.append(label, out, input);
    }
    group.append(row);
  }

  function fill(s) {
    $('animal').value = s.animal;
    $('name').value = s.name;
    for (const t of A.TWEAKS) {
      const el = $('t-' + t.key);
      if (typeof t.def === 'boolean') el.checked = s[t.key];
      else { el.value = s[t.key]; $('t-' + t.key + '-out').textContent = fmt(t, s[t.key]); }
    }
    $('t-direction').disabled = s.corner; // Corner to corner sets the direction itself
  }
  function read() {
    const r = { animal: $('animal').value, name: $('name').value };
    for (const t of A.TWEAKS) { const el = $('t-' + t.key); r[t.key] = typeof t.def === 'boolean' ? el.checked : el.value; }
    return A.normalize(r);
  }

  const say = (text) => { $('status').textContent = text; };
  // Debounced so sweeping a slider (mouse or arrow keys) is one write, not dozens (chrome.storage.sync allows ~120 writes/minute);
  // flushed when the page is hidden or closed so a value changed just before closing is still saved. A select or a checkbox
  // saves at once. A failed write is retried once, 2 s later, with whatever the form holds by then.
  let timer = 0, retry = 0, legacy = [];
  function save(isRetry) {
    clearTimeout(timer); timer = 0;
    clearTimeout(retry); retry = 0;
    const s = read();
    $('t-direction').disabled = s.corner;
    if (!sync) { say('Not running as an extension: nothing saved.'); return; }
    sync.set(s, () => {
      if (chrome.runtime.lastError) {
        say('Could not save: ' + chrome.runtime.lastError.message);
        if (isRetry !== true) retry = setTimeout(() => save(true), 2000);
        return;
      }
      if (legacy.length) { sync.remove(legacy); legacy = []; } // keys of older versions, replaced by Density (size and trail keep their names with new meanings)
      say('Saved.');
    });
  }
  const later = () => { clearTimeout(timer); timer = setTimeout(save, 400); };
  const immediate = (el) => el.tagName === 'SELECT' || el.type === 'checkbox';
  // Sliders and the name box: every input and change event goes through the same debounce (a toolbar popup is destroyed
  // as soon as it loses focus, which is what the flush below is for).
  const onEdit = (e) => { if (!immediate(e.target)) later(); else if (e.type === 'change') save(); };
  $('f').addEventListener('input', onEdit);
  $('f').addEventListener('change', onEdit);
  const flush = () => { if (timer || retry) save(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  $('f').addEventListener('submit', (e) => e.preventDefault());

  // Reset puts every tweak back to its default; the animal and name stay.
  $('reset').addEventListener('click', () => {
    const cur = read();
    fill(A.normalize({ animal: cur.animal, name: cur.name }));
    save();
  });
  $('copy').addEventListener('click', () => {
    const text = JSON.stringify(read(), null, 2);
    const done = () => say('Settings copied.');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => say('Could not copy.'));
    else say('Could not copy.');
  });

  $('clear-history').addEventListener('click', () => {
    const local = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local ? chrome.storage.local : null;
    if (!local) { say('Not running as an extension: nothing to clear.'); return; }
    local.remove('recents', () => { say(chrome.runtime.lastError ? 'Could not clear: ' + chrome.runtime.lastError.message : 'Search history cleared.'); });
  });

  if (sync) sync.get(null, (saved) => { legacy = ['count'].filter((k) => saved && k in saved); fill(A.normalize(saved)); });
  else fill(A.normalize(Object.fromEntries(new URLSearchParams(location.search))));
})();
