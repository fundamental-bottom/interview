// Deterministic text cleanup for speech-recognition output: filler removal,
// stutter collapse, casing. Intentionally conservative — readability fixes
// only. Known limits: grammatical doubles are protected by an explicit
// exemption list, so an unlisted legitimate double would still collapse.

// Standalone fillers only — hyphenated tokens like "uh-huh" / "um-hmm" carry
// meaning (affirmations) and must survive, hence the hyphen guards.
const FILLER_RE = /(?<!-)\b(?:um+|uh+|erm+)\b(?![\w-])[,.]?\s*/gi;

// "the the main thing" -> "the main thing"; runs until fixed point so
// "is is is" also collapses.
const REPEATED_WORD_RE = /\b([\w'’]+)(\s+\1\b)+/gi;

// Legitimate English doubles that must not be treated as stutter.
const GRAMMATICAL_DOUBLES = new Set(['had', 'that']);

function collapseRepeats(text: string): string {
  let prev = text;
  for (;;) {
    const next = prev.replace(REPEATED_WORD_RE, (match, word: string) =>
      GRAMMATICAL_DOUBLES.has(word.toLowerCase()) || /^\d/.test(word) ? match : word,
    );
    if (next === prev) return next;
    prev = next;
  }
}

function capitalizeSentences(text: string): string {
  // Capitalize the first letter of the text and of anything following . ! ?
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function cleanText(rawText: string): string {
  let text = rawText;
  text = text.replace(FILLER_RE, ' ');
  text = collapseRepeats(text);
  // Standalone "i" and its contractions.
  text = text.replace(/\bi\b/g, 'I');
  // Tidy whitespace and punctuation spacing left behind by removals.
  text = text.replace(/\s+([,.!?])/g, '$1');
  text = text.replace(/,\s*,/g, ',');
  text = text.replace(/\s{2,}/g, ' ').trim();
  text = text.replace(/^[,.\s]+/, '');
  text = text.replace(/[,\s]+$/, ''); // a removed trailing filler can strand a comma
  text = capitalizeSentences(text);
  if (text && !/[.!?]$/.test(text)) text += '.';
  return text;
}
