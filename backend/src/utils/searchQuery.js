// Parses a Slack-style search string:
//   from:me | from:name          in:#channel | in:@person
//   has:link | has:file | has:image | has:pin
//   before:YYYY-MM-DD  after:YYYY-MM-DD  on:YYYY-MM-DD
//   "exact phrases" and plain words (all must match, case-insensitive).
const HAS_VALUES = new Set(['link', 'file', 'image', 'pin']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TOKEN_RE = /(\w+):"([^"]*)"|(\w+):(\S+)|"([^"]*)"|(\S+)/g;
const MAX_TERMS = 10;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseDate = (value) => {
  if (!DATE_RE.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const applyOperator = (result, key, rawValue) => {
  const value = rawValue.trim();
  if (!value) {
    return false;
  }
  switch (key.toLowerCase()) {
    case 'from':
      result.from.push(value.replace(/^@/, ''));
      return true;
    case 'in':
      if (value.startsWith('@')) {
        result.inPeople.push(value.slice(1));
      } else {
        result.inChannels.push(value.replace(/^#/, '').toLowerCase());
      }
      return true;
    case 'has':
      if (HAS_VALUES.has(value.toLowerCase())) {
        result.has.add(value.toLowerCase());
        return true;
      }
      return false;
    case 'before': {
      const date = parseDate(value);
      if (date) {
        result.before = date;
      }
      return Boolean(date);
    }
    case 'after': {
      const date = parseDate(value);
      if (date) {
        result.after = new Date(date.getTime() + DAY_MS);
      }
      return Boolean(date);
    }
    case 'on': {
      const date = parseDate(value);
      if (date) {
        result.after = date;
        result.before = new Date(date.getTime() + DAY_MS);
      }
      return Boolean(date);
    }
    default:
      return false;
  }
};

const parseSearchQuery = (input) => {
  const result = {
    terms: [],
    from: [],
    inChannels: [],
    inPeople: [],
    has: new Set(),
    before: null,
    after: null,
  };
  const text = String(input || '').slice(0, 500);
  for (const match of text.matchAll(TOKEN_RE)) {
    const [whole, quotedKey, quotedValue, key, value, phrase, word] = match;
    if (quotedKey && applyOperator(result, quotedKey, quotedValue)) {
      continue;
    }
    if (key && applyOperator(result, key, value)) {
      continue;
    }
    const term = (phrase ?? word ?? whole).trim();
    if (term && result.terms.length < MAX_TERMS) {
      result.terms.push(term);
    }
  }
  return result;
};

const hasFilters = (parsed) =>
  parsed.from.length > 0 ||
  parsed.inChannels.length > 0 ||
  parsed.inPeople.length > 0 ||
  parsed.has.size > 0 ||
  Boolean(parsed.before || parsed.after);

// Case-insensitive "contains" regexes, one per term (all must match).
const termRegexes = (terms) => terms.map((term) => new RegExp(escapeRegex(term), 'i'));

module.exports = { parseSearchQuery, hasFilters, termRegexes, escapeRegex };
