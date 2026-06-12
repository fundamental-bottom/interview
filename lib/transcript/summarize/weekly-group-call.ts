import type { Segment, SummaryDocument } from '@/lib/types';
import { firstSentence, significantWords, splitSentences } from './helpers';

// Weekly group calls: a chair runs through sector updates and closes with an
// explicit action-item recap. The chair is the first speaker.
//
// - Topics: the opening sentence of each non-chair speaking turn.
// - Decisions: chair sentences that record an outcome ("decision", "noted",
//   "we start/hold/trim ...").
// - Action items: the enumerated recap, with owners recovered by matching the
//   item's content words against earlier commitments ("i'll have the scenario
//   table updated") from individual speakers.

const DECISION_RE = /\b(?:decision|decided|noted|agreed|we (?:start|hold|trim|add|exit))\b/i;
const ACTION_RECAP_RE = /\baction items?\b/i;
const COMMITMENT_RE = /\bI(?:'ll| will)\b/;
const ENUM_SPLIT_RE = /\b(?:one|two|three|four|five|six|seven|eight|nine|ten)[,.]\s+/gi;

interface ActionItem {
  description: string;
  owner: string;
}

export function summarizeWeeklyGroupCall(segments: Segment[]): SummaryDocument {
  const chair = segments[0]?.speaker ?? '';

  // Topics: first sentence of each contiguous non-chair turn.
  const topics: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].speaker === chair) continue;
    if (i > 0 && segments[i - 1].speaker === segments[i].speaker) continue;
    topics.push(`${segments[i].speaker}: ${firstSentence(segments[i].text)}`);
  }

  // Recaps close the call, so take the LAST match — an early "flag action
  // items as we go" aside must not hijack it.
  const recapIndex = segments.findLastIndex(
    (s) => s.speaker === chair && ACTION_RECAP_RE.test(s.text),
  );

  // Decisions: outcome statements by the chair, excluding the recap itself.
  const decisions: string[] = [];
  segments.forEach((s, i) => {
    if (s.speaker !== chair || i === recapIndex) return;
    for (const sentence of splitSentences(s.text)) {
      if (DECISION_RE.test(sentence)) decisions.push(sentence);
    }
  });

  // Commitments made during the call, used to attribute owners.
  const commitments: { speaker: string; sentence: string }[] = [];
  for (const s of segments) {
    if (s.speaker === chair) continue;
    for (const sentence of splitSentences(s.text)) {
      if (COMMITMENT_RE.test(sentence)) commitments.push({ speaker: s.speaker, sentence });
    }
  }

  const actionItems: ActionItem[] = [];
  if (recapIndex >= 0) {
    const recap = segments[recapIndex].text;
    const afterIntro = recap
      .slice(recap.search(ACTION_RECAP_RE))
      // Cut closing chatter ("anything else. okay, short one, back at it")
      // before splitting — "one," in it would otherwise read as an item.
      .replace(/\b(?:anything else|that'?s (?:all|it))\b[\s\S]*$/i, '');
    const items = afterIntro
      .split(ENUM_SPLIT_RE)
      .slice(1) // drop the "action items then." preamble
      .map((item) => item.replace(/\bokay\b.*$/i, '').trim())
      .filter((item) => item.length > 3);

    for (const item of items) {
      actionItems.push({ description: item, owner: findOwner(item, commitments, chair) });
    }
  }

  return {
    format: 'WEEKLY_GROUP_CALL',
    sections: [
      { title: 'Topics discussed', blocks: [{ kind: 'bullets', items: topics }] },
      { title: 'Decisions made', blocks: [{ kind: 'bullets', items: decisions }] },
      { title: 'Action items', blocks: [{ kind: 'actionItems', items: actionItems }] },
    ],
  };
}

function findOwner(
  item: string,
  commitments: { speaker: string; sentence: string }[],
  chair: string,
): string {
  // Explicit self-assignment by the chair ("that's me and you").
  if (/\bthat'?s me\b/i.test(item)) return chair;

  // Otherwise match content words against commitments made during the call.
  const itemWords = significantWords(item);
  let bestOwner = '';
  let bestOverlap = 0;
  for (const { speaker, sentence } of commitments) {
    const overlap = significantWords(sentence).filter((w) => itemWords.includes(w)).length;
    if (overlap > bestOverlap) {
      bestOwner = speaker;
      bestOverlap = overlap;
    }
  }
  return bestOverlap >= 2 ? bestOwner : 'Unassigned';
}
