import type { Segment, SummaryDocument } from '@/lib/types';
import { dominantSpeaker, extractQuestion, splitSentences } from './helpers';

// Expert calls: an interviewer (sometimes several) asks, one expert answers.
// The expert is identified as the speaker with the most words; every
// non-expert utterance immediately followed by an expert utterance that
// carries an interrogative cue becomes a Q&A pair.

const TAKEAWAY_CUE_RE = /\d|percent|basis points|million|billion|volt/i;
const MAX_TAKEAWAYS = 5;

export function summarizeExpertCall(segments: Segment[]): SummaryDocument {
  const expert = dominantSpeaker(segments);

  const pairs: { question: string; answer: string }[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const current = segments[i];
    if (current.speaker === expert) continue;

    const question = extractQuestion(current.text);
    if (!question) continue; // greetings, wrap-ups

    // The answer is the run of consecutive expert segments that follows.
    const answerParts: string[] = [];
    for (let j = i + 1; j < segments.length && segments[j].speaker === expert; j++) {
      answerParts.push(segments[j].text);
    }
    if (answerParts.length === 0) continue;
    pairs.push({ question, answer: answerParts.join(' ') });
  }

  const takeaways: string[] = [];
  for (const { answer } of pairs) {
    for (const sentence of splitSentences(answer)) {
      if (takeaways.length >= MAX_TAKEAWAYS) break;
      if (TAKEAWAY_CUE_RE.test(sentence) && !takeaways.includes(sentence)) {
        takeaways.push(sentence);
      }
    }
  }

  return {
    format: 'EXPERT_CALL',
    sections: [
      { title: 'Q&A', blocks: [{ kind: 'qa', pairs }] },
      { title: 'Key takeaways', blocks: [{ kind: 'bullets', items: takeaways }] },
    ],
  };
}
