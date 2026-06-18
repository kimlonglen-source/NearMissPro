// Simple heuristics to catch obvious scribbles before they become
// permanent pharmacy-wide chips. Returns { ok: true } when the text
// looks like a real label, or { ok: false, reason } with a short
// plain-English reason that the UI shows next to a "Save anyway"
// button. Heuristics alone can't catch every random string — the
// caller pairs this with a server-side AI check for ambiguous cases
// that slip through (e.g. "asopas" — has vowels but isn't a word).
//
// Rules (run in order; first failure wins):
//   - under 3 characters
//   - numbers only
//   - same letter 3+ times in a row
//   - the whole string is one short pattern repeated ("asdasd")
//   - contains a 4-char keyboard run (asdf, qwer, zxcv, or reversed)
//   - per-word: 4+ letter word with vowel ratio under ~22%,
//     or a 3-letter word with no vowels at all

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

  // Repeated short pattern: "asdasd", "kjkjkj", "abcabcabc".
  if (t.length >= 4) {
    for (let i = 1; i <= Math.floor(t.length / 2); i++) {
      if (t.length % i === 0 && t === t.substring(0, i).repeat(t.length / i)) {
        return { ok: false, reason: 'is the same letters repeated over and over' };
      }
    }
  }

  // 4-char keyboard run, forwards or backwards.
  for (const run of KEYBOARD_RUNS) {
    if (t.includes(run) || t.includes([...run].reverse().join(''))) {
      return { ok: false, reason: 'looks like a keyboard run (asdf, qwer, etc.)' };
    }
  }

  // Per-word vowel check — catches "asjdkf" / "kdjfa" / "pfdng".
  // A real abbreviation under 4 letters is allowed through ("CD", "PSO").
  for (const word of t.split(/\s+/)) {
    const letters = word.replace(/[^a-z]/g, '');
    if (letters.length >= 4) {
      const vowels = (letters.match(/[aeiouy]/g) || []).length;
      if (vowels === 0) {
        return { ok: false, reason: `"${word}" has no vowels — looks like a typo` };
      }
      if (vowels / letters.length < 0.22) {
        return { ok: false, reason: `"${word}" has very few vowels — looks like a typo` };
      }
    }
    if (letters.length === 3 && !/[aeiouy]/.test(letters)) {
      return { ok: false, reason: `"${word}" has no vowels — looks like a typo` };
    }
  }

  return { ok: true };
}
