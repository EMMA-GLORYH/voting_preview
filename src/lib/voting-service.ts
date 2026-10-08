import { Position, Candidate, ElectionState, LivePositionResult, LiveCandidateStat } from '@/types/voting';

const LOCAL_STORAGE_POSITIONS_KEY = 'st_voting_positions_v2';
const LOCAL_STORAGE_CANDIDATES_KEY = 'st_voting_candidates_v2';
const LOCAL_STORAGE_STATE_KEY = 'st_voting_state_v2';

// Default Seed Data for Basic School (Used for instant zero-latency start & fallback)
const INITIAL_POSITIONS: Position[] = [
  {
    id: 'pos_1',
    title: 'Senior Boy Prefect',
    description: 'Head boy and overall leader of the student body',
    display_order: 1,
    max_choices: 1,
  },
  {
    id: 'pos_2',
    title: 'Senior Girl Prefect',
    description: 'Head girl and primary representative of female students',
    display_order: 2,
    max_choices: 1,
  },
  {
    id: 'pos_3',
    title: 'Sports Prefect',
    description: 'Oversees athletics, games, and inter-house football',
    display_order: 3,
    max_choices: 1,
  },
  {
    id: 'pos_4',
    title: 'Sanitation / Compound Prefect',
    description: 'Ensures school hygiene, compound cleanliness and environment care',
    display_order: 4,
    max_choices: 1,
  },
];

const INITIAL_CANDIDATES: Candidate[] = [
  // Senior Boy Prefect
  {
    id: 'cand_1',
    position_id: 'pos_1',
    full_name: 'Emmanuel Darko',
    class_grade: 'JHS 2 A',
    manifesto: 'Disciplined leadership, punctuality, and peer support.',
    vote_count: 24,
  },
  {
    id: 'cand_2',
    position_id: 'pos_1',
    full_name: 'Samuel Osei Boateng',
    class_grade: 'Basic 6',
    manifesto: 'Promoting academic excellence, mutual respect, and hard work.',
    vote_count: 31,
  },
  {
    id: 'cand_3',
    position_id: 'pos_1',
    full_name: 'Kelvin Mensah',
    class_grade: 'JHS 2 B',
    manifesto: 'Friendly teamwork, mentoring younger peers, and discipline.',
    vote_count: 18,
  },

  // Senior Girl Prefect
  {
    id: 'cand_4',
    position_id: 'pos_2',
    full_name: 'Abigail Akuffo',
    class_grade: 'JHS 2 B',
    manifesto: 'Empowering student confidence, cleanliness, and kindness.',
    vote_count: 38,
  },
  {
    id: 'cand_5',
    position_id: 'pos_2',
    full_name: 'Priscilla Serwaa',
    class_grade: 'Basic 6',
    manifesto: 'Inspiring discipline and mutual respect across all classes.',
    vote_count: 29,
  },

  // Sports Prefect
  {
    id: 'cand_6',
    position_id: 'pos_3',
    full_name: 'Prince Kwabena Adjei',
    class_grade: 'JHS 2 A',
    manifesto: 'New football kits, inter-class tournaments, and fair play.',
    vote_count: 27,
  },
  {
    id: 'cand_7',
    position_id: 'pos_3',
    full_name: 'Michael Frimpong',
    class_grade: 'Basic 6',
    manifesto: 'Athletics coaching for all classes and sporting spirit.',
    vote_count: 22,
  },

  // Sanitation / Compound Prefect
  {
    id: 'cand_8',
    position_id: 'pos_4',
    full_name: 'Jessica Afia Appiah',
    class_grade: 'JHS 1',
    manifesto: 'A spotless school environment and clean compound initiative.',
    vote_count: 35,
  },
  {
    id: 'cand_9',
    position_id: 'pos_4',
    full_name: 'Ebenezer Quaye',
    class_grade: 'Basic 6',
    manifesto: 'Compound greening, recycling, and clean classroom spaces.',
    vote_count: 26,
  },
];

const INITIAL_ELECTION_STATE: ElectionState = {
  id: 1,
  status: 'active',
  school_name: "ST. MICHAEL'S SCHOOL",
  election_title: 'PREFECTORIAL ELECTIONS 2026/2027',
  total_ballots_cast: 1,
  kiosk_pin: '1234',
};

// Cross-tab real-time sync broadcaster (for instantaneous multi-monitor updates)
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  broadcastChannel = new BroadcastChannel('st_voting_realtime_channel');
}

export function notifyRealtimeChange() {
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'DATA_UPDATED', timestamp: Date.now() });
  }
}

// Local Storage helpers
function getLocalPositions(): Position[] {
  if (typeof window === 'undefined') return INITIAL_POSITIONS;
  const data = localStorage.getItem(LOCAL_STORAGE_POSITIONS_KEY);
  if (!data) {
    localStorage.setItem(LOCAL_STORAGE_POSITIONS_KEY, JSON.stringify(INITIAL_POSITIONS));
    return INITIAL_POSITIONS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_POSITIONS;
  }
}

function saveLocalPositions(positions: Position[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_POSITIONS_KEY, JSON.stringify(positions));
    notifyRealtimeChange();
  }
}

function getLocalCandidates(): Candidate[] {
  if (typeof window === 'undefined') return INITIAL_CANDIDATES;
  const data = localStorage.getItem(LOCAL_STORAGE_CANDIDATES_KEY);
  if (!data) {
    localStorage.setItem(LOCAL_STORAGE_CANDIDATES_KEY, JSON.stringify(INITIAL_CANDIDATES));
    return INITIAL_CANDIDATES;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_CANDIDATES;
  }
}

function saveLocalCandidates(candidates: Candidate[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_CANDIDATES_KEY, JSON.stringify(candidates));
    notifyRealtimeChange();
  }
}

function getLocalElectionState(): ElectionState {
  if (typeof window === 'undefined') return INITIAL_ELECTION_STATE;
  const data = localStorage.getItem(LOCAL_STORAGE_STATE_KEY);
  if (!data) {
    localStorage.setItem(LOCAL_STORAGE_STATE_KEY, JSON.stringify(INITIAL_ELECTION_STATE));
    return INITIAL_ELECTION_STATE;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_ELECTION_STATE;
  }
}

function saveLocalElectionState(state: ElectionState) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_STATE_KEY, JSON.stringify(state));
    notifyRealtimeChange();
  }
}

// Flag to track whether Google Sheets live feed is active
let googleLiveActive = false;
export function isGoogleLiveFeed(): boolean {
  return googleLiveActive;
}

export async function checkGoogleSheetsStatus(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const res = await fetch('/api/election-data', { cache: 'no-store' });
    const json = await res.json();
    return Boolean(json.isLiveFromGoogle);
  } catch {
    return false;
  }
}

// ==============================================================================
// PUBLIC VOTING SERVICE API (WITH GOOGLE SHEETS PIPELINE)
// ==============================================================================

export function getPrimarySheetId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('st_voting_primary_sheet_id') || '';
}

export function setPrimarySheetId(id: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('st_voting_primary_sheet_id', id.trim());
  }
}

export async function syncFromGoogleSheets(
  department: 'jhs' | 'primary' = 'jhs',
  refresh: boolean = false
): Promise<{
  isLive: boolean;
  candidates: Candidate[];
  positions: Position[];
  totalVotes: number;
  recentActivity?: Array<{ timestamp: string; label: string }>;
  schoolName?: string;
  electionTitle?: string;
  department?: string;
  info?: string;
} | null> {
  if (typeof window === 'undefined') return null;

  try {
    const customSheetId = department === 'primary' ? getPrimarySheetId() : '';
    const sheetParam = customSheetId ? `&sheetId=${encodeURIComponent(customSheetId)}` : '';
    const url = `/api/election-data?department=${department}${refresh ? '&refresh=1' : ''}${sheetParam}`;
    const res = await fetch(url, { cache: 'no-store' });
    const json = await res.json();

    if (json.isLiveFromGoogle) {
      googleLiveActive = true;

      // Extract positions and candidates from Google Sheets
      const posMap: { [title: string]: string } = {};

      const positions: Position[] = (json.positions || []).map((p: any, idx: number) => {
        const posId = p.id || `pos_${department}_${idx + 1}`;
        posMap[p.title.toLowerCase().trim()] = posId;
        return {
          id: posId,
          title: p.title,
          description: '',
          display_order: p.display_order || idx + 1,
          max_choices: 1,
        };
      });

      const candidates: Candidate[] = (json.candidates || []).map((c: any, idx: number) => {
        const normalizedPos = (c.position || '').toLowerCase().trim();
        const posId = posMap[normalizedPos] || positions[0]?.id || `pos_${department}_1`;
        return {
          id: c.id || `cand_${department}_${idx + 1}`,
          position_id: posId,
          full_name: c.name,
          class_grade: c.classGrade || (department === 'primary' ? 'Primary Department' : 'JHS Department'),
          avatar_url: c.avatar_url || '',
          manifesto: c.manifesto || '',
          vote_count: c.votes || 0,
        };
      });

      saveLocalPositions(positions);
      saveLocalCandidates(candidates);

      const state = getLocalElectionState();
      saveLocalElectionState({
        ...state,
        school_name: json.schoolName || (department === 'primary' ? "ST. MICHAEL'S SCHOOL - PRIMARY" : "ST. MICHAEL'S SCHOOL"),
        election_title: json.electionTitle || "PREFECTORIAL ELECTIONS 2026/2027",
        total_ballots_cast: typeof json.totalVotes === 'number' ? json.totalVotes : 0,
        updated_at: new Date().toISOString(),
      });

      return {
        isLive: true,
        candidates,
        positions,
        totalVotes: typeof json.totalVotes === 'number' ? json.totalVotes : 0,
        recentActivity: json.recentActivity || [],
        schoolName: json.schoolName,
        electionTitle: json.electionTitle,
        department,
        info: json.info,
      };
    } else {
      googleLiveActive = false;
    }
  } catch (err) {
    // Keep local cache
  }
  return null;
}

export async function fetchPositions(): Promise<Position[]> {
  await syncFromGoogleSheets();
  return getLocalPositions().sort((a, b) => a.display_order - b.display_order);
}

export async function fetchCandidates(): Promise<Candidate[]> {
  await syncFromGoogleSheets();
  return getLocalCandidates();
}

export async function fetchElectionState(): Promise<ElectionState> {
  return getLocalElectionState();
}

/**
 * Cast ballot: increments in Google Sheets and local state
 */
export async function castBallot(candidateIds: string[]): Promise<{ success: boolean; error?: string }> {
  const currentState = getLocalElectionState();
  if (currentState.status !== 'active') {
    return { success: false, error: 'Voting is not currently active.' };
  }

  const candidates = getLocalCandidates();
  const positions = getLocalPositions();

  // Prepare vote details for Google Sheets submission
  const votePayload = candidateIds.map((cid) => {
    const cand = candidates.find((c) => c.id === cid);
    const pos = cand ? positions.find((p) => p.id === cand.position_id) : undefined;
    return {
      name: cand ? cand.full_name : 'Unknown Candidate',
      position: pos ? pos.title : 'Position',
    };
  });

  // Local optimistic update
  const updatedCandidates = candidates.map((cand) => {
    if (candidateIds.includes(cand.id)) {
      return { ...cand, vote_count: cand.vote_count + 1 };
    }
    return cand;
  });

  const updatedState: ElectionState = {
    ...currentState,
    total_ballots_cast: currentState.total_ballots_cast + 1,
    updated_at: new Date().toISOString(),
  };

  saveLocalCandidates(updatedCandidates);
  saveLocalElectionState(updatedState);

  // Send to Google Sheets API endpoint
  try {
    await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ votes: votePayload }),
    });
  } catch (e) {
    console.warn('Google Sheets API submission queued locally:', e);
  }

  return { success: true };
}

export async function updateElectionStatus(status: ElectionState['status']): Promise<void> {
  const state = getLocalElectionState();
  saveLocalElectionState({ ...state, status, updated_at: new Date().toISOString() });
}

export async function resetElection(): Promise<void> {
  const candidates = getLocalCandidates();
  const resetCandidates = candidates.map((c) => ({ ...c, vote_count: 0 }));
  const state = getLocalElectionState();
  const resetState: ElectionState = {
    ...state,
    total_ballots_cast: 0,
    status: 'setup',
    updated_at: new Date().toISOString(),
  };

  saveLocalCandidates(resetCandidates);
  saveLocalElectionState(resetState);

  // Reset in Google Sheets if live
  try {
    await fetch('/api/admin-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_all_votes' }),
    });
  } catch (e) {
    console.warn('Google Sheets reset failed:', e);
  }
}

export async function addCandidate(candidate: Omit<Candidate, 'id' | 'vote_count' | 'created_at'>): Promise<Candidate> {
  const newCandidate: Candidate = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'cand_' + Date.now(),
    vote_count: 0,
    created_at: new Date().toISOString(),
    ...candidate,
  };

  const current = getLocalCandidates();
  saveLocalCandidates([newCandidate, ...current]);

  // Append to Google Sheets if configured
  try {
    const pos = getLocalPositions().find((p) => p.id === candidate.position_id);
    await fetch('/api/admin-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_candidate',
        candidate: {
          name: candidate.full_name,
          classGrade: candidate.class_grade,
          position: pos?.title || 'Contested Office',
          manifesto: candidate.manifesto,
        },
      }),
    });
  } catch (e) {
    console.warn('Google Sheets candidate append error:', e);
  }

  return newCandidate;
}

export async function updateCandidate(id: string, updates: Partial<Candidate>): Promise<void> {
  const current = getLocalCandidates();
  const updated = current.map((c) => (c.id === id ? { ...c, ...updates } : c));
  saveLocalCandidates(updated);
}

export async function deleteCandidate(id: string): Promise<void> {
  const current = getLocalCandidates();
  saveLocalCandidates(current.filter((c) => c.id !== id));
}

export async function addPosition(position: Omit<Position, 'id' | 'created_at'>): Promise<Position> {
  const newPos: Position = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'pos_' + Date.now(),
    created_at: new Date().toISOString(),
    ...position,
  };

  const current = getLocalPositions();
  saveLocalPositions([...current, newPos]);
  return newPos;
}

export async function deletePosition(id: string): Promise<void> {
  const currentPos = getLocalPositions().filter((p) => p.id !== id);
  const currentCand = getLocalCandidates().filter((c) => c.position_id !== id);
  saveLocalPositions(currentPos);
  saveLocalCandidates(currentCand);
}

export async function updateKioskPin(newPin: string): Promise<void> {
  const state = getLocalElectionState();
  saveLocalElectionState({ ...state, kiosk_pin: newPin });
}

export async function updateSchoolDetails(schoolName: string, electionTitle: string): Promise<void> {
  const state = getLocalElectionState();
  saveLocalElectionState({ ...state, school_name: schoolName, election_title: electionTitle });
}

/**
 * Compute live position metrics: rank, leading candidate, percentage splits
 */
export function computeLiveResults(positions: Position[], candidates: Candidate[]): LivePositionResult[] {
  return positions
    .sort((a, b) => a.display_order - b.display_order)
    .map((position) => {
      const positionCandidates = candidates.filter((c) => c.position_id === position.id);
      const totalVotesForPosition = positionCandidates.reduce((sum, c) => sum + c.vote_count, 0);

      // Sort candidates by vote count descending
      const sorted = [...positionCandidates].sort((a, b) => b.vote_count - a.vote_count);
      const topVote = sorted.length > 0 ? sorted[0].vote_count : 0;

      const liveCandidates: LiveCandidateStat[] = sorted.map((candidate, idx) => {
        const percentage = totalVotesForPosition > 0 ? Math.round((candidate.vote_count / totalVotesForPosition) * 100) : 0;
        const isLeading = topVote > 0 && candidate.vote_count === topVote;
        return {
          ...candidate,
          percentage,
          isLeading,
          rank: idx + 1,
        };
      });

      return {
        position,
        candidates: liveCandidates,
        totalVotesForPosition,
      };
    });
}

/**
 * Subscribe to realtime updates across high-frequency polling and cross-tab events
 */
export function subscribeToElectionRealtime(onUpdate: () => void) {
  // Cross-tab broadcast listener (for instantaneous sync across screens)
  const handleBroadcast = (event: MessageEvent) => {
    if (event.data?.type === 'DATA_UPDATED') {
      onUpdate();
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcast);
  }

  // Live polling every 5 seconds for Google Sheets / background updates
  const pollInterval = setInterval(async () => {
    await syncFromGoogleSheets();
    onUpdate();
  }, 5000);

  // Return unsubscribe cleanup function
  return () => {
    clearInterval(pollInterval);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcast);
    }
  };
}
