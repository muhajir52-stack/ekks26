/**
 * ============================================================================
 * SIMS SMA DARUL ULUM KEPOHBARU — GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * Lokasi: Kepohbaru, Bojonegoro, Jawa Timur
 * Deskripsi: Server Web App & Sinkronisasi Database Google Sheets untuk
 *            seluruh modul SIMS (Akademik, Absensi, Arsip Digital, Supervisi
 *            Digital 88 Butir & TTD Pengawas, CMS Web Profil, Grafik D3.js).
 * ============================================================================
 */

var SIMS_SPREADSHEET_PROP_KEY = 'SIMS_SPREADSHEET_ID';
var SIMS_CHUNK_LIMIT = 45000; // Batas aman karakter per sel Google Sheets (maks 50.000)

var SIMS_COLLECTION_SHEETS = {
  sims_quick_students: 'students',
  sims_quick_teachers: 'teachers',
  sims_quick_classes: 'classes',
  sims_quick_subjects: 'subjects',
  sims_quick_academic_years: 'academic_years',
  sims_quick_grades: 'grades',
  sims_quick_attendance: 'attendance',
  sims_quick_attendance_notifications: 'attendance_notifications',
  sims_quick_archive_folders: 'archive_folders',
  sims_quick_digital_archives: 'digital_archives',
  sims_quick_supervision_instruments: 'supervision_instruments',
  sims_quick_supervision_indicators: 'supervision_indicators',
  sims_quick_supervision_schedules: 'supervision_schedules',
  sims_quick_supervision_assessments: 'supervision_assessments',
  sims_quick_supervision_officers: 'supervision_officers',
  sims_quick_activity_logs: 'activity_logs',
  sims_quick_school_content: 'school_content',
  sims_quick_news: 'news',
  sims_quick_announcements: 'announcements',
  sims_quick_academic_events: 'academic_events',
  sims_quick_achievements: 'achievements',
  sims_quick_gallery_items: 'gallery_items',
  sims_quick_public_directory: 'public_directory',
  sims_quick_users: 'users',
  sims_daily_backup_history: 'backup_history'
};

/**
 * Entry point Web App Google Apps Script.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('SIMS SMA Darul Ulum Kepohbaru — Sistem Informasi Manajemen Sekolah')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Menambahkan menu khusus di Google Sheets apabila script terikat (Container-bound).
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('SIMS SMA Darul Ulum')
      .addItem('Inisialisasi / Periksa Sheet Database', 'setupSimsDatabase')
      .addItem('Simpan Backup JSON ke Google Drive', 'simsExportFullBackupToDrive')
      .addToUi();
  } catch (err) {
    // Abaikan jika dijalankan dalam mode standalone
  }
}

/**
 * Mengambil atau membuat Google Spreadsheet sebagai penyimpanan database SIMS.
 */
function getSimsSpreadsheet_() {
  var active = null;
  try {
    active = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    active = null;
  }
  if (active) {
    return active;
  }

  var props = PropertiesService.getScriptProperties();
  var savedId = props.getProperty(SIMS_SPREADSHEET_PROP_KEY);
  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (e) {
      // Buat spreadsheet baru apabila ID lama tidak ditemukan/dihapus
    }
  }

  var ss = SpreadsheetApp.create('Database SIMS SMA Darul Ulum Kepohbaru');
  props.setProperty(SIMS_SPREADSHEET_PROP_KEY, ss.getId());
  return ss;
}

/**
 * Mengambil atau menyiapkan tab Sheet untuk koleksi tertentu.
 */
function getOrCreateCollectionSheet_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, 5).setValues([
      ['ID', 'Ringkasan', 'Jenis_Data', 'Terakhir_Diperbarui', 'Payload_JSON']
    ]);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#ecfdf5');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Menginisialisasi seluruh tab sheet database SIMS.
 */
function setupSimsDatabase() {
  var ss = getSimsSpreadsheet_();
  var keys = Object.keys(SIMS_COLLECTION_SHEETS);
  for (var i = 0; i < keys.length; i++) {
    getOrCreateCollectionSheet_(ss, SIMS_COLLECTION_SHEETS[keys[i]]);
  }
  return {
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    totalSheets: keys.length
  };
}

/**
 * Memecah string JSON panjang agar aman disimpan di sel Google Sheets.
 */
function chunkJsonString_(str) {
  if (!str) return [''];
  var chunks = [];
  for (var i = 0; i < str.length; i += SIMS_CHUNK_LIMIT) {
    chunks.push(str.substring(i, i + SIMS_CHUNK_LIMIT));
  }
  return chunks;
}

/**
 * Membuat ringkasan teks yang mudah dibaca di Google Sheets untuk setiap item.
 */
function buildReadableSummary_(item, fallbackId) {
  if (!item || typeof item !== 'object') return String(fallbackId || '-');
  return (
    item.name ||
    item.title ||
    item.studentName ||
    item.assessedPersonName ||
    item.supervisorName ||
    item.targetName ||
    item.action ||
    item.displayName ||
    item.sectionKey ||
    String(fallbackId || '-')
  );
}

/**
 * Mengambil seluruh koleksi SIMS dari Google Sheets untuk hidrasi frontend.
 */
function simsGetAllCollections() {
  var ss = getSimsSpreadsheet_();
  var collections = {};
  var keys = Object.keys(SIMS_COLLECTION_SHEETS);

  for (var i = 0; i < keys.length; i++) {
    var quickKey = keys[i];
    var sheetName = SIMS_COLLECTION_SHEETS[quickKey];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 5) continue;

    var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    if (quickKey === 'sims_quick_school_content') {
      var recordObj = {};
      var hasRecord = false;
      for (var r = 0; r < values.length; r++) {
        var rowId = String(values[r][0] || '');
        var jsonStr = '';
        for (var c = 4; c < values[r].length; c++) {
          if (values[r][c]) jsonStr += String(values[r][c]);
        }
        if (rowId && jsonStr) {
          try {
            recordObj[rowId] = JSON.parse(jsonStr);
            hasRecord = true;
          } catch (e) {
            // Lewati baris rusak
          }
        }
      }
      if (hasRecord) {
        collections[quickKey] = recordObj;
      }
    } else {
      var arr = [];
      for (var r2 = 0; r2 < values.length; r2++) {
        var rowType = String(values[r2][2] || '');
        if (rowType === 'EMPTY_ARRAY_MARKER') {
          collections[quickKey] = [];
          arr = null;
          break;
        }
        var itemJson = '';
        for (var c2 = 4; c2 < values[r2].length; c2++) {
          if (values[r2][c2]) itemJson += String(values[r2][c2]);
        }
        if (itemJson) {
          try {
            arr.push(JSON.parse(itemJson));
          } catch (e) {
            // Lewati baris rusak
          }
        }
      }
      if (arr !== null && arr.length > 0) {
        collections[quickKey] = arr;
      }
    }
  }

  return {
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    collections: collections
  };
}

/**
 * Menyimpan satu koleksi SIMS (array atau record object) dari frontend ke Google Sheets.
 */
function simsSaveCollection(quickKey, jsonString) {
  var sheetName = SIMS_COLLECTION_SHEETS[quickKey];
  if (!sheetName) {
    throw new Error('Koleksi tidak dikenal: ' + quickKey);
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var ss = getSimsSpreadsheet_();
    var sheet = getOrCreateCollectionSheet_(ss, sheetName);
    var parsed = JSON.parse(jsonString);
    var nowIso = new Date().toISOString();
    var rows = [];
    var maxCols = 5;

    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        rows.push(['__EMPTY__', '(Kosong)', 'EMPTY_ARRAY_MARKER', nowIso, '[]']);
      } else {
        for (var i = 0; i < parsed.length; i++) {
          var item = parsed[i];
          var itemId = (item && item.id) ? String(item.id) : ('row_' + (i + 1));
          var summary = buildReadableSummary_(item, itemId);
          var chunks = chunkJsonString_(JSON.stringify(item));
          var row = [itemId, summary, 'RECORD', nowIso].concat(chunks);
          if (row.length > maxCols) maxCols = row.length;
          rows.push(row);
        }
      }
    } else if (parsed && typeof parsed === 'object') {
      var objKeys = Object.keys(parsed);
      for (var j = 0; j < objKeys.length; j++) {
        var k = objKeys[j];
        var entry = parsed[k];
        var entrySummary = buildReadableSummary_(entry, k);
        var entryChunks = chunkJsonString_(JSON.stringify(entry));
        var objRow = [k, entrySummary, 'CONTENT_SECTION', nowIso].concat(entryChunks);
        if (objRow.length > maxCols) maxCols = objRow.length;
        rows.push(objRow);
      }
    }

    // Samakan panjang kolom semua baris
    for (var r = 0; r < rows.length; r++) {
      while (rows[r].length < maxCols) {
        rows[r].push('');
      }
    }

    // Pastikan header overflow tersedia jika ada payload panjang
    if (maxCols > 5) {
      var headers = ['ID', 'Ringkasan', 'Jenis_Data', 'Terakhir_Diperbarui', 'Payload_JSON'];
      for (var c = 6; c <= maxCols; c++) {
        headers.push('Payload_JSON_' + (c - 4));
      }
      sheet.getRange(1, 1, 1, maxCols).setValues([headers]).setFontWeight('bold').setBackground('#ecfdf5');
    }

    var existingLastRow = sheet.getLastRow();
    if (existingLastRow > 1) {
      sheet.getRange(2, 1, existingLastRow - 1, sheet.getMaxColumns()).clearContent();
    }

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, maxCols).setValues(rows);
    }

    return {
      ok: true,
      sheetName: sheetName,
      savedRows: rows.length,
      spreadsheetUrl: ss.getUrl()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Mengembalikan informasi koneksi database Google Sheets.
 */
function simsGetDatabaseInfo() {
  var ss = getSimsSpreadsheet_();
  return {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl()
  };
}

/**
 * Memulihkan data dari payload JSON backup harian SIMS ke Google Sheets.
 */
function simsRestoreBackupFromJson(backupJsonString) {
  var payload = JSON.parse(backupJsonString);
  var cols = payload && payload.collections ? payload.collections : {};
  var restored = 0;
  var reverseSheetMap = {};
  var quickKeys = Object.keys(SIMS_COLLECTION_SHEETS);
  for (var i = 0; i < quickKeys.length; i++) {
    reverseSheetMap[SIMS_COLLECTION_SHEETS[quickKeys[i]]] = quickKeys[i];
  }

  var colNames = Object.keys(cols);
  for (var j = 0; j < colNames.length; j++) {
    var colName = colNames[j];
    var quickKey = reverseSheetMap[colName];
    if (!quickKey) continue;
    var data = cols[colName];
    if (colName === 'school_content' && Array.isArray(data)) {
      var mapObj = {};
      for (var k = 0; k < data.length; k++) {
        var entry = data[k];
        if (entry && (entry.sectionKey || entry.id)) {
          mapObj[String(entry.sectionKey || entry.id)] = entry;
        }
      }
      simsSaveCollection(quickKey, JSON.stringify(mapObj));
    } else {
      simsSaveCollection(quickKey, JSON.stringify(data));
    }
    restored += 1;
  }

  return {
    ok: true,
    restoredCollections: restored
  };
}

/**
 * Menyimpan file cadangan JSON harian langsung ke Google Drive pengguna.
 */
function simsExportFullBackupToDrive() {
  var data = simsGetAllCollections();
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd');
  var fileName = 'Backup_Harian_SIMS_SMADU_' + today + '.json';
  var payload = {
    metadata: {
      systemName: 'Sistem Informasi Manajemen Sekolah (SIMS)',
      institution: 'SMA Darul Ulum Kepohbaru',
      location: 'Kepohbaru, Bojonegoro, Jawa Timur',
      backupType: 'Backup Database Harian (Google Apps Script)',
      exportedAt: new Date().toISOString(),
      exportedDate: today,
      spreadsheetUrl: data.spreadsheetUrl
    },
    collections: data.collections
  };
  var file = DriveApp.createFile(fileName, JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);
  return {
    fileName: file.getName(),
    fileUrl: file.getUrl(),
    fileId: file.getId()
  };
}
