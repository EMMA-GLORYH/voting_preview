import { NextResponse } from 'next/server';
import { isGoogleConfigured, getGoogleSheetsClient } from '@/lib/google-sheets';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, candidate } = body;

    if (!isGoogleConfigured()) {
      return NextResponse.json({
        success: true,
        source: 'local_storage_engine',
        message: 'Action simulated locally.',
      });
    }

    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID!;
    const tabName = 'Candidates';

    if (action === 'reset_all_votes') {
      // Fetch all candidate rows to set votes in Column D to 0
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${tabName}!A2:D`,
      });
      const rows = response.data.values || [];
      const updateData = rows.map((_, idx) => ({
        range: `${tabName}!D${idx + 2}`,
        values: [[0]],
      }));

      if (updateData.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: updateData,
          },
        });
      }

      return NextResponse.json({ success: true, message: 'All votes reset to 0 in Google Sheets.' });
    }

    if (action === 'add_candidate' && candidate) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${tabName}!A:E`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [
              candidate.name,
              candidate.classGrade || 'Basic 6',
              candidate.position || 'General Candidate',
              0, // Initial votes
              candidate.manifesto || '',
            ],
          ],
        },
      });

      return NextResponse.json({ success: true, message: 'Candidate appended to Google Sheets.' });
    }

    return NextResponse.json({ error: 'Unsupported admin action' }, { status: 400 });
  } catch (error: any) {
    console.error('Admin Sheets Error:', error);
    return NextResponse.json({ error: error?.message || 'Operation failed' }, { status: 500 });
  }
}
