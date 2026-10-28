export const FOLLOW_UP_KINDS = [
  "next_consultation",
  "eligibility_check",
  "referral_outcome",
] as const;

export const FOLLOW_UP_STATUSES = ["open", "done", "cancelled"] as const;

export type FollowUpKind = (typeof FOLLOW_UP_KINDS)[number];
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export type FollowUpTask = {
  id: string;
  owner_id: string;
  case_id: string;
  analysis_id: string | null;
  kind: FollowUpKind;
  status: FollowUpStatus;
  due_on: string | null;
  note: string;
  created_at: string;
  completed_at: string | null;
};
