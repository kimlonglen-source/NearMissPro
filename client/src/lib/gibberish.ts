// Simple heuristics to catch obvious scribbles before they become
// permanent pharmacy-wide chips. Returns { ok: true } when the text
// looks like a real label, or { ok: false, reason } with a short
// plain-English reason that the UI shows next to a "Save anyway"
// button. Cannot catch genuine typos like "Funing" — those need an
// AI check.
//
// Rules:
//   - under 3 characters (lets through 2-char abbrevs only via override)
//   - no vowels at all (catches "pfdng", "xkjh")
//   - same letter 3+ times in a row ("aaaa", "kkkk")
//   - contains a 4-char keyboard run ("asdf", "qwer", "zxcv")
//   - numbers only ("12345")

const KEYBOARD_RUNS = [
  // home row
  'asdf', 'sdfg', 'dfgh', 'fghj', 'ghjk', 'hjkl',
  // top row
  'qwer', 'wert', 'erty', 'rtyu', 'tyui', 'yuio', 'uiop',
  // bottom row
  'zxcv', 'xcvb', 'cvbn', 'vbnm',
  // number row
  '1234', '2345', '3456', '4567', '5678', '6789', '7890',
];

export function looksLikeGibberish(text: string): { ok: boolean; reason?: string } {
  const t = text.trim().toLowerCase();
  if (t.length < 3) {
    return { ok: false, reason: 'is very short — give it at least three letters' };
  }
  if (/^\d+$/.test(t)) {
    return { ok: false, reason: 'is numbers only — use a short word or phrase' };
  }
  if (/(.)\1{2,}/.test(t)) {
    return { ok: false, reason: 'has the same letter three times in a row' };
  }
  // Vowel check skips when the word is mostly digits/punctuation —
  // we already know length >= 3 here, so demand at least one vowel
  // among the letters.
  const letters = t.replace(/[^a-z]/g, '');
  if (letters.length >= 3 && !/[aeiouy]/.test(letters)) {
    return { ok: false, reason: 'has no vowels — looks like a typo' };
  }
  for (const run of KEYBOARD_RUNS) {
    if (t.includes(run) || t.includes([...run].reverse().join(''))) {
      return { ok: false, reason: 'looks like a keyboard run (asdf, qwer, etc.)' };
    }
  }
  return { ok: true };
}
