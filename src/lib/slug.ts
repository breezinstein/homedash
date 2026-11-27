/** Stable DOM id for a category heading, used by the sidebar jump links. */
export function categoryId(category: string): string {
  const slug = category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `cat-${slug}`;
}
