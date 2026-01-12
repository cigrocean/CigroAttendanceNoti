// Google Sheets Helper
const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;

const getAccessToken = async () => {
  const refreshToken = import.meta.env.VITE_GOOGLE_REFRESH_TOKEN;
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

  if (refreshToken && clientId && clientSecret) {
    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.access_token;
      }
    } catch (error) {
      console.warn("⚠️ Error refreshing token:", error);
    }
  }
  return null;
};

// ==========================================
// NETWORK AUTHENTICATION (Dynamic IP Guard)
// ==========================================

const NETWORKS_SHEET_TITLE = "AUTHORIZED_NETWORKS";

// Ensure the AUTHORIZED_NETWORKS sheet exists, create if not
const ensureNetworksSheet = async (accessToken) => {
  try {
    // 1. Get Spreadsheet Metadata to check sheets
    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    
    if (!metaResponse.ok) throw new Error("Failed to fetch spreadsheet metadata");
    const meta = await metaResponse.json();
    const existing = meta.sheets.find(s => s.properties.title === NETWORKS_SHEET_TITLE);
    
    if (existing) return existing.properties.sheetId;

    // 2. Create if missing
    console.log(`Creating sheet: ${NETWORKS_SHEET_TITLE}...`);
    const createResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{
            addSheet: {
              properties: {
                title: NETWORKS_SHEET_TITLE,
                gridProperties: { rowCount: 1000, columnCount: 5 }
              }
            }
          }]
        }),
      }
    );
    
    if (!createResponse.ok) throw new Error("Failed to create networks sheet");
    const createResult = await createResponse.json();
    const newSheetId = createResult.replies[0].addSheet.properties.sheetId;
    
    // 3. Add Header Row
    await fetch(
       `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${NETWORKS_SHEET_TITLE}!A1:C1:append?valueInputOption=USER_ENTERED`,
       {
         method: "POST",
         headers: {
           Authorization: `Bearer ${accessToken}`,
           "Content-Type": "application/json",
         },
         body: JSON.stringify({
            values: [["IP Address", "Date Authorized", "User Agent"]]
         })
       }
    );
    
    return newSheetId;

  } catch (e) {
    console.error("Error ensuring networks sheet:", e);
    throw e;
  }
};

export const fetchAuthorizedNetworks = async () => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return []; // Fail silently if no token (e.g. not configured)

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${NETWORKS_SHEET_TITLE}!A:A?t=${new Date().getTime()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store'
      }
    );

    if (!response.ok) {
       // If sheet doesn't exist, it's fine, just return empty
       const text = await response.text();
       if (text.includes("Unable to parse range") || response.status === 400 || response.status === 404) {
          return [];
       }
       throw new Error(`Failed to fetch networks: ${text}`);
    }

    const data = await response.json();
    if (!data.values || data.values.length <= 1) return []; // Header only

    // Return simple array of IPs (skip header)
    return data.values.slice(1).map(row => row[0]).filter(ip => ip);
  } catch (e) {
    console.warn("Failed to fetch authorized networks (sheet might not exist yet):", e);
    return [];
  }
};

export const authorizeNetwork = async (ip) => {
  try {
    const accessToken = await getAccessToken();
    await ensureNetworksSheet(accessToken);
    
    // Append the IP
    const values = [
      [
        ip, 
        new Date().toISOString(), 
        navigator.userAgent
      ]
    ];

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${NETWORKS_SHEET_TITLE}!A:C:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values }),
      }
    );
    
    if (!response.ok) throw new Error(await response.text());
    
    console.log(`✅ Authorized IP: ${ip}`);
    return true;
  } catch (e) {
    console.error("Failed to authorize network:", e);
    throw e;
  }
};

// ==========================================
// ATTENDANCE LOGGING
// ==========================================

const ATTENDANCE_SHEET_TITLE = "ATTENDANCE_LOG";

const ensureAttendanceSheet = async (accessToken) => {
  try {
    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!metaResponse.ok) throw new Error("Failed to fetch spreadsheet metadata");
    const meta = await metaResponse.json();
    const existing = meta.sheets.find(s => s.properties.title === ATTENDANCE_SHEET_TITLE);
    
    if (existing) return existing.properties.sheetId;

    console.log(`Creating sheet: ${ATTENDANCE_SHEET_TITLE}...`);
    const createResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{
            addSheet: {
              properties: {
                title: ATTENDANCE_SHEET_TITLE,
                gridProperties: { rowCount: 1000, columnCount: 5 }
              }
            }
          }]
        }),
      }
    );
    
    if (!createResponse.ok) throw new Error("Failed to create attendance sheet");
    
    // Add Header
    await fetch(
       `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${ATTENDANCE_SHEET_TITLE}!A1:C1:append?valueInputOption=USER_ENTERED`,
       {
         method: "POST",
         headers: {
           Authorization: `Bearer ${accessToken}`,
           "Content-Type": "application/json",
         },
         body: JSON.stringify({
            values: [["Email", "Check In Time", "Date"]]
         })
       }
    );
  } catch (e) {
    console.error("Error ensuring attendance sheet:", e);
    throw e;
  }
};

export const logAttendance = async (email, checkInTime) => {
    try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("No access token");
        
        await ensureAttendanceSheet(accessToken);
        
        // Format date for simpler querying: YYYY-MM-DD
        // We use local date string for the 'Date' column to easily match 'today' specific to earlier simplistic logic, 
        // but ISO string is safer. Let's store ISO in Check In Time, and YYYY-MM-DD in Date column.
        const dateStr = checkInTime.toISOString().split('T')[0];
        
        const values = [[ email, checkInTime.toISOString(), dateStr ]];
        
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${ATTENDANCE_SHEET_TITLE}!A:C:append?valueInputOption=USER_ENTERED`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ values }),
          }
        );
        return true;
    } catch (e) {
        console.error("Failed to log attendance:", e);
        throw e;
    }
};

export const getTodayAttendance = async (email) => {
    try {
        const accessToken = await getAccessToken();
        if (!accessToken) return null;
        
        // Ensure sheet exists before reading (Lazy Init)
        try {
            await ensureAttendanceSheet(accessToken);
        } catch (e) {
            console.warn("Could not ensure sheet exists, trying to read anyway:", e);
        }
        
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${ATTENDANCE_SHEET_TITLE}!A:C?t=${new Date().getTime()}`,
          { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
        );
        
        if (!response.ok) return null;

        const data = await response.json();
        if (!data.values || data.values.length <= 1) return null;
        
        const todayStr = new Date().toISOString().split('T')[0];
        
        const entry = data.values.find(row => row[0] === email && row[2] === todayStr);
        
        if (entry) {
            return new Date(entry[1]);
        }
        return null;
    } catch (e) {
        console.warn("Failed to fetch today's attendance:", e);
        return null;
    }
};

export const deleteTodayAttendance = async (email) => {
    try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("No access token");

        // 1. Get sheet ID for ATTENDANCE_LOG
        const metaResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const meta = await metaResponse.json();
        const sheet = meta.sheets.find(s => s.properties.title === ATTENDANCE_SHEET_TITLE);
        if (!sheet) throw new Error("Sheet not found");
        const sheetId = sheet.properties.sheetId;

        // 2. Fetch data to find row index
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${ATTENDANCE_SHEET_TITLE}!A:C?t=${new Date().getTime()}`,
          { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
        );
        
        if (!response.ok) throw new Error("Failed to fetch data");
        const data = await response.json();
        if (!data.values || data.values.length <= 1) return false; // Nothing to delete

        const todayStr = new Date().toISOString().split('T')[0];
        
        // Find ALL matching rows indices (in reverse order to not mess up indices when deleting multiple?)
        // Requirement says "delete the correct row". Assuming one per day.
        const rowIndex = data.values.findIndex(row => row[0] === email && row[2] === todayStr);
        
        if (rowIndex === -1) return false;

        console.log(`Deleting row ${rowIndex} for ${email}`);

        // 3. Delete the row
        const deleteResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requests: [{
                deleteDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: "ROWS",
                    startIndex: rowIndex,
                    endIndex: rowIndex + 1
                  }
                }
              }]
            }),
          }
        );

        if (!deleteResponse.ok) throw new Error(await deleteResponse.text());
        return true;

    } catch (e) {
        console.error("Failed to delete attendance:", e);
        throw e;
    }
};
