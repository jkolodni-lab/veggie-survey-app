// ============================================================
// Google Apps Script - Survey Backend
// ============================================================
// SETUP INSTRUCTIONS:
// 1. Go to https://script.google.com
// 2. Create a new project, name it "Survey Backend"
// 3. Delete everything in Code.gs
// 4. Copy-paste ALL of this code into Code.gs
// 5. Click "Deploy" > "New deployment"
// 6. Choose "Web app"
// 7. Set "Execute as" = Me
// 8. Set "Who has access" = Anyone
// 9. Click "Deploy" and copy the URL
// 10. Paste the URL into the survey HTML file (replace GOOGLE_SCRIPT_URL)
// ============================================================

const SHEET_NAME = 'responses';
const SUMMARY_SHEET = 'summary';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Create or get responses sheet
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      // Add headers
      const headers = [
        'Timestamp', 'Name', 'Phone', 'Family Size', 'Buy Location', 'Area',
        'Weekly Spend', 'Prefer Hydroponic', 'Subscription Interest', 'General Notes',
        'Category', 'Product', 'Quantity', 'Unit', 'Product Notes'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    const timestamp = new Date().toLocaleString('he-IL');

    if (data.products && data.products.length > 0) {
      // One row per product
      const rows = data.products.map((p, i) => [
        timestamp,
        data.name,
        data.phone,
        data.familySize,
        data.buyLocation,
        data.area,
        i === 0 ? data.weeklySpend : '',
        i === 0 ? data.preferHydro : '',
        i === 0 ? data.subscription : '',
        i === 0 ? data.generalNotes : '',
        p.category,
        p.product,
        p.quantity,
        p.unit,
        p.notes
      ]);
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    } else {
      // No products selected - still save the respondent info
      const row = [
        timestamp, data.name, data.phone, data.familySize, data.buyLocation,
        data.area, data.weeklySpend, data.preferHydro, data.subscription,
        data.generalNotes, '', 'No products selected', '', '', ''
      ];
      sheet.appendRow(row);
    }

    // Update summary
    updateSummary(ss);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', message: 'Data saved' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet || sheet.getLastRow() <= 1) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', data: [], respondents: 0 }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  // Count unique respondents
  const uniqueNames = [...new Set(rows.map(r => r['Name'] + '|' + r['Phone']))];

  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'success',
      data: rows,
      respondents: uniqueNames.length
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function updateSummary(ss) {
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) return;

  let summary = ss.getSheetByName(SUMMARY_SHEET);
  if (!summary) {
    summary = ss.insertSheet(SUMMARY_SHEET);
  }
  summary.clear();

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  // Count respondents
  const respondents = [...new Set(rows.map(r => r[1] + '|' + r[2]))];

  // Count products
  const productCounts = {};
  const productQuantities = {};
  rows.forEach(row => {
    const product = row[11]; // Product column
    const qty = parseFloat(row[12]) || 0;
    if (product && product !== 'No products selected') {
      productCounts[product] = (productCounts[product] || 0) + 1;
      productQuantities[product] = (productQuantities[product] || 0) + qty;
    }
  });

  // Write summary
  summary.getRange(1, 1).setValue('Survey Summary - Auto Updated');
  summary.getRange(1, 1).setFontSize(14).setFontWeight('bold');

  summary.getRange(3, 1).setValue('Total Respondents:');
  summary.getRange(3, 2).setValue(respondents.length);

  summary.getRange(5, 1, 1, 4).setValues([['Product', 'Times Selected', 'Total Weekly Qty', 'Avg per Family']]);
  summary.getRange(5, 1, 1, 4).setFontWeight('bold');

  const sortedProducts = Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1]);

  sortedProducts.forEach(([ product, count ], i) => {
    const row = 6 + i;
    const totalQty = productQuantities[product] || 0;
    summary.getRange(row, 1).setValue(product);
    summary.getRange(row, 2).setValue(count);
    summary.getRange(row, 3).setValue(totalQty);
    summary.getRange(row, 4).setValue(respondents.length > 0 ? (totalQty / respondents.length).toFixed(1) : 0);
  });
}

// Test function - run this to create initial sheet structure
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = [
      'Timestamp', 'Name', 'Phone', 'Family Size', 'Buy Location', 'Area',
      'Weekly Spend', 'Prefer Hydroponic', 'Subscription Interest', 'General Notes',
      'Category', 'Product', 'Quantity', 'Unit', 'Product Notes'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  Logger.log('Setup complete! Sheet ready.');
}
