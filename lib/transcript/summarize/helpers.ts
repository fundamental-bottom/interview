import type { Segment } from '@/lib/types';

/** Split cleaned text into sentences (terminators kept). */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Total words spoken per speaker — used to infer roles (e.g. the expert talks most). */
function wordsBySpeaker(segments: Segment[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const s of segments) {
    totals.set(s.speaker, (totals.get(s.speaker) ?? 0) + wordCount(s.text));
  }
  return totals;
}

export function dominantSpeaker(segments: Segment[]): string {
  let best = segments[0]?.speaker ?? '';
  let bestWords = -1;
  for (const [speaker, words] of wordsBySpeaker(segments)) {
    if (words > bestWords) {
      best = speaker;
      bestWords = words;
    }
  }
  return best;
}

const QUESTION_CUE_RE =
  /\b(?:how|what|why|who|whose|who's|when|where|which|do you|do they|does|did|is|are|can|could|would|should|will)\b/i;

/**
 * Extract the question carried by an utterance: the tail of the text starting
 * at the last sentence that contains an interrogative cue. Moderators often
 * preface questions with acknowledgements ("got it. what about ...").
 */
export function extractQuestion(text: string): string | null {
  const sentences = splitSentences(text);
  for (let i = sentences.length - 1; i >= 0; i--) {
    if (QUESTION_CUE_RE.test(sentences[i])) {
      const question = sentences.slice(i).join(' ');
      return question.replace(/\.$/, '?');
    }
  }
  return null;
}

export function firstSentence(text: string): string {
  return splitSentences(text)[0] ?? text;
}

const STOPWORDS = new Set([
  'about', 'after', 'again', 'their', 'there', 'these', 'those', 'thing', 'things',
  'today', 'going', 'would', 'should', 'could', 'which', 'where', 'before',
]);

/** Content words used for fuzzy matching of action items to their owners. */
export function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w));
}
