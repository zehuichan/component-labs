export interface SelectOption {
  label: string;
  value: string | number;
}

/** Rounds to cents, tolerating floating point noise. */
export function money(value: unknown): number {
  return Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100;
}

export function sum<T extends object>(rows: readonly T[], field: keyof T & string): number {
  return money(
    rows.reduce((total, row) => total + Number((row as Record<string, unknown>)[field] ?? 0), 0),
  );
}

export function optionLabel(options: readonly SelectOption[], value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  return options.find((option) => option.value === value)?.label ?? String(value);
}

/** Temporary ids for rows created in the browser; negative so they never collide with stored ids. */
export function createTempIdFactory(): () => number {
  let seq = 0;
  return () => --seq;
}
