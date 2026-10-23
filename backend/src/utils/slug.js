const slugify = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'org';

const generateUniqueSlug = async (name, isTaken) => {
  const base = slugify(name);
  let slug = base;
  let suffix = 1;

  while (await isTaken(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
};

module.exports = { slugify, generateUniqueSlug };
