import { NextResponse } from 'next/server';
import { isGoogleConfigured, getGoogleSheetsClient } from '@/lib/google-sheets';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { votes } = body; // Array of { name: string, position: string } or candidate names

    if (!votes || !Array.isArray(votes) || votes.length === 0) {
      return NextResponse.json({ error: 'No votes provided' }, { status: 400 });
    }

    if (!isGoogleConfigured()) {
      // Local mode fallback
      return NextResponse.json({
        success: true,
        source: 'local_storage_engine',
        message: 'Vote cast recorded in local engine.',
      });
    }

    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

    // Find tab name and current rows
    const tabName = 'Candidates';
    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${tabName}!A2:E`,
      });
    } catch {
      // Fallback to Sheet1 or LiveTally
      response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `LiveTally!A2:E`,
      });
    }

    const rows = response.data.values || [];
    const updateRanges: { range: string; values: any[][] }[] = [];

    // For each voted candidate, find their row and increment their vote count in Column D
    for (const voteItem of votes) {
      const candidateName = typeof voteItem === 'string' ? voteItem : voteItem.name;
      const rowIndex = rows.findIndex(
        (row) => row[0] && row[0].toString().trim().toLowerCase() === candidateName.toLowerCase()
      );

      if (rowIndex !== -1) {
        const actualSheetRow = rowIndex + 2; // Accounting for 1-based indexing and header row A1:E1
        const currentVotes = parseInt(rows[rowIndex][3] || '0', 10) || 0;
        const newVotes = currentVotes + 1;

        updateRanges.push({
          range: `${tabName}!D${actualSheetRow}`,
          values: [[newVotes]],
        });
      }
    }

    // Execute batch update to Google Sheets
    if (updateRanges.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updateRanges,
        },
      });
    }

    // Append completely anonymous ballot record to BallotsAudit tab if available
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `BallotsAudit!A:C`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: votes.map((v) => [
            new Date().toISOString(),
            typeof v === 'string' ? 'Contested Position' : v.position || 'Portfolio',
            typeof v === 'string' ? v : v.name,
          ]),
        },
      });
    } catch {
      // Ignore if BallotsAudit sheet tab hasn't been created yet
    }

    return NextResponse.json({
      success: true,
      source: 'google_sheets_live',
      updatedCount: updateRanges.length,
    });
  } catch (error: any) {
    console.error('Google Sheet Vote Submission Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to record vote in Google Sheets',
        details: error?.message,
      },
      { status: 500 }
    );
  }
}
