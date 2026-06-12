import type { MeetingType } from '@/lib/types';

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  EXPERT_CALL: 'Expert call',
  ROADSHOW: 'Roadshow',
  WEEKLY_GROUP_CALL: 'Weekly group call',
};

export function meetingTypeLabel(type: string): string {
  return MEETING_TYPE_LABELS[type as MeetingType] ?? type;
}
