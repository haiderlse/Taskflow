/** `?k=v&…` from a flat record; undefined values are skipped and arrays join with commas. */
export function toQueryString(params: Record<string, string | readonly string[] | undefined>): string {
  const pairs = Object.entries(params)
    .filter((entry): entry is [string, string | readonly string[]] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(Array.isArray(value) ? value.join(',') : String(value))}`);
  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
}
