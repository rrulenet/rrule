export const maximumInput = 16_000;
export const previewSizes = [12, 24, 48];
export const defaultLimit = previewSizes[0];
export const timeoutMs = 3_000;

export const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const frequencies = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'HOURLY', 'MINUTELY', 'SECONDLY'];
export const selectors = ['BYDAY', 'BYMONTH', 'BYMONTHDAY', 'BYYEARDAY', 'BYWEEKNO', 'BYSETPOS',
  'BYHOUR', 'BYMINUTE', 'BYSECOND', 'BYEASTER'];
const ruleParts = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'WKST', 'RSCALE', 'SKIP', ...selectors]);

const compactDate = /^\d{8}$/;
const compactTime = /^\d{8}T\d{6}Z?$/i;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const isoDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

export function unfold(text) {
  return text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n').map(line => line.trim()).filter(Boolean);
}

function unpack(value) {
  const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  if (value.length === 8) return date;
  return `${date}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}`;
}

function pack(value) {
  const compact = value.replace(/[-:]/g, '');
  return compact.length === 13 ? `${compact}00` : compact;
}

function contentLine(line) {
  // Parameter values can contain colons, for example TZID="+05:30".
  const separator = line.match(/^(?:[^":]|"[^"]*")*:/)?.[0];
  if (!separator) return { name: '', parameters: [], value: line };
  const [name, ...parameters] = separator.slice(0, -1).split(';');
  return { name: name.toUpperCase(), parameters, value: line.slice(separator.length) };
}

function hasFrequency(value) {
  return /(?:^|;)FREQ=/i.test(value);
}

export function toBuilder(text) {
  const data = { FREQ: 'DAILY', INTERVAL: '1', tzid: 'UTC', 'start-date': '', 'start-time': '09:00:00',
    'all-day': false, end: 'never', COUNT: '10', 'until-date': '', 'until-time': '', WKST: 'MO', RSCALE: '', SKIP: '',
    ...Object.fromEntries(selectors.map(name => [name, ''])), exceptions: '' };
  const extras = [];
  let startLine = false;
  let ruleLine = false;
  for (const line of unfold(text)) {
    const property = contentLine(line);
    if (property.name === 'DTSTART' && !startLine) {
      startLine = true;
      const isDate = compactDate.test(property.value);
      if (!(isDate || compactTime.test(property.value))) return null;
      for (const parameter of property.parameters) {
        const [key, raw] = parameter.split('=', 2);
        if (key.toUpperCase() === 'TZID' && raw && !isDate) data.tzid = raw.replace(/^"(.*)"$/, '$1');
        else if (key.toUpperCase() !== 'VALUE' || (isDate ? raw?.toUpperCase() !== 'DATE' : raw?.toUpperCase() !== 'DATE-TIME')) return null;
      }
      if (property.value.toUpperCase().endsWith('Z') && data.tzid !== 'UTC') return null;
      [data['start-date'], data['start-time'] = '09:00:00'] = unpack(property.value).split('T');
      data['all-day'] = isDate;
    } else if ((property.name === 'RRULE' || (!property.name && hasFrequency(property.value))) && !ruleLine) {
      if (property.parameters.length) return null;
      ruleLine = true;
      const used = new Set();
      for (const part of property.value.toUpperCase().split(';')) {
        const [key, value, extra] = part.split('=');
        if (!ruleParts.has(key) || !value || extra !== undefined || used.has(key)) return null;
        if ((key === 'COUNT' || key === 'INTERVAL') && !/^\d+$/.test(value)) return null;
        used.add(key);
        if (key === 'COUNT' || key === 'UNTIL') {
          if (data.end !== 'never') return null;
          data.end = key.toLowerCase();
        }
        if (key === 'UNTIL') {
          if (compactDate.test(value)) data['until-date'] = unpack(value);
          else if (compactTime.test(value) && value.endsWith('Z')) data['until-time'] = unpack(value);
          else return null;
        } else data[key] = value;
      }
      if (!used.has('FREQ')) return null;
    } else if (!['RDATE', 'EXDATE'].includes(property.name)) return null;
    else extras.push(line);
  }
  if (!startLine || !ruleLine || !frequencies.includes(data.FREQ) || !weekdays.includes(data.WKST) ||
      !['', 'GREGORIAN', 'HEBREW', 'CHINESE', 'INDIAN'].includes(data.RSCALE) ||
      !['', 'OMIT', 'BACKWARD', 'FORWARD'].includes(data.SKIP)) return null;
  if (data.end === 'until' && !(data['all-day'] ? data['until-date'] : data['until-time'])) return null;
  data.exceptions = extras.join('\n');
  return data;
}

export function startFromBuilder(data) {
  if (!isoDate.test(data['start-date'])) throw new Error('Choose a start date.');
  if (data['all-day']) return `DTSTART;VALUE=DATE:${pack(data['start-date'])}`;
  const local = `${data['start-date']}T${data['start-time']}`;
  if (!isoDateTime.test(local)) throw new Error('Choose a start time.');
  const zone = String(data.tzid).trim();
  if (!/^(?:[a-z0-9_+\/-]+|[+-]\d{2}:\d{2})$/i.test(zone)) throw new Error('Enter an IANA time zone or a UTC offset.');
  if (zone.toUpperCase() === 'UTC') return `DTSTART:${pack(local)}Z`;
  return `DTSTART;TZID=${zone.includes(':') ? `"${zone}"` : zone}:${pack(local)}`;
}

export function fromBuilder(data) {
  const start = startFromBuilder(data);
  const parts = [`FREQ=${data.FREQ}`];
  const interval = String(data.INTERVAL).trim();
  if (!/^\d+$/.test(interval) || Number(interval) < 1) throw new Error('The interval must be a positive integer.');
  if (Number(interval) !== 1) parts.push(`INTERVAL=${interval}`);
  if (data.end === 'count') {
    const count = String(data.COUNT).trim();
    if (!/^\d+$/.test(count)) throw new Error('Enter the occurrence count as a whole number.');
    parts.push(`COUNT=${count}`);
  }
  if (data.end === 'until') {
    const allDay = data['all-day'];
    const value = data[allDay ? 'until-date' : 'until-time'];
    if (!(allDay ? isoDate : isoDateTime).test(value)) throw new Error('Choose an end date or time.');
    parts.push(`UNTIL=${pack(value)}${allDay ? '' : 'Z'}`);
  }
  for (const name of [...selectors, 'WKST', 'RSCALE', 'SKIP']) {
    const value = String(data[name] ?? '').trim().toUpperCase().replace(/[ \t]+/g, '');
    if (value && !(name === 'WKST' && value === 'MO')) {
      if (!/^[A-Z0-9,+-]+$/.test(value)) throw new Error(`Invalid characters in ${name}.`);
      if (name === 'SKIP' && !data.RSCALE) throw new Error('Choose a calendar scale before setting SKIP.');
      parts.push(`${name}=${value}`);
    }
  }
  const exceptions = unfold(data.exceptions);
  if (exceptions.some(line => !['RDATE', 'EXDATE'].includes(contentLine(line).name))) {
    throw new Error('Enter RDATE or EXDATE property lines in the dates field.');
  }
  return [start, `RRULE:${parts.join(';')}`, ...exceptions].join('\n');
}

export function prepareText(text, fallback) {
  if (!text.trim()) throw new Error('Enter an RRULE to preview.');
  if (text.length > maximumInput) throw new Error(`The rule exceeds ${maximumInput.toLocaleString('en')} characters.`);
  const lines = unfold(text);
  const hasStart = lines.some(line => /^DTSTART(?:[;:=]|$)/i.test(line) || /(?:^|;|^RRULE:)DTSTART=/i.test(line));
  const implicitStart = !hasStart && lines.some(line => hasFrequency(line.replace(/^RRULE:/i, '')));
  const rule = implicitStart ? `${fallback}\n${lines.join('\n')}` : lines.join('\n');
  if (rule.length > maximumInput) throw new Error('The rule with its start date is too long to preview.');
  return { text: rule, implicitStart };
}

export function readLink(url) {
  const params = new URLSearchParams(url.hash.slice(1));
  for (const [name, value] of url.searchParams) params.set(name, value);
  const requested = Number(params.get('limit'));
  return { text: params.get('rrule') ?? params.get('rule'), preset: params.get('example') ?? params.get('case'),
    limit: previewSizes.includes(requested) || [5, 10, 20].includes(requested) ? requested : defaultLimit,
    mode: params.get('mode') === 'builder' ? 'builder' : 'text' };
}

export function shareURL(url, text, limit, preset, mode) {
  const shared = new URL(url);
  shared.hash = '';
  shared.search = new URLSearchParams({ rrule: text, limit: String(limit) });
  if (preset) shared.searchParams.set('example', preset);
  if (mode === 'builder') shared.searchParams.set('mode', mode);
  return shared;
}
