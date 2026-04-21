/**
 * Epic count label with Slavic plural rules (RU); English uses one vs few/many the same.
 */
export function formatEpicCountLabel(
  count: number,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  const abs = Math.abs(count);
  const n = abs % 100;
  const n1 = abs % 10;
  let form: 'one' | 'few' | 'many';
  if (n > 10 && n < 20) form = 'many';
  else if (n1 === 1) form = 'one';
  else if (n1 >= 2 && n1 <= 4) form = 'few';
  else form = 'many';
  return t(`planning.shared.epicCount.${form}`, { count });
}
