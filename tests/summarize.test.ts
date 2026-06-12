import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { processRawTranscript } from '@/lib/transcript/pipeline';
import type { SummaryBlock } from '@/lib/types';

const sample = (name: string) =>
  readFileSync(path.join(__dirname, '..', 'sample-data', name), 'utf8');

function block(blocks: SummaryBlock[], kind: SummaryBlock['kind']): SummaryBlock {
  const found = blocks.find((b) => b.kind === kind);
  if (!found) throw new Error(`no ${kind} block`);
  return found;
}

describe('expert call summary', () => {
  const { summary } = processRawTranscript(sample('expert-call-raw.txt'), 'EXPERT_CALL');

  it('produces Q&A pairs and key takeaways sections', () => {
    expect(summary.format).toBe('EXPERT_CALL');
    expect(summary.sections.map((s) => s.title)).toEqual(['Q&A', 'Key takeaways']);
  });

  it('pairs every real question with the expert answer and drops pleasantries', () => {
    const qa = block(summary.sections[0].blocks, 'qa');
    if (qa.kind !== 'qa') throw new Error('unreachable');
    expect(qa.pairs).toHaveLength(5);
    expect(qa.pairs[0].question).toMatch(/silicon carbide adoption in EV inverters/i);
    expect(qa.pairs[0].question.endsWith('?')).toBe(true);
    expect(qa.pairs[0].answer).toMatch(/800 volt|eight hundred volt/i);
    // The substrate question came from Speaker 3, not the moderator.
    expect(qa.pairs[3].question).toMatch(/substrate/i);
    // The closing "thanks so much" exchange is not a Q&A pair.
    for (const pair of qa.pairs) expect(pair.question).not.toMatch(/thanks so much/i);
  });

  it('extracts numeric takeaways', () => {
    const takeaways = block(summary.sections[1].blocks, 'bullets');
    if (takeaways.kind !== 'bullets') throw new Error('unreachable');
    expect(takeaways.items.length).toBeGreaterThanOrEqual(3);
    expect(takeaways.items.join(' ')).toMatch(/fifteen to twenty percent/i);
  });
});

describe('roadshow summary', () => {
  const { summary } = processRawTranscript(sample('roadshow-raw.txt'), 'ROADSHOW');

  it('has the three roadshow sections', () => {
    expect(summary.sections.map((s) => s.title)).toEqual([
      'Company overview',
      'Management remarks',
      'Investor Q&A',
    ]);
  });

  it('puts the company introduction in the overview', () => {
    const overview = block(summary.sections[0].blocks, 'paragraph');
    if (overview.kind !== 'paragraph') throw new Error('unreachable');
    expect(overview.text).toMatch(/Northwind/);
    expect(overview.text).toMatch(/four hundred twenty million/i);
  });

  it('keeps the rest of the presentation as management remarks', () => {
    const remarks = block(summary.sections[1].blocks, 'bullets');
    if (remarks.kind !== 'bullets') throw new Error('unreachable');
    expect(remarks.items).toHaveLength(2);
    expect(remarks.items.join(' ')).toMatch(/three hundred million of cash/i);
  });

  it('captures investor questions with management answers', () => {
    const qa = block(summary.sections[2].blocks, 'qa');
    if (qa.kind !== 'qa') throw new Error('unreachable');
    expect(qa.pairs).toHaveLength(4);
    expect(qa.pairs[0].question).toMatch(/customer concentration/i);
    expect(qa.pairs[0].answer).toMatch(/thirty four percent/i);
    expect(qa.pairs[3].question).toMatch(/valuation/i);
  });
});

describe('weekly group call summary', () => {
  const { summary } = processRawTranscript(
    sample('weekly-group-call-raw.txt'),
    'WEEKLY_GROUP_CALL',
  );

  it('has the three minutes sections', () => {
    expect(summary.sections.map((s) => s.title)).toEqual([
      'Topics discussed',
      'Decisions made',
      'Action items',
    ]);
  });

  it('lists each non-chair update as a topic', () => {
    const topics = block(summary.sections[0].blocks, 'bullets');
    if (topics.kind !== 'bullets') throw new Error('unreachable');
    expect(topics.items.length).toBeGreaterThanOrEqual(4);
    expect(topics.items.join(' ')).toMatch(/memory pricing data/i);
  });

  it('records exactly the decisions the chair called, nothing else', () => {
    const decisions = block(summary.sections[1].blocks, 'bullets');
    if (decisions.kind !== 'bullets') throw new Error('unreachable');
    expect(decisions.items).toHaveLength(2);
    expect(decisions.items.join(' ')).toMatch(/we start the one percent position/i);
    // Proposals by members and routine chair handoffs are not decisions.
    expect(decisions.items.join(' ')).not.toMatch(/consumer, you're up/i);
  });

  it('extracts the enumerated action items with owners from commitments', () => {
    const items = block(summary.sections[2].blocks, 'actionItems');
    if (items.kind !== 'actionItems') throw new Error('unreachable');
    expect(items.items).toHaveLength(4);

    const byText = (re: RegExp) => items.items.find((i) => re.test(i.description));
    // "that's me and you" -> the chair owns it.
    expect(byText(/memory trim/i)?.owner).toBe('Speaker 1');
    // "i'll have the scenario table updated by wednesday" -> Speaker 5.
    expect(byText(/scenario table/i)?.owner).toBe('Speaker 5');
    // "i'll circulate notes" (medtech conference) -> Speaker 4.
    expect(byText(/medtech conference/i)?.owner).toBe('Speaker 4');
    // The closing chatter ("okay, short one, back at it") must not leak in.
    for (const item of items.items) expect(item.description).not.toMatch(/back at it/i);
  });
});
