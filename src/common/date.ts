export function toIsoDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
