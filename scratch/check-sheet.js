const { google } = require('googleapis');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const sheetIdMatch = env.match(/GOOGLE_SHEET_ID="([^"]+)"/);
const emailMatch = env.match(/GOOGLE_CLIENT_EMAIL="([^"]+)"/);
const keyMatch = env.match(/GOOGLE_PRIVATE_KEY="([^"]+)"/);

if (!sheetIdMatch || !emailMatch || !keyMatch) {
  console.error('Missing credentials');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: emailMatch[1],
    private_key: keyMatch[1].replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function check() {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetIdMatch[1],
    includeGridData: false,
  });

  console.log('Sheets in spreadsheet:');
  for (const s of meta.data.sheets || []) {
    console.log('-', s.properties?.title);
  }

  // Check Candidate Photos tab if present
  try {
    const photosRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetIdMatch[1],
      range: "'Candidate Photos'!A1:D50",
    });
    console.log('\nCandidate Photos tab contents:', photosRes.data.values);
  } catch (e) {
    console.log('Error reading Candidate Photos tab:', e.message);
  }

  // Check Form Responses 1 tab header
  try {
    const formRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetIdMatch[1],
      range: "'Form Responses 1'!A1:Z5",
    });
    console.log('\nForm Responses headers:', formRes.data.values?.[0]);
    console.log('Form Responses row 2:', formRes.data.values?.[1]);
  } catch (e) {
    console.log('Error reading Form Responses 1 tab:', e.message);
  }
}

check().catch(console.error);
