/**
 * Detects a vision model stuck in a repetition loop. A real case: one exam page came back after ~7 minutes
 * as 16k lines of "||" (the model kept writing the side-by-side separator until it hit its token cap).
 * Shared by the OCR route (to abort the stream and move to the next model) and the OCR page (last check).
 *
 * The test is "the end of the text is one short pattern repeated at least MIN_REPEATS times over at least
 * MIN_SPAN characters". A full A4 page holds ~40-50 lines, so even a blank table with identical rows or a
 * page of dotted answer lines stays well below it.
 */

const MAX_PERIOD = 120;
const MIN_REPEATS = 80;
const MIN_SPAN = 2000;

/** Length of the repeating pattern at the end of `text`, or 0 when its end is not a loop. */
function loopPeriod(text: string): number {
  const n = text.length;
  if (n < MIN_SPAN) return 0;
  for (let p = 1; p <= MAX_PERIOD; p++) {
    const span = Math.max(MIN_SPAN, p * MIN_REPEATS);
    if (span > n) break;
    let ok = true;
    for (let i = n - span; i < n - p; i++) {
      if (text.charCodeAt(i) !== text.charCodeAt(i + p)) {
        ok = false;
        break;
      }
    }
    if (ok) return p;
  }
  return 0;
}

/** Whitespace-normalised so "||\n", "|| \n" and "||\r\n" loops look the same. */
function normalise(text: string): string {
  return text.replace(/[ \t\r]+/g, " ").replace(/ ?\n ?/g, "\n");
}

export function isRepetitionLoop(text: string): boolean {
  return loopPeriod(normalise(text)) > 0;
}

/** Letters and digits in any script (what a real transcription is mostly made of). */
function meaningfulChars(text: string): number {
  return (text.match(/[\p{L}\p{N}]/gu) || []).length;
}

/**
 * The text with a looping tail cut off (the part before the loop is often fine), or "" when nothing
 * useful is left.
 */
export function stripRepetitionLoop(text: string): string {
  let t = normalise(text);
  const p = loopPeriod(t);
  if (!p) return text;
  const unit = t.slice(-p);
  while (t.endsWith(unit)) t = t.slice(0, -p);
  t = t.trim();
  return meaningfulChars(t) >= 80 ? t : "";
}

/**
 * Whole-answer sanity check: a loop, or a long answer that is almost all separators and symbols
 * (a real page, even a blank form, is mostly words and numbers).
 */
export function looksLikeGarbage(text: string): boolean {
  if (isRepetitionLoop(text)) return true;
  // Dot / underscore leaders are real content (blanks to fill in), so they don't count either way
  const t = text.replace(/[\s.…_\-ـ]+/g, "");
  // Short answers are left alone: a page that is one big blank table is legitimately mostly "|"
  if (t.length < 3000) return false;
  return meaningfulChars(t) / t.length < 0.15;
}
