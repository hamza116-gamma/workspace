// Extract http(s) links from message content (for the Files & links tab).
// Trailing sentence punctuation is stripped and duplicates are removed.

const URL_PATTERN = /\bhttps?:\/\/[^\s<>()"']+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)]+$/;
const MAX_LINKS_PER_MESSAGE = 20;
const MAX_URL_LENGTH = 2000;

const extractLinks = (content = '') => {
  const matches = String(content).match(URL_PATTERN) || [];
  const seen = new Set();
  const links = [];

  for (const match of matches) {
    const url = match.replace(TRAILING_PUNCTUATION, '');
    if (!url || url.length > MAX_URL_LENGTH) {
      continue;
    }
    const key = url.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    links.push(url);
    if (links.length >= MAX_LINKS_PER_MESSAGE) {
      break;
    }
  }

  return links;
};

module.exports = { extractLinks };
