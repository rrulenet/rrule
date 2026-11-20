import { defaultLimit, fromBuilder, prepareText, readLink, selectors, shareURL, startFromBuilder, timeoutMs, toBuilder, weekdays } from './model.mjs';
import { defaultPreset, presets } from './presets.mjs';

const byId = id => document.getElementById(id);
const builder = byId('builder-form');
const editor = byId('editor');
const queryForm = byId('query-form');
const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const fallbackStart = defaultPreset.text.split('\n')[0];
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const displayLocale = Intl.DateTimeFormat().resolvedOptions().locale;
const shortDate = new Intl.DateTimeFormat(displayLocale, { dateStyle: 'medium', timeZone: 'UTC' });
const dayOfWeek = new Intl.DateTimeFormat(displayLocale, { weekday: 'short', timeZone: 'UTC' });
const monthDate = new Intl.DateTimeFormat(displayLocale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const state = { mode: 'builder', view: 'list', preset: null, worker: null, timer: null, debounce: null, urlTimer: null, preview: null, month: 0, query: null };

const fields = {
  BYMONTH: ['Months', '1, 6, 12 or 5L'],
  BYMONTHDAY: ['Days of the month', '1, -1'],
  BYYEARDAY: ['Days of the year', '1, -1'],
  BYWEEKNO: ['Week numbers', '1, 20, -1'],
  BYSETPOS: ['Positions in the period', '1, -1'],
  BYHOUR: ['Hours', '9, 17'],
  BYMINUTE: ['Minutes', '0, 30'],
  BYSECOND: ['Seconds', '0, 15, 30'],
  BYEASTER: ['Days from Easter', '1'],
};
const units = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year', HOURLY: 'hour', MINUTELY: 'minute', SECONDLY: 'second' };

function element(tag, attributes = {}, text = '') {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  node.textContent = text;
  return node;
}

function showMessage(id, message) {
  const node = byId(id);
  node.textContent = message;
  node.hidden = !message;
}

function buildControls() {
  const groups = new Map();
  for (const preset of presets) {
    if (!groups.has(preset.category)) {
      const group = element('optgroup', { label: preset.category });
      groups.set(preset.category, group);
      byId('preset').append(group);
    }
    groups.get(preset.category).append(element('option', { value: preset.id }, preset.title));
  }
  for (const name of Object.keys(fields)) {
    const [title, placeholder] = fields[name];
    const label = element('label');
    const caption = element('span', {}, title + ' ');
    caption.append(element('code', {}, name));
    label.append(caption, element('input', { name, placeholder, spellcheck: 'false' }));
    byId('selector-fields').append(label);
  }
  weekdays.forEach((token, index) => {
    byId('week-start').append(element('option', { value: token }, dayNames[index]));
    const button = element('button', { type: 'button', 'data-day': token, 'aria-label': dayNames[index], 'aria-pressed': 'false' }, dayNames[index].slice(0, 2));
    button.addEventListener('click', () => {
      const field = builder.elements.BYDAY;
      const values = field.value.split(',').map(value => value.trim().toUpperCase()).filter(Boolean);
      field.value = (values.includes(token) ? values.filter(value => value !== token) : [...values, token]).join(',');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    byId('weekdays').append(button);
  });
  const zones = new Set(['UTC', localZone, 'America/New_York', 'America/Chicago', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney',
    ...(Intl.supportedValuesOf?.('timeZone') ?? [])]);
  for (const zone of zones) byId('time-zones').append(element('option', { value: zone }));
  byId('engine-version').textContent = `@rrulenet/rrule ${__RRULENET_VERSION__}`;
}

function builderValues() {
  return Object.fromEntries([...builder.elements].filter(field => field.name)
    .map(field => [field.name, field.type === 'checkbox' ? field.checked : field.value]));
}

function fillBuilder(data) {
  for (const [name, value] of Object.entries(data)) {
    const field = builder.elements.namedItem(name);
    if (field.type === 'checkbox') field.checked = value;
    else field.value = value;
  }
  byId('selector-panel').open = selectors.some(name => data[name]) || data.WKST !== 'MO';
  byId('calendar-panel').open = Boolean(data.RSCALE);
  byId('exception-panel').open = Boolean(data.exceptions);
  syncBuilderControls();
}

function syncBuilderControls() {
  const data = builderValues();
  byId('start-time-field').hidden = byId('tzid-field').hidden = data['all-day'];
  byId('count-field').hidden = data.end !== 'count';
  byId('until-date-field').hidden = data.end !== 'until' || !data['all-day'];
  byId('until-time-field').hidden = data.end !== 'until' || data['all-day'];
  builder.elements.SKIP.disabled = !data.RSCALE;
  if (!data.RSCALE) builder.elements.SKIP.value = '';
  byId('interval-unit').textContent = units[data.FREQ] + (Number(data.INTERVAL) === 1 ? '' : 's');
  const active = selectors.filter(name => data[name]?.trim()).length + Number(data.WKST !== 'MO');
  byId('filter-count').textContent = active ? String(active) : '';
  const currentDays = data.BYDAY.split(',').map(value => value.trim().toUpperCase());
  for (const button of byId('weekdays').children) button.setAttribute('aria-pressed', String(currentDays.includes(button.dataset.day)));
}

function effectiveRule() {
  if (state.mode === 'builder') return prepareText(fromBuilder(builderValues()), fallbackStart);
  let start = fallbackStart;
  try { start = startFromBuilder(builderValues()); } catch { /* The default provides a reproducible anchor for a bare rule. */ }
  return prepareText(editor.value, start);
}

function linkText() {
  if (state.mode === 'builder') return state.preset?.text ?? effectiveRule().text;
  if (!editor.value.trim()) return '';
  const rule = effectiveRule();
  return rule.implicitStart ? rule.text : editor.value;
}

function currentShareLink() {
  return shareURL(location.href, linkText(), Number(byId('maximum').value), state.preset?.id, state.mode);
}

function syncURL() {
  clearTimeout(state.urlTimer);
  try {
    const link = currentShareLink();
    if (link.href !== location.href) history.replaceState(history.state, '', link);
  } catch { /* Keep the last link while the builder cannot serialize the rule. */ }
}

function queueURLSync() {
  clearTimeout(state.urlTimer);
  state.urlTimer = setTimeout(syncURL, 350);
}

function setMode(mode) {
  state.mode = mode;
  builder.hidden = mode !== 'builder';
  byId('text-form').hidden = mode !== 'text';
  byId('builder-mode').setAttribute('aria-pressed', String(mode === 'builder'));
  byId('text-mode').setAttribute('aria-pressed', String(mode === 'text'));
}

function setPreset(preset) {
  state.preset = preset;
  byId('preset').value = preset?.id ?? '';
  byId('preset-description').textContent = preset?.description ?? 'Pick a preset to start with a different rule.';
}

function loadPreset(preset) {
  setPreset(preset);
  editor.value = preset.text;
  const data = toBuilder(preset.text);
  if (data) fillBuilder(data);
  setMode(data ? 'builder' : 'text');
  showMessage('editor-message', data ? '' : 'This preset has multiple rules. Edit them together in RRULE text mode.');
  run();
}

function stop() {
  clearTimeout(state.timer);
  clearTimeout(state.debounce);
  state.worker?.terminate();
  state.worker = null;
  byId('cancel').hidden = true;
}

function resetPreview(message) {
  state.preview = null;
  byId('results').replaceChildren();
  byId('calendar').hidden = true;
  byId('description-box').hidden = true;
  byId('zone-label').textContent = '';
  byId('result-status').textContent = message;
  showMessage('error', '');
}

function snippet(text, limit) {
  return `import { rrulestr } from '@rrulenet/rrule';\n\nconst rule = rrulestr(${JSON.stringify(text)});\nconst dates = rule.all((_, index) => index < ${limit});`;
}

function run(query = null) {
  stop();
  state.query = query;
  state.month = 0;
  byId('clear-query').hidden = !query;
  resetPreview('Calculating…');
  let request;
  try {
    request = effectiveRule();
  } catch (error) {
    showMessage('error', error.message);
    byId('result-status').textContent = '';
    byId('implicit-start').hidden = true;
    byId('snippet').textContent = '';
    return;
  }
  showMessage('implicit-start', request.implicitStart ? `Using ${request.text.split('\n')[0]} as the start.` : '');
  const limit = Number(byId('maximum').value) || defaultLimit;
  byId('snippet').textContent = snippet(request.text, limit);
  const worker = new Worker(new URL('./engine.js', import.meta.url), { type: 'module' });
  state.worker = worker;
  byId('cancel').hidden = false;
  const finish = (result, error) => {
    if (state.worker !== worker) return;
    stop();
    if (error) {
      resetPreview('');
      showMessage('error', error);
      return;
    }
    state.preview = result;
    renderPreview();
  };
  worker.onmessage = ({ data }) => finish(data.result, data.error);
  worker.onerror = event => { event.preventDefault(); finish(null, 'The preview could not start. Try reloading the page.'); };
  state.timer = setTimeout(() => finish(null, 'The query took too long. Try a narrower window or simpler rule.'), timeoutMs);
  worker.postMessage({ text: request.text, limit, locale: byId('language').value, display: byId('display-zone').value, browserZone: localZone, query });
}

function displayDay(day) {
  return new Date(`${day}T00:00:00Z`);
}

function renderPreview() {
  const result = state.preview;
  byId('calendar').hidden = state.view !== 'calendar' || !result?.occurrences.length;
  byId('results').hidden = state.view !== 'list';
  if (!result) return;
  const { occurrences, ruleZone, zone, description, exactDescription, allDay, hasMore } = result;
  byId('zone-label').textContent = allDay ? 'All-day' : zone;
  byId('query-zone-help').textContent = `Enter query times in ${zone}.`;
  byId('description-box').hidden = !description;
  byId('description').textContent = description;
  byId('partial-description').hidden = Boolean(exactDescription);
  if (!occurrences.length) byId('result-status').textContent = 'No occurrences';
  else byId('result-status').textContent = `${hasMore ? 'First ' : ''}${occurrences.length} ${occurrences.length === 1 ? 'date' : 'dates'}`;
  const rows = occurrences.map(item => {
    const date = displayDay(item.day);
    const label = element('time', { datetime: allDay ? item.day : item.utc }, shortDate.format(date));
    const local = element('strong', {}, allDay ? 'All-day' : item.time);
    const note = element('small', {}, allDay ? '' : `UTC${item.offset} · ${item.utc.replace('T', ' ').replace('.000Z', 'Z')}`);
    const text = element('div', { class: 'date-label' });
    text.append(element('small', {}, dayOfWeek.format(date)), label);
    const time = element('div', { class: 'time-label', title: allDay ? '' : `Rule time zone ${ruleZone}` });
    time.append(local);
    if (!allDay) time.append(note);
    const row = element('li');
    row.append(text, time);
    return row;
  });
  byId('results').replaceChildren(...rows);
  if (state.view === 'calendar' && occurrences.length) renderCalendar(occurrences);
}

function renderCalendar(occurrences) {
  const months = [...new Set(occurrences.map(item => item.day.slice(0, 7)))].sort();
  const month = months[state.month];
  const first = displayDay(`${month}-01`);
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  const offset = (first.getUTCDay() + 6) % 7;
  const counts = new Map();
  for (const item of occurrences) counts.set(item.day, (counts.get(item.day) ?? 0) + 1);
  byId('calendar-title').textContent = monthDate.format(first);
  byId('previous-month').disabled = state.month === 0;
  byId('next-month').disabled = state.month >= months.length - 1;
  const row = [...dayNames.map(name => element('span', { class: 'weekday-label' }, name.slice(0, 2))),
    ...Array.from({ length: offset }, () => element('span'))];
  for (let day = 1; day <= last.getUTCDate(); day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const count = counts.get(date);
    const label = count ? `${date}, ${count} ${count === 1 ? 'occurrence' : 'occurrences'}` : date;
    row.push(element('span', { class: count ? 'calendar-day has-occurrence' : 'calendar-day', 'aria-label': label, title: label }, String(day)));
  }
  byId('calendar-grid').replaceChildren(...row);
}

function changeView(view) {
  state.view = view;
  byId('list-view').setAttribute('aria-pressed', String(view === 'list'));
  byId('calendar-view').setAttribute('aria-pressed', String(view === 'calendar'));
  renderPreview();
}

async function copy(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    byId('copy-fallback').hidden = true;
    showMessage('feedback', message);
  } catch {
    const field = byId('copy-text');
    byId('copy-fallback').hidden = false;
    field.value = text;
    field.focus();
    field.select();
    showMessage('feedback', 'Select and copy the text below.');
  }
}

function readQuery() {
  const values = new FormData(queryForm);
  return { operation: values.get('operation'), start: values.get('query-start'), end: values.get('query-end'), inclusive: values.has('inclusive') };
}

function loadURL() {
  clearTimeout(state.urlTimer);
  const { text, limit, preset, mode } = readLink(new URL(location.href));
  const linkedPreset = presets.find(item => item.id === (preset === 'chicago-last-weekday' ? 'last-weekday' : preset));
  const select = byId('maximum');
  if (![...select.options].some(option => Number(option.value) === limit)) select.prepend(element('option', { value: limit }, `${limit} dates`));
  select.value = String(limit);
  if (text !== null) {
    editor.value = text;
    const data = mode === 'builder' ? toBuilder(text) : null;
    if (data) fillBuilder(data);
    setMode(data ? 'builder' : 'text');
    setPreset(presets.find(item => item.text === text) ?? null);
    showMessage('editor-message', '');
    run();
  } else loadPreset(linkedPreset ?? defaultPreset);
}

buildControls();
fillBuilder(toBuilder(defaultPreset.text));
loadURL();

byId('preset').addEventListener('change', () => {
  const preset = presets.find(item => item.id === byId('preset').value);
  if (preset) loadPreset(preset);
  else setPreset(null);
  syncURL();
});
byId('builder-mode').addEventListener('click', () => {
  if (state.mode === 'builder') return;
  try {
    const data = toBuilder(effectiveRule().text);
    if (!data) throw new Error('The builder needs one RRULE and a supported DTSTART. You can keep editing this rule as text.');
    fillBuilder(data);
    setMode('builder');
    syncURL();
    showMessage('editor-message', '');
    run();
  } catch (error) { showMessage('editor-message', error.message); }
});
byId('text-mode').addEventListener('click', () => {
  if (state.mode === 'text') return;
  try {
    editor.value = linkText();
    setMode('text');
    syncURL();
    editor.focus();
    showMessage('editor-message', '');
  } catch (error) { showMessage('editor-message', error.message); }
});
builder.addEventListener('input', event => {
  if (!event.target.name) return;
  setPreset(null);
  syncBuilderControls();
  showMessage('editor-message', '');
  stop();
  state.debounce = setTimeout(run, 160);
  queueURLSync();
});
builder.addEventListener('submit', event => { event.preventDefault(); run(); });
editor.addEventListener('input', () => {
  setPreset(null);
  showMessage('editor-message', '');
  stop();
  state.query = null;
  byId('clear-query').hidden = true;
  resetPreview('Preview the edited rule');
  byId('snippet').textContent = '';
  byId('implicit-start').hidden = true;
  queueURLSync();
});
editor.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); run(); }
});
byId('run').addEventListener('click', () => run());
byId('cancel').addEventListener('click', () => { stop(); resetPreview('Preview stopped'); });
byId('maximum').addEventListener('change', () => {
  syncURL();
  run(state.query);
});
for (const id of ['display-zone', 'language']) byId(id).addEventListener('change', () => run(state.query));
byId('list-view').addEventListener('click', () => changeView('list'));
byId('calendar-view').addEventListener('click', () => changeView('calendar'));
byId('previous-month').addEventListener('click', () => { state.month--; renderCalendar(state.preview.occurrences); });
byId('next-month').addEventListener('click', () => { state.month++; renderCalendar(state.preview.occurrences); });
queryForm.elements.operation.addEventListener('change', () => { byId('query-end-field').hidden = queryForm.elements.operation.value !== 'between'; });
queryForm.addEventListener('submit', event => { event.preventDefault(); run(readQuery()); });
byId('clear-query').addEventListener('click', () => run());
for (const [id, property] of [['include-date', 'RDATE'], ['exclude-date', 'EXDATE']]) {
  byId(id).addEventListener('click', () => {
    const date = byId('exception-date');
    if (!date.value) {
      date.focus();
      showMessage('editor-message', 'Choose a date to add.');
      return;
    }
    try {
      const line = startFromBuilder({ ...builderValues(), 'start-date': date.value }).replace('DTSTART', property);
      const field = builder.elements.exceptions;
      field.value = [field.value.trim(), line].filter(Boolean).join('\n');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (error) { showMessage('editor-message', error.message); }
  });
}
byId('copy-code').addEventListener('click', () => {
  try { void copy(snippet(effectiveRule().text, Number(byId('maximum').value)), 'JavaScript copied.'); }
  catch (error) { showMessage('feedback', error.message); }
});
byId('copy-rule').addEventListener('click', () => {
  try { void copy(effectiveRule().text, 'RRULE copied.'); } catch (error) { showMessage('feedback', error.message); }
});
byId('share').addEventListener('click', () => {
  try {
    void copy(currentShareLink().href, 'Share link copied.');
  } catch (error) { showMessage('feedback', error.message); }
});
window.addEventListener('popstate', () => {
  if (location.hash !== '#workspace') loadURL();
});
