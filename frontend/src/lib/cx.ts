export type ClassValue = string | number | false | null | undefined;

/** Join truthy class names into a single string. */
export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
