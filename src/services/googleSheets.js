// Google Sheets Helper
const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;

// Cache Keys
export const CACHE_KEYS = {
  NETWORKS: 'cigro_networks',
  ATTENDANCE: 'cigro_attendance',
  ALL_RECORDS: 'cigro_all_records'
};

// Cache Helpers
export const saveToCache = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
  } catch (e) {
    console.warn('Failed to save to cache', e);
  }
};

export const getFromCache = (key) => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    const parsed = JSON.parse(item);
    return parsed.data;
  } catch (e) {
    console.warn('Failed to get from cache', e);
    return null;
  }
};

export const clearAppCache = () => {
  try {
    Object.keys(localStorage).forEach(key => {
      // Remove all keys starting with 'cigro_' OR 'cigr_'
      if (key.startsWith('cigro_') || key.startsWith('cigr_')) {
        console.log(`🗑️ Deleting cache key: ${key}`);
        localStorage.removeItem(key);
      }
    });
    console.log('🧹 App cache cleared completely');
  } catch (e) {
    console.warn('Failed to clear app cache', e);
  }
};

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
  // Try cache first
  const cached = getFromCache(CACHE_KEYS.NETWORKS);
  if (cached) {
    console.log('📦 Using cached networks');
    return cached;
  }

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
    const networks = data.values.slice(1).map(row => row[0]).filter(ip => ip);
    
    // Save to cache
    saveToCache(CACHE_KEYS.NETWORKS, networks);
    
    return networks;
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
        
        // Invalidate relevant caches
        const cacheKey = `${CACHE_KEYS.ATTENDANCE}_${email}_${dateStr}`;
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(CACHE_KEYS.ALL_RECORDS);
        
        return true;
    } catch (e) {
        console.error("Failed to log attendance:", e);
        throw e;
    }
};

export const getTodayAttendance = async (email, skipCache = false) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const cacheKey = `${CACHE_KEYS.ATTENDANCE}_${email}_${todayStr}`;
    
    // Try cache first (unless skipped)
    if (!skipCache) {
        const cached = getFromCache(cacheKey);
        if (cached) {
            console.log('📦 Using cached attendance');
            return new Date(cached);
        }
    }

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
        
        const entry = data.values.find(row => row[0] === email && row[2] === todayStr);
        
        if (entry) {
            const attendanceDate = new Date(entry[1]);
            // Save to cache
            saveToCache(cacheKey, attendanceDate.toISOString());
            return attendanceDate;
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
        
        // Invalidate relevant caches
        const dateStr = new Date().toISOString().split('T')[0];
        const cacheKey = `${CACHE_KEYS.ATTENDANCE}_${email}_${dateStr}`;
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(CACHE_KEYS.ALL_RECORDS);
        
        return true;

    } catch (e) {
        console.error("Failed to delete attendance:", e);
        throw e;
    }
};
// Helper to get direct link to Attendance Sheet (gid)
export const getAttendanceSheetUrl = async () => {
  try {
    const accessToken = await getAccessToken();
    // Fallback if no token (public/readonly access might not work with API but link usually works without GID if public)
    if (!accessToken) return `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;

    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!metaResponse.ok) return `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;

    const meta = await metaResponse.json();
    const sheet = meta.sheets.find(s => s.properties.title === ATTENDANCE_SHEET_TITLE);
    
    if (sheet) {
        return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${sheet.properties.sheetId}`;
    }
    return `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;
  } catch (e) {
    console.warn("Failed to get sheet GID", e);
    return `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;
  }
};

export const getAllAttendance = async (skipCache = false) => {
  // Try cache first (unless skipped)
  if (!skipCache) {
    const cached = getFromCache(CACHE_KEYS.ALL_RECORDS);
    if (cached) {
      console.log('📦 Using cached all records');
      return cached;
    }
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("No access token");

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${ATTENDANCE_SHEET_TITLE}!A:C?t=${new Date().getTime()}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    );
    
    if (!response.ok) throw new Error("Failed to fetch data");
    const data = await response.json();
    if (!data.values || data.values.length <= 1) return [];

    // Skip header and map
    const records = data.values.slice(1).map(row => ({
      email: row[0],
      checkInTime: row[1],
      dateStr: row[2]
    })).reverse(); // Show newest first
    
    // Save to cache
    saveToCache(CACHE_KEYS.ALL_RECORDS, records);
    
    return records;
  } catch (e) {
    console.warn("Failed to fetch all attendance:", e);
    return [];
  }
};
// ==========================================
// USER PREFERENCES (Daily Reminders)
// ==========================================

const PREFS_SHEET_TITLE = "USER_PREFERENCES";

const ensurePreferencesSheet = async (accessToken) => {
  try {
    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!metaResponse.ok) throw new Error("Failed to fetch spreadsheet metadata");
    const meta = await metaResponse.json();
    const existing = meta.sheets.find(s => s.properties.title === PREFS_SHEET_TITLE);
    
    if (existing) return existing.properties.sheetId;

    console.log(`Creating sheet: ${PREFS_SHEET_TITLE}...`);
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
                title: PREFS_SHEET_TITLE,
                gridProperties: { rowCount: 1000, columnCount: 5 }
              }
            }
          }]
        }),
      }
    );
    
    if (!createResponse.ok) throw new Error("Failed to create preferences sheet");
    
    // Add Header
    await fetch(
       `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${PREFS_SHEET_TITLE}!A1:E1:append?valueInputOption=USER_ENTERED`,
       {
         method: "POST",
         headers: {
           Authorization: `Bearer ${accessToken}`,
           "Content-Type": "application/json",
         },
         body: JSON.stringify({
            values: [["Email", "Enabled", "TimeSlot", "LastUpdated", "LastNotifiedDate"]]
         })
       }
    );
  } catch (e) {
    console.error("Error ensuring preferences sheet:", e);
    throw e;
  }
};

export const getUserPreferences = async (email) => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;

    // Ensure exists
    try { await ensurePreferencesSheet(accessToken); } catch (e) {}

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${PREFS_SHEET_TITLE}!A:D?t=${new Date().getTime()}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    );
    
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.values || data.values.length <= 1) return null;

    // Find row
    const row = data.values.find(r => r[0] === email);
    if (!row) return null;

    // Handle "TRUE", "true", true (bool)
    const rawEnabled = row[1];
    const isEnabled = (rawEnabled === true || String(rawEnabled).toUpperCase() === "TRUE");

    return {
      email: row[0],
      enabled: isEnabled,
      timeSlot: row[2] || "8",
      lastUpdated: row[3] // Column D
    };

  } catch (e) {
    console.warn("Failed to get preferences:", e);
    return null;
  }
};

export const updateUserPreferences = async (email, enabled, timeSlot) => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("No access token");

    await ensurePreferencesSheet(accessToken);

    // 1. Fetch all data to find index
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${PREFS_SHEET_TITLE}!A:D?t=${new Date().getTime()}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    );
    const data = await response.json();
    const rows = data.values || [];
    
    let rowIndex = -1;
    // Start from index 1 (skip header)
    for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === email) {
            rowIndex = i + 1; // 1-based index for API
            break;
        }
    }

    const timestamp = new Date().toISOString();
    // WRITE RAW BOOLEAN (true/false) NOT STRING "TRUE"/"FALSE"
    // Google Sheets treats raw boolean true as TRUE cell value
    const values = [[ email, enabled, String(timeSlot), timestamp ]];
    
    console.log("Updating sheet with values (CHECK ENABLED):", values); // DEBUG LOG

    if (rowIndex !== -1) {
        // UPDATE existing row
        console.log(`Updating prefs for ${email} at row ${rowIndex}`);
        await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${PREFS_SHEET_TITLE}!A${rowIndex}:D${rowIndex}?valueInputOption=USER_ENTERED`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ values })
            }
        );
    } else {
        // APPEND new row
        console.log(`Creating new prefs for ${email}`);
        await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${PREFS_SHEET_TITLE}!A:D:append?valueInputOption=USER_ENTERED`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ values })
            }
        );
    }
    return true;

  } catch (e) {
    console.error("Failed to update preferences:", e);
    throw e;
  }
};
