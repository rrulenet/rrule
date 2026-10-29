import { cases, versions, engines, packages, limits, findCase, assess, canonical } from '../../comparison/cases.mjs';
import { snippet } from '../../comparison/execute.mjs';

const $ = id => document.getElementById(id);
const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
const names = { upstream: 'rrule.js', temporal: 'rrule-temporal', rrulenet: '@rrulenet/rrule' };
const repositories = { upstream: 'https://github.com/jkbrzt/rrule', temporal: 'https://github.com/ggaabe/rrule-temporal', rrulenet: 'https://github.com/rrulenet/rrule' };
const descriptions = { upstream: 'Classic Date API', temporal: 'Temporal API', rrulenet: 'Classic API · @rrulenet engine' };
const state = { generation: 0, cancellations: [], results: {}, lastExample: cases[0].id };
$('host').textContent = `Browser: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;

for (const group of [...new Set(cases.map(value => value.group))]) {
  const optgroup = el('optgroup'); optgroup.label = group;
  for (const fixture of cases.filter(value => value.group === group)) { const option = el('option', fixture.label); option.value = fixture.id; optgroup.append(option); }
  $('example').append(optgroup);
}

for (const engine of engines) {
  const card = el('section', null, 'result-card'); card.id = `${engine}-card`; card.setAttribute('aria-labelledby', `${engine}-title`);
  const heading = el('div', null, 'engine-heading'); const title = el('h3'); title.id = `${engine}-title`;
  const link = el('a', names[engine]); link.href = repositories[engine]; link.target = '_blank'; link.rel = 'noopener noreferrer';
  title.append(link, el('code', versions[engine])); heading.append(title, el('p', descriptions[engine]));
  const body = el('div', null, 'result-body'); const badge = el('span', 'Ready', 'badge'); badge.id = `${engine}-badge`;
  const output = el('div', null, 'output'); output.id = `${engine}-output`; body.append(badge, output);
  const details = el('details', null, 'engine-details'); details.append(el('summary', 'Code & library output'));
  const install = el('pre'); install.textContent = `npm install --save-exact ${packages[engine]}@${versions[engine]}`;
  const code = el('pre'); code.id = `${engine}-code`; const copyButton = el('button', 'Copy JavaScript', 'button secondary'); copyButton.addEventListener('click', () => copy(code.textContent, 'JavaScript copied.'));
  const serialized = el('pre', '', 'serialized'); serialized.id = `${engine}-serialized`;
  details.append(install, code, copyButton, serialized); card.append(heading, body, details); $('results').append(card);
}

function request() { return { text: $('editor').value, maximum: Number($('maximum').value) }; }

function updateContext() {
  const fixture = findCase($('editor').value); $('example').value = fixture?.id ?? '';
  $('example-description').textContent = fixture?.description ?? 'Your own recurrence. The three engines receive the same input text.';
  $('reference-status').textContent = fixture ? 'Checked against the expected result for this example.' : 'Custom RRULE · observed results, without a correctness verdict.';
  $('reference').hidden = !fixture; $('custom-note').hidden = !!fixture;
  $('reset').hidden = canonical($('editor').value) === cases.find(value => value.id === state.lastExample)?.text;
  if (fixture) {
    $('rationale').textContent = fixture.rationale;
    $('expected').textContent = fixture.expected.kind === 'reject' ? 'Expected: reject the invalid input before generating dates.' : fixture.expected.values.length ? fixture.expected.values.join('\n') : 'Expected: no occurrences.';
    $('sources').replaceChildren();
    for (const source of fixture.sources) { const a = el('a', `${source.label} ↗`); a.href = source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; $('sources').append(a); }
  }
  for (const engine of engines) {
    try { $(`${engine}-code`).textContent = snippet($('editor').value, engine, request().maximum); }
    catch { $(`${engine}-code`).textContent = '// Include an explicit DTSTART to generate a reproduction.'; }
  }
}

function stop() {
  state.generation++; for (const cancel of state.cancellations) cancel(); state.cancellations = [];
  $('run').disabled = false; $('cancel').hidden = true;
}

function render(engine, result) {
  const fixture = findCase($('editor').value); const maximum = request().maximum;
  const badge = $(`${engine}-badge`); const output = $(`${engine}-output`); const card = $(`${engine}-card`);
  output.replaceChildren(); badge.removeAttribute('data-state'); card.removeAttribute('data-state');
  $(`${engine}-serialized`).textContent = result.serialized ? `Library serialization:\n${result.serialized}` : '';
  if (['pending', 'stale', 'cancelled'].includes(result.status)) {
    badge.textContent = result.status === 'pending' ? 'Running…' : result.status === 'stale' ? 'Ready to compare' : 'Stopped';
    output.append(el('p', result.status === 'pending' ? 'Calculating…' : result.status === 'stale' ? 'Run the comparison to see the updated results.' : 'Run again when ready.')); return;
  }
  const verdict = assess(result, fixture?.expected, maximum); badge.textContent = verdict.label;
  badge.dataset.state = verdict.kind; card.dataset.state = verdict.kind;
  if (result.status === 'ok') {
    const list = el('ol', null, 'dates');
    result.values.forEach((value, index) => {
      const wrong = verdict.kind === 'incorrect' && fixture?.expected.kind === 'dates' && fixture.expected.values[index] !== value;
      const row = el('li', null, wrong ? 'wrong' : ''); const time = el('time', value); time.dateTime = value;
      row.append(el('span', String(index + 1).padStart(2, '0'), 'date-index'), time); list.append(row);
    });
    if (!result.values.length) output.append(el('h4', 'No occurrences'));
    output.append(list);
    if (result.more) output.append(el('p', `First ${maximum} shown · more available`, 'more'));
    if (verdict.kind === 'incorrect' && fixture?.expected.kind === 'reject') output.append(el('p', 'This input is outside the allowed hour range, but the library generated dates.', 'comparison-note'));
    if (verdict.kind === 'incorrect' && fixture?.expected.kind === 'dates') {
      const expected = fixture.expected.values;
      output.append(el('p', fixture.knownMismatch?.[engine] ?? (result.values.length !== Math.min(expected.length, maximum)
        ? `Expected ${Math.min(expected.length, maximum)} occurrences in this preview; returned ${result.values.length}.` : `Expected first occurrence: ${expected[0] ?? 'none'}.`), 'comparison-note'));
    }
  } else if (result.status === 'error') output.append(el('h4', result.error.name), el('p', result.error.message, 'error-message'));
  else if (result.status === 'timeout') output.append(el('h4', 'No result within 2 seconds'), el('p', result.lastStage === 'constructed' ? 'Construction accepted the rule, but the query did not return within the preview limit.' : 'The calculation was stopped after the preview limit.'));
  else output.append(el('p', result.message ?? 'The engine could not run.'));
  if (verdict.reason) output.append(el('p', verdict.reason, 'comparison-note'));
}

function launch(engine, value, generation) {
  return new Promise(resolve => {
    const worker = new Worker(new URL(`./engine-${engine}.js`, import.meta.url), { type: 'module' });
    let done = false; let lastStage = 'loading'; let serialized;
    let timer = setTimeout(() => finish({ status: 'runner-error', message: 'The engine did not finish loading. Try again.' }), limits.startupMs);
    function finish(result) { if (done) return; done = true; clearTimeout(timer); worker.terminate(); resolve({ ...result, lastStage, ...(serialized ? { serialized } : {}) }); }
    state.cancellations.push(() => finish({ status: 'cancelled' }));
    worker.onmessage = ({ data }) => {
      if (data.type === 'ready') {
        clearTimeout(timer); lastStage = 'construction'; timer = setTimeout(() => finish({ status: 'timeout', timeoutMs: limits.timeoutMs }), limits.timeoutMs); worker.postMessage(value);
      } else if (data.type === 'progress') { lastStage = data.stage; serialized = data.serialized; if (generation === state.generation) $(`${engine}-badge`).textContent = 'Calculating…'; }
      else if (data.type === 'result') finish(data);
    };
    worker.onerror = event => finish({ status: 'runner-error', message: event.message || 'Worker could not run.' });
  });
}

async function run() {
  stop(); const generation = state.generation; updateContext(); const value = request();
  $('run').disabled = true; $('cancel').hidden = false; $('run-status').textContent = 'Comparison running.';
  await Promise.all(engines.map(async engine => {
    render(engine, { status: 'pending' }); const result = await launch(engine, value, generation);
    if (generation !== state.generation) return;
    state.results[engine] = result; render(engine, result);
  }));
  if (generation === state.generation) { $('run').disabled = false; $('cancel').hidden = true; state.cancellations = []; $('run-status').textContent = 'Comparison complete.'; }
}

function selectExample(id, changeURL = true) {
  const fixture = cases.find(value => value.id === id) ?? cases[0]; state.lastExample = fixture.id;
  $('editor').value = fixture.text; $('feedback').textContent = ''; $('copy-fallback').hidden = true;
  if (changeURL) history.replaceState(null, '', `?example=${encodeURIComponent(fixture.id)}`);
  void run();
}

async function copy(text, message) {
  try { await navigator.clipboard.writeText(text); $('feedback').textContent = message; }
  catch { $('copy-fallback').hidden = false; $('copy-text').value = text; $('copy-text').select(); $('feedback').textContent = 'Select and copy the text below.'; }
}

$('example').addEventListener('change', () => selectExample($('example').value));
$('editor').addEventListener('input', () => { stop(); state.results = {}; updateContext(); for (const engine of engines) render(engine, { status: 'stale' }); });
$('maximum').addEventListener('change', run);
$('run').addEventListener('click', run);
$('cancel').addEventListener('click', () => { stop(); for (const engine of engines) render(engine, { status: 'cancelled' }); $('run-status').textContent = 'Comparison stopped.'; });
$('reset').addEventListener('click', () => selectExample(state.lastExample));
$('share').addEventListener('click', () => {
  const value = request(); if (value.text.length > limits.inputLength) { $('feedback').textContent = 'The rule is too large to share from this preview.'; return; }
  const url = new URL(location.href); url.hash = ''; url.search = new URLSearchParams({ rrule: value.text, limit: String(value.maximum), example: state.lastExample }).toString();
  history.replaceState(null, '', url); void copy(url.href, 'Link copied.');
});

function loadURL() {
  if (location.hash === '#editor') return;
  const params = new URLSearchParams(location.search || location.hash.slice(1));
  const text = params.get('rrule'); const id = params.get('example') ?? params.get('case');
  const limit = Number(params.get('limit') ?? 10); $('maximum').value = [5, 10, 20].includes(limit) ? String(limit) : '10';
  if (text != null && text.length <= limits.inputLength) {
    $('editor').value = text; state.lastExample = findCase(text)?.id ?? cases.find(value => value.id === id)?.id ?? cases[0].id; void run();
  } else {
    selectExample(id, false);
    if (text != null) $('feedback').textContent = 'The shared input is too large. The first example is shown.';
  }
}
window.addEventListener('hashchange', loadURL);
window.addEventListener('popstate', loadURL);
loadURL();
