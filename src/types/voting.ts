export type ElectionStatus = 'setup' | 'active' | 'paused' | 'ended';

export interface Position {
  id: string;
  title: string;
  description?: string;
  display_order: number;
  max_choices: number;
  created_at?: string;
}

export interface Candidate {
  id: string;
  position_id: string;
  full_name: string;
  class_grade: string;
  avatar_url?: string;
  manifesto?: string;
  vote_count: number;
  created_at?: string;
}

export interface ElectionState {
  id: number;
  status: ElectionStatus;
  school_name: string;
  election_title: string;
  total_ballots_cast: number;
  kiosk_pin: string;
  updated_at?: string;
}

export interface SystemAdmin {
  id: string;
  email: string;
  full_name: string;
  slot_number: 1 | 2;
  created_at?: string;
}

export interface BallotSelection {
  [positionId: string]: string; // candidateId
}

export interface LiveCandidateStat extends Candidate {
  percentage: number;
  isLeading: boolean;
  rank: number;
}

export interface LivePositionResult {
  position: Position;
  candidates: LiveCandidateStat[];
  totalVotesForPosition: number;
}
