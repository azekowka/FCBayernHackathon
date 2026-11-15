/**
 * Numbers guard — the core of our "grounded AI" promise.
 *
 * Every multi-digit number in a model's answer must already exist in the facts
 * the deterministic engine produced (allowing for rounding and percentages).
 * If Gemini invents a number, we discard its text and fall back to a template.
 */

const ALWAYS_OK = new Set(['10', '12', '15', '20', '24', '30', '45', '60', '90', '100', '256']);

function digits(token: string): string {
  return token.replace(/[^0-9]/g, '');
}

function trimDecimal(s: string): string {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

function collectNumbers(value: unknown, out: number[]): void {
  if (typeof value === 'number' && Number.isFinite(value)) out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectNumbers(v, out));
  else if (value && typeof value === 'object')
    Object.values(value).forEach((v) => collectNumbers(v, out));
}

function stripHexLike(text: string): string {
  // Seeds and hashes: long tokens mixing hex letters and digits.
  return text.replace(/\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{6,}\b/gi, ' ');
}

export function allowedNumbers(facts: unknown): Set<string> {
  const allowed = new Set<string>(ALWAYS_OK);
  const json = stripHexLike(JSON.stringify(facts));
  for (const t of json.match(/\d+(?:[.,]\d+)*/g) ?? []) {
    allowed.add(digits(t));
    for (const part of t.split(/[.,]/)) allowed.add(part);
  }
  const nums: number[] = [];
  collectNumbers(facts, nums);
  for (const n of nums) {
    const variants = [
      Math.round(n),
      Math.floor(n),
      Math.ceil(n),
      trimDecimal(n.toFixed(1)),
      trimDecimal(n.toFixed(2)),
    ];
    if (n > 0 && n < 1) {
      const pct = n * 100;
      variants.push(Math.round(pct), Math.floor(pct), Math.ceil(pct), trimDecimal(pct.toFixed(1)));
      variants.push(Math.round(1 / n));
    }
    for (const v of variants) allowed.add(digits(String(v)));
  }
  return allowed;
}

/**
 * Maps every Unicode decimal digit (Arabic-Indic, Devanagari, full-width…) to
 * ASCII so numbers written in any script are checked, not silently skipped.
 * Unicode lays decimal digits out in contiguous runs of ten starting at zero.
 */
export function toAsciiDigits(text: string): string {
  return text.normalize('NFKC').replace(/\p{Nd}/gu, (ch) => {
    let start = ch.codePointAt(0) as number;
    while (/\p{Nd}/u.test(String.fromCodePoint(start - 1))) start--;
    return String(((ch.codePointAt(0) as number) - start) % 10);
  });
}

/** Returns the numbers in `text` that the facts cannot account for. */
export function ungroundedNumbers(text: string, facts: unknown): string[] {
  const allowed = allowedNumbers(facts);
  const offending: string[] = [];
  for (const token of stripHexLike(toAsciiDigits(text)).match(/\d+(?:[.,]\d+)*/g) ?? []) {
    const d = digits(token);
    if (d.length <= 1 || allowed.has(d)) continue;
    const parts = token.split(/[.,]/);
    const decimalOk =
      parts.length === 2 && allowed.has(digits(trimDecimal(`${parts[0]}.${parts[1]}`)));
    if (decimalOk || parts.every((p) => p.length <= 1 || allowed.has(p))) continue;
    offending.push(token);
  }
  return offending;
}
