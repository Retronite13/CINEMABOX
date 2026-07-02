// Turns "The Dark Knight" into "the-dark-knight".
// Used so the "movies" table's unique "slug" column has something
// predictable to insert without you having to type it manually.
export function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // strip punctuation
    .replace(/\s+/g, '-')          // spaces -> hyphens
    .replace(/-+/g, '-')           // collapse repeated hyphens
}
