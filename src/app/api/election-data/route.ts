import { NextResponse } from 'next/server';
import { isGoogleConfigured, getGoogleSheetsClient } from '@/lib/google-sheets';

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cachedDataByDept: Record<string, CacheEntry> = {};
const inFlightPromises: Record<string, Promise<any> | null> = {};
const CACHE_TTL_MS = 2500; // 2.5 seconds cache for fast updates

function cleanPositionTitle(header: string): string {
  return header
    // Remove prefixes
    .replace(/^VOTE\s*(by checking the radio\s*)?[-–—:]\s*/i, '')
    .replace(/^(Select|Choose|Vote for|Position|Section\s*\d*)\s*[-–—:]\s*/i, '')
    // Fix typos like DINNING -> DINING
    .replace(/DINNING/gi, 'DINING')
    // Normalize spacing around parentheses
    .replace(/\s*\(\s*([^)]+)\s*\)/g, ' ($1)')
    // Normalize hyphens with boys/girls
    .replace(/\s*-\s*BOYS\b/gi, ' (Boys)')
    .replace(/\s*-\s*GIRLS\b/gi, ' (Girls)')
    .replace(/\s+/g, ' ')
    .trim();
}

// Convert Google Drive share links into direct embeddable thumbnail URLs
function formatImageUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  const driveMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }
  return trimmed;
}

async function fetchFromGoogleInternal(
  department: 'jhs' | 'primary' = 'jhs',
  customSheetId?: string | null
): Promise<any> {
  const sheets = getGoogleSheetsClient();
  
  // Resolve spreadsheet ID based on department
  const jhsSheetId = process.env.JHS_GOOGLE_SHEET_ID || process.env.GOOGLE_SHEET_ID!;
  const primarySheetId = customSheetId || process.env.PRIMARY_GOOGLE_SHEET_ID || process.env.GOOGLE_SHEET_ID_PRIMARY || jhsSheetId;
  const targetSpreadsheetId = department === 'primary' ? primarySheetId : jhsSheetId;
  const isSeparateSheet = department === 'primary' && primarySheetId !== jhsSheetId;

  const schoolTitle = department === 'primary'
    ? "ST. MICHAEL'S SCHOOL - PRIMARY"
    : "ST. MICHAEL'S SCHOOL";
  const electionTitle = department === 'primary'
    ? 'PRIMARY PREFECTORIAL ELECTIONS 2026/2027'
    : 'PREFECTORIAL ELECTIONS 2026/2027';

  // 1. Get existing sheet tab titles
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: targetSpreadsheetId,
    fields: 'sheets.properties.title',
  });

  const availableTabs = (meta.data.sheets || [])
    .map((s) => s.properties?.title || '')
    .filter(Boolean);

  // Identify response tab based on department
  let hasFormResponses: string | undefined;

  if (department === 'primary') {
    if (isSeparateSheet) {
      // Separate sheet: find the primary responses tab
      hasFormResponses = availableTabs.find(
        (t) => t.toLowerCase().includes('form responses') || t.toLowerCase().includes('response')
      ) || availableTabs[0];
    } else {
      // Shared sheet: search for 'Primary', 'Form Responses 2', 'Responses 2', or any second responses tab
      hasFormResponses =
        availableTabs.find((t) => t.toLowerCase().includes('primary')) ||
        availableTabs.find((t) => t.toLowerCase().includes('response') && (t.includes('2') || t.toLowerCase().includes('second'))) ||
        availableTabs.find((t) => t.toLowerCase() === 'form responses 2') ||
        availableTabs.find(
          (t) =>
            (t.toLowerCase().includes('form response') || t.toLowerCase().includes('response')) &&
            t.toLowerCase() !== 'form responses 1' &&
            !t.toLowerCase().includes('1') &&
            !t.toLowerCase().includes('jhs') &&
            !t.toLowerCase().includes('live') &&
            !t.toLowerCase().includes('photo') &&
            !t.toLowerCase().includes('tally')
        );
    }
  } else {
    // JHS: look for 'JHS', 'Form Responses 1', or first default response tab
    hasFormResponses = availableTabs.find(
      (t) => t.toLowerCase().includes('jhs')
    ) || availableTabs.find(
      (t) => t.toLowerCase() === 'form responses 1' || t.toLowerCase().includes('response 1')
    ) || availableTabs.find(
      (t) => (t.toLowerCase().includes('form responses') || t.toLowerCase().includes('response')) && !t.toLowerCase().includes('primary') && !t.toLowerCase().includes('2')
    );
  }

  const hasLiveTally = availableTabs.find(
    (t) => t.toLowerCase().includes('livetally') || t.toLowerCase().includes('tally')
  );
  const hasPhotos = availableTabs.find(
    (t) => t.toLowerCase().includes('photo')
  );
  const hasCandidates = availableTabs.find(
    (t) => t.toLowerCase() === 'candidates'
  );

  // If department is primary and no tab exists yet in shared sheet
  if (department === 'primary' && !isSeparateSheet && !hasFormResponses) {
    return {
      isLiveFromGoogle: true,
      department: 'primary',
      schoolName: schoolTitle,
      electionTitle,
      spreadsheetId: targetSpreadsheetId,
      totalVotes: 0,
      candidates: [],
      positions: [],
      recentActivity: [],
      info: "No Primary department tab found yet. Link your Primary Google Form to this sheet as 'Form Responses 2' or 'Primary Responses', or set PRIMARY_GOOGLE_SHEET_ID in .env.local."
    };
  }

  // Build ranges to fetch
  const rangesToFetch: string[] = [];
  if (hasCandidates) rangesToFetch.push(`'${hasCandidates}'!A1:E300`);
  if (hasFormResponses) rangesToFetch.push(`'${hasFormResponses}'!A1:Z1000`);
  if (hasLiveTally) rangesToFetch.push(`'${hasLiveTally}'!A1:Z300`);
  if (hasPhotos) rangesToFetch.push(`'${hasPhotos}'!A1:D100`);
  if (rangesToFetch.length === 0 && availableTabs[0]) {
    rangesToFetch.push(`'${availableTabs[0]}'!A1:Z500`);
  }

  const batchRes = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: targetSpreadsheetId,
    ranges: rangesToFetch,
  });

  const valueRanges = batchRes.data.valueRanges || [];
  const tabValueMap: Record<string, any[][]> = {};
  for (const vr of valueRanges) {
    const rangeName = vr.range || '';
    for (const tab of availableTabs) {
      if (rangeName.includes(`'${tab}'`) || rangeName.startsWith(`${tab}!`) || rangeName.includes(tab)) {
        tabValueMap[tab] = vr.values || [];
      }
    }
  }

  // Build Photo Map from 'Candidate Photos' tab if present
  const photoMap = new Map<string, string>();
  if (hasPhotos && (tabValueMap[hasPhotos]?.length || 0) > 1) {
    const photoRows = tabValueMap[hasPhotos].slice(1);
    for (const prow of photoRows) {
      const cname = (prow[0] || '').toString().trim().toLowerCase();
      const pUrl = formatImageUrl(prow[1]?.toString());
      if (cname && pUrl) {
        photoMap.set(cname, pUrl);
      }
    }
  }

  // Process Form Responses
  if (hasFormResponses) {
    const formRows = tabValueMap[hasFormResponses] || [];
    
    // When sheet has 0 rows (completely cleared)
    if (formRows.length === 0) {
      return {
        isLiveFromGoogle: true,
        department,
        schoolName: schoolTitle,
        electionTitle,
        spreadsheetId: targetSpreadsheetId,
        totalVotes: 0,
        candidates: [],
        positions: [],
        recentActivity: [],
      };
    }

    const headers = formRows[0] || [];
    const voteRows = formRows.slice(1);

    const positionCandidates = new Map<string, Map<string, number>>();
    const candidatePosition = new Map<string, string>();
    const positionsList: { id: string; title: string; display_order: number }[] = [];

    // Columns from index 1 (Column B) onwards represent distinct contested portfolios
    for (let col = 1; col < headers.length; col++) {
      const rawHeader = headers[col];
      if (!rawHeader) continue;
      const posTitle = cleanPositionTitle(rawHeader.toString());
      if (!posTitle) continue;

      if (!positionCandidates.has(posTitle)) {
        positionCandidates.set(posTitle, new Map());
        positionsList.push({
          id: `pos_${positionsList.length + 1}`,
          title: posTitle,
          display_order: positionsList.length + 1,
        });
      }

      const candMap = positionCandidates.get(posTitle)!;

      for (const row of voteRows) {
        const candidateName = (row[col] || '').toString().trim();
        if (candidateName) {
          candMap.set(candidateName, (candMap.get(candidateName) || 0) + 1);
          candidatePosition.set(candidateName, posTitle);
        }
      }
    }

    // Sync with LiveTally if present
    if (hasLiveTally && (tabValueMap[hasLiveTally]?.length || 0) > 1) {
      const tallyRows = tabValueMap[hasLiveTally].slice(1);
      for (const trow of tallyRows) {
        const cname = (trow[0] || '').toString().trim();
        const cvotes = parseInt(trow[1], 10);
        if (cname && !isNaN(cvotes)) {
          const posTitle = candidatePosition.get(cname);
          if (posTitle && positionCandidates.has(posTitle)) {
            positionCandidates.get(posTitle)!.set(cname, cvotes);
          }
        }
      }
    }

    // Format list of candidates
    const candidates: any[] = [];
    let candIdx = 1;

    for (const [posTitle, cands] of positionCandidates.entries()) {
      for (const [candName, voteCount] of cands.entries()) {
        const normName = candName.toLowerCase().trim();
        const avatarUrl = photoMap.get(normName) || '';

        candidates.push({
          id: `cand_${candIdx++}`,
          name: candName,
          classGrade: department === 'primary' ? 'Primary Department' : 'JHS Department',
          position: posTitle,
          votes: voteCount,
          manifesto: '',
          avatar_url: avatarUrl,
        });
      }
    }

    candidates.sort((a, b) => b.votes - a.votes);
    const totalVotes = voteRows.length;

    // Extract recent activity from Form Responses timestamps
    const recentActivity = voteRows
      .slice(-10)
      .reverse()
      .map((row, idx) => ({
        timestamp: row[0] || 'Just now',
        label: `Verified Ballot #${voteRows.length - idx} cast across all portfolios`,
      }));

    return {
      isLiveFromGoogle: true,
      department,
      schoolName: schoolTitle,
      electionTitle,
      spreadsheetId: targetSpreadsheetId,
      totalVotes,
      candidates,
      positions: positionsList,
      recentActivity,
    };
  }

  // Fallback for Candidates tab
  if (hasCandidates && (tabValueMap[hasCandidates]?.length || 0) > 1) {
    const rows = tabValueMap[hasCandidates].slice(1);
    const candidates = rows
      .filter((r) => r && r[0] && r[0].toString().trim() !== '')
      .map((row, index) => {
        const name = (row[0] || '').toString().trim();
        const normName = name.toLowerCase().trim();
        return {
          id: `cand_${index + 1}`,
          name,
          classGrade: department === 'primary' ? 'Primary Department' : 'JHS Department',
          position: (row[2] || 'Senior Prefect').toString().trim(),
          votes: parseInt(row[3], 10) || 0,
          manifesto: (row[4] || '').toString().trim(),
          avatar_url: photoMap.get(normName) || formatImageUrl(row[5]?.toString()) || '',
        };
      })
      .sort((a, b) => b.votes - a.votes);

    const positions = Array.from(new Set(candidates.map((c) => c.position))).map((title, idx) => ({
      id: `pos_${idx + 1}`,
      title,
      display_order: idx + 1,
    }));

    const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);

    return {
      isLiveFromGoogle: true,
      department,
      schoolName: schoolTitle,
      electionTitle,
      spreadsheetId: targetSpreadsheetId,
      totalVotes,
      candidates,
      positions,
      recentActivity: [],
    };
  }

  // If no responses or candidates found, return a clean empty live result
  return {
    isLiveFromGoogle: true,
    department,
    schoolName: schoolTitle,
    electionTitle,
    spreadsheetId: targetSpreadsheetId,
    totalVotes: 0,
    candidates: [],
    positions: [],
    recentActivity: [],
  };
}

export async function GET(request: Request) {
  if (!isGoogleConfigured()) {
    return NextResponse.json({
      isLiveFromGoogle: false,
      message: 'Google Sheets credentials not set in .env.local.',
    });
  }

  const { searchParams } = new URL(request.url);
  const department = (searchParams.get('department') === 'primary' ? 'primary' : 'jhs') as 'jhs' | 'primary';
  const forceRefresh = searchParams.get('refresh') === '1';

  const customSheetId = searchParams.get('sheetId')?.trim() || null;
  const cacheKey = customSheetId ? `${department}_${customSheetId}` : department;

  // Check in-memory cache first
  const now = Date.now();
  const cached = cachedDataByDept[cacheKey];
  if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  // Deduplicate in-flight requests per department
  if (!inFlightPromises[cacheKey]) {
    inFlightPromises[cacheKey] = fetchFromGoogleInternal(department, customSheetId)
      .then((data) => {
        cachedDataByDept[cacheKey] = { data, timestamp: Date.now() };
        return data;
      })
      .catch((err) => {
        console.error(`Google Sheet Read Error [${cacheKey}]:`, err.message);
        if (cachedDataByDept[cacheKey]?.data) {
          return {
            ...cachedDataByDept[cacheKey].data,
            fromCache: true,
            warning: 'Serving cached live data due to temporary rate limiting',
          };
        }
        throw err;
      })
      .finally(() => {
        inFlightPromises[cacheKey] = null;
      });
  }

  try {
    const result = await inFlightPromises[cacheKey];
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        isLiveFromGoogle: false,
        error: 'Failed to fetch from Google Sheets',
        details: error?.message || 'Check GOOGLE_SHEET_ID and service account sharing permissions.',
      },
      { status: 500 }
    );
  }
}
