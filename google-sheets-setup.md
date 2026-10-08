# 📊 Google Sheets Live Integration Guide

With this setup, you have **100% design and code control** over your Next.js application using Tailwind CSS and custom React components, while pulling data live from **Google Sheets**!

---

## 1. Setup Your Google Sheet Structure

Create a new Google Spreadsheet (e.g. titled `St. Peter Basic School Elections 2026/2027`).

### Sheet Tab Name: `Candidates` (or `LiveTally`)

Add the following headers in row 1:

| A (Full Name) | B (Class / Grade) | C (Position) | D (Votes) | E (Manifesto) |
| :--- | :--- | :--- | :--- | :--- |
| Emmanuel Darko | JHS 2 A | Senior Boy Prefect | 24 | Disciplined leadership and peer support |
| Samuel Osei Boateng | Basic 6 | Senior Boy Prefect | 31 | Promoting academic excellence |
| Kelvin Mensah | JHS 2 B | Senior Boy Prefect | 18 | Mentoring younger peers and order |
| Abigail Akuffo | JHS 2 B | Senior Girl Prefect | 38 | Empowering student confidence |
| Priscilla Serwaa | Basic 6 | Senior Girl Prefect | 29 | Inspiring mutual respect |
| Prince Kwabena Adjei | JHS 2 A | Sports Prefect | 27 | Inter-class tournaments and fair play |
| Michael Frimpong | Basic 6 | Sports Prefect | 22 | Athletics coaching and team spirit |
| Jessica Afia Appiah | JHS 1 | Sanitation / Compound Prefect | 35 | Spotless school compound initiative |
| Ebenezer Quaye | Basic 6 | Sanitation / Compound Prefect | 26 | Green campus and recycling care |

---

## 2. Obtain Free Google Cloud Service Account Credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `School-Voting-System`).
3. In the search bar, search for **Google Sheets API** and click **Enable**.
4. Navigate to **IAM & Admin** ➡️ **Service Accounts** ➡️ **Create Service Account**.
   - Name: `voting-service-account`
   - Role: Project ➡️ **Editor** (or Sheets Editor)
   - Click **Done**.
5. Click on your newly created service account ➡️ go to the **Keys** tab ➡️ **Add Key** ➡️ **Create New Key** ➡️ select **JSON** ➡️ Download the file.
6. **IMPORTANT**: Open your Google Spreadsheet, click the **Share** button in the top right, and paste the `client_email` from your JSON file as an **Editor**!

---

## 3. Configure Your `.env.local` File

In the root of `g:\MyProjects\ST.VOTING_SYSTEM\`, create or edit `.env.local`:

```bash
# Google Cloud Service Account Credentials
GOOGLE_CLIENT_EMAIL="your-service-account-email@your-project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC...==\n-----END PRIVATE KEY-----\n"

# The ID from your Google Sheet URL:
# https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
GOOGLE_SHEET_ID="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
```

---

## 4. How It Works in Next.js

1. **`/api/election-data` (GET)**:
   Pulls rows live from your Google Sheet, formats and sorts by vote counts, and streams the data to your frontend.
2. **`/api/vote` (POST)**:
   When a student selects candidates on the Voting Kiosk (`/vote`), it atomically updates the vote tally cell in Column D and can log anonymous ballots in a `BallotsAudit` tab.
3. **Auditorium Live Projection (`/live`)**:
   Polls the API with 3-second live refresh and cross-tab WebSockets, displaying animated percentage bars, leaderboards, and celebratory reveals!
