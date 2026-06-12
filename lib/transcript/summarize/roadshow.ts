import type { Segment, SummaryDocument } from '@/lib/types';
import { extractQuestion } from './helpers';

// Roadshows: a host introduces management, management presents, then investor
// Q&A. The host is the first speaker; management are the speakers who present
// before Q&A opens; everyone else asking questions afterwards is an investor.

const QA_OPEN_RE = /\b(?:open it up|first question|go to (?:investor )?questions|q ?& ?a)\b/i;

export function summarizeRoadshow(segments: Segment[]): SummaryDocument {
  const host = segments[0]?.speaker ?? '';

  // Find where the host opens the floor — after management has spoken.
  let qaStart = segments.length;
  for (let i = 1; i < segments.length; i++) {
    const s = segments[i];
    const sawManagement = segments.slice(0, i).some((p) => p.speaker !== host);
    if (s.speaker === host && sawManagement && QA_OPEN_RE.test(s.text)) {
      qaStart = i + 1;
      break;
    }
  }

  const presentation = segments.slice(0, qaStart).filter((s) => s.speaker !== host);
  const management = new Set(presentation.map((s) => s.speaker));

  const overview = presentation[0]?.text ?? '';
  const remarks = presentation.slice(1).map((s) => `${s.speaker}: ${s.text}`);

  const pairs: { question: string; answer: string }[] = [];
  for (let i = qaStart; i < segments.length - 1; i++) {
    const current = segments[i];
    if (current.speaker === host || management.has(current.speaker)) continue;

    const question = extractQuestion(current.text);
    if (!question) continue;

    const answerParts: string[] = [];
    for (let j = i + 1; j < segments.length && management.has(segments[j].speaker); j++) {
      answerParts.push(segments[j].text);
    }
    if (answerParts.length === 0) continue;
    pairs.push({ question, answer: answerParts.join(' ') });
  }

  return {
    format: 'ROADSHOW',
    sections: [
      { title: 'Company overview', blocks: [{ kind: 'paragraph', text: overview }] },
      { title: 'Management remarks', blocks: [{ kind: 'bullets', items: remarks }] },
      { title: 'Investor Q&A', blocks: [{ kind: 'qa', pairs }] },
    ],
  };
}
