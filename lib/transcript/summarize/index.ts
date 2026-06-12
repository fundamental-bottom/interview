import type { MeetingType, Segment, SummaryDocument } from '@/lib/types';
import { summarizeExpertCall } from './expert-call';
import { summarizeRoadshow } from './roadshow';
import { summarizeWeeklyGroupCall } from './weekly-group-call';

export type Summarizer = (segments: Segment[]) => SummaryDocument;

// One summarizer per meeting type. The Record over MeetingType means adding a
// type to MEETING_TYPES without registering a summarizer is a compile error —
// the only places a new type touches are lib/types.ts and this directory.
const summarizers: Record<MeetingType, Summarizer> = {
  EXPERT_CALL: summarizeExpertCall,
  ROADSHOW: summarizeRoadshow,
  WEEKLY_GROUP_CALL: summarizeWeeklyGroupCall,
};

export function getSummarizer(meetingType: MeetingType): Summarizer {
  return summarizers[meetingType];
}
