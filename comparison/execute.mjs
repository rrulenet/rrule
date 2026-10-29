import { limits, canonical, packages } from './cases.mjs';

class PlaygroundInputError extends Error {
  constructor(message) { super(message); this.name = 'PlaygroundInputError'; }
}

function inspect(request) {
  if (typeof request?.text !== 'string' || request.text.length > limits.inputLength) throw new PlaygroundInputError('Enter an RRULE input of at most 16,000 characters.');
  if (!Number.isInteger(request.maximum) || request.maximum < 1 || request.maximum > limits.maximumPreview) throw new PlaygroundInputError('Choose a preview length from 1 to 20.');
  const text = canonical(request.text);
  const unfolded = text.replace(/\n[ \t]/g, '');
  if (!/^(DTSTART|RDATE)[;:]/mi.test(unfolded)) throw new PlaygroundInputError('Include DTSTART (or RDATE) so the comparison has an explicit starting date.');
  for (const match of unfolded.matchAll(/(?:^|;)COUNT=(\d+)/gmi)) if (Number(match[1]) > limits.count) throw new PlaygroundInputError('This preview accepts COUNT up to 1,000.');
  const rules = unfolded.split('\n').filter(line => /^RRULE:/i.test(line));
  const finite = rules.every(line => /(?:COUNT|UNTIL)=/i.test(line));
  const stamps = [...unfolded.matchAll(/^(?:DTSTART|RDATE)(?:;[^:]*)?:([^\n]+)/gmi)].flatMap(match => match[1].split(','));
  const dates = stamps.map(value => {
    const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?Z?$/i.exec(value);
    return match ? Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4] ?? '00'}:${match[5] ?? '00'}:${match[6] ?? '00'}Z`) : NaN;
  }).filter(Number.isFinite);
  return { text, finite, rules, lower: dates.length ? new Date(Math.min(...dates) - 2 * 86400000) : null };
}

export function execute(engine, lib, request, progress = () => {}) {
  let stage = 'input'; let unsupported;
  try {
    const input = inspect(request);
    if (engine === 'temporal' && (input.rules.length > 1 || /^EXRULE:/mi.test(input.text))) unsupported = 'rrule-temporal 2.2.8 exposes one RRuleTemporal rule, not a recurrence-set parser for multiple RRULE/EXRULE lines. Returned values below are its actual output for this input.';
    if (engine === 'upstream' && /(?:RSCALE|SKIP)=/i.test(input.text)) unsupported = 'rrule.js 2.8.1 does not implement the RSCALE / SKIP extension.';
    stage = 'construction';
    const rule = engine === 'temporal' ? new lib.RRuleTemporal({ rruleString: input.text }) : lib.rrulestr(input.text);
    const serialized = rule.toString(); progress({ stage: 'constructed', serialized }); stage = 'query';
    const maximum = request.maximum; let values;
    if (engine === 'rrulenet' && !input.finite) {
      if (!input.lower) throw new PlaygroundInputError('Use a basic DTSTART date for an open-ended preview.');
      values = []; let cursor = input.lower;
      for (let index = 0; index <= maximum; index++) {
        const next = rule.after(cursor, false); if (!next) break;
        if (next.getTime() <= cursor.getTime()) throw new Error('The occurrence query did not advance.');
        values.push(next); cursor = next;
      }
    } else values = rule.all((_, index) => index <= maximum);
    return { status: 'ok', values: values.slice(0, maximum).map(value => new Date(engine === 'temporal' ? value.epochMilliseconds : value.getTime()).toISOString()),
      more: values.length > maximum, serialized, ...(unsupported ? { unsupported } : {}) };
  } catch (error) {
    return { status: 'error', stage: error instanceof PlaygroundInputError ? 'input' : stage,
      error: { name: error.name, message: error.message, ...(error.code ? { code: error.code } : {}) }, ...(unsupported ? { unsupported } : {}) };
  }
}

export function snippet(text, engine, maximum = 10) {
  const name = packages[engine];
  const construct = engine === 'temporal' ? `import { RRuleTemporal } from '${name}';\nconst rule = new RRuleTemporal({ rruleString: text });`
    : engine === 'upstream' ? `import rrule from '${name}';\nconst { rrulestr } = rrule;\nconst rule = rrulestr(text);`
    : `import { rrulestr } from '${name}';\nconst rule = rrulestr(text);`;
  const [line, ...rest] = construct.split('\n');
  const intro = `${line}\n\nconst text = ${JSON.stringify(canonical(text))};\n${rest.join('\n')}\n`;
  const input = inspect({ text, maximum });
  if (engine === 'rrulenet' && !input.finite && input.lower) return intro + `const dates = [];\nlet cursor = new Date(${JSON.stringify(input.lower.toISOString())});\nfor (let i = 0; i < ${maximum}; i++) {\n  const next = rule.after(cursor, false);\n  if (!next) break;\n  dates.push(next);\n  cursor = next;\n}\nconsole.log(dates);\n`;
  return intro + `const dates = rule.all((_, index) => index < ${maximum});\nconsole.log(dates);\n`;
}
