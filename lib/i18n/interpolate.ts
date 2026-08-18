/**
 * Fills `{name}` placeholders in a message template. Unknown placeholders are
 * left as-is so a missing variable shows up in the UI as `{name}` — visible
 * and greppable — instead of vanishing into an empty string.
 */
export function interpolate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  );
}
