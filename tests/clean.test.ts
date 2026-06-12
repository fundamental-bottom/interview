import { describe, expect, it } from 'vitest';
import { cleanText } from '@/lib/transcript/clean';

describe('cleanText', () => {
  it('removes filler words', () => {
    expect(cleanText('um thanks for joining, uh, everyone')).toBe('Thanks for joining, everyone.');
  });

  it('collapses stuttered repeats, including runs', () => {
    expect(cleanText('the the the main thing is is clear')).toBe('The main thing is clear.');
  });

  it('collapses repeats of contractions', () => {
    expect(cleanText("that's that's pretty much consensus")).toBe("That's pretty much consensus.");
  });

  it('capitalizes standalone i and its contractions', () => {
    expect(cleanText("i think i'd say so")).toBe("I think I'd say so.");
  });

  it('capitalizes sentence starts and adds a terminal period', () => {
    expect(cleanText('got it. what about wafers')).toBe('Got it. What about wafers.');
  });

  it('preserves hyphenated near-fillers that carry meaning', () => {
    expect(cleanText("she said uh-huh, that's right")).toBe("She said uh-huh, that's right.");
    expect(cleanText('um-hmm exactly')).toBe('Um-hmm exactly.');
  });

  it('does not strand a comma when a trailing filler is removed', () => {
    expect(cleanText('yes, exactly, um')).toBe('Yes, exactly.');
    expect(cleanText('i think so, um.')).toBe('I think so.');
  });

  it('keeps grammatical doubles and repeated numbers', () => {
    expect(cleanText('we had had problems with the supplier')).toBe(
      'We had had problems with the supplier.',
    );
    expect(cleanText('revenue was 40 40 percent')).toBe('Revenue was 40 40 percent.');
  });

  it('is deterministic (idempotent on already-clean text)', () => {
    const once = cleanText('yeah so, look, the the main thing um is clear');
    expect(cleanText(once)).toBe(once);
  });

  it('does not invent content for empty-ish input', () => {
    expect(cleanText('um uh')).toBe('');
  });
});
