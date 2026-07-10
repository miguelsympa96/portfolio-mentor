import { google } from "googleapis";

const SHEET_NAME = process.env.GOOGLE_SHEETS_TAB_NAME || "Feedback";
const EVALUATIONS_SHEET_NAME = process.env.GOOGLE_SHEETS_EVALUATIONS_TAB_NAME || "Evaluations";
const WAITLIST_SHEET_NAME = process.env.GOOGLE_SHEETS_WAITLIST_TAB_NAME || "Waitlist";

function getAuth() {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Faltan credenciales de Google Sheets en el servidor.");
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function appendRow(sheetName: string, row: (string | number)[]): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("Falta GOOGLE_SHEETS_SPREADSHEET_ID en el servidor.");
  }

  const sheets = google.sheets({ version: "v4", auth: getAuth() });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

export function appendFeedbackRow(row: (string | number)[]): Promise<void> {
  return appendRow(SHEET_NAME, row);
}

export function appendEvaluationRow(row: (string | number)[]): Promise<void> {
  return appendRow(EVALUATIONS_SHEET_NAME, row);
}

export function appendWaitlistRow(row: (string | number)[]): Promise<void> {
  return appendRow(WAITLIST_SHEET_NAME, row);
}

// Reads back every logged evaluation's seniority + score, used to compute a
// "better than X% of similar portfolios" benchmark. Returns [] rather than
// throwing when the sheet is empty or missing so callers can treat that the
// same as "not enough data yet".
export async function getEvaluationScores(): Promise<{ seniority: string; score: number }[]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("Falta GOOGLE_SHEETS_SPREADSHEET_ID en el servidor.");
  }

  const sheets = google.sheets({ version: "v4", auth: getAuth() });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${EVALUATIONS_SHEET_NAME}!A1:B`,
  });

  const rows = res.data.values ?? [];
  return rows
    .map((r) => ({ seniority: String(r[0] ?? ""), score: Number(r[1]) }))
    .filter((r) => r.seniority && Number.isFinite(r.score));
}
