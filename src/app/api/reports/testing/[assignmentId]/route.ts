import { NextRequest, NextResponse } from 'next/server';
// This function is
// 1. Not provided, so I cannot edit it.
// 2. Assumed to be updated on your backend to return the new 'ReportData' shape.
import { getFullReportData } from '../../../../../../services/reports';
import PDFDocument from 'pdfkit';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

// --- Constants for Styling ---
// *** FIX 2: Changed from 'const' to 'let' to allow custom fonts to override them ***
let FONT_REGULAR = 'Times-Roman';
let FONT_BOLD = 'Times-Bold';
let FONT_ITALIC = 'Times-Italic';
let FONT_BOLD_ITALIC = 'Times-BoldItalic';
const COLOR_PRIMARY = '#DC2626'; // A strong red
const COLOR_SECONDARY = '#1F2937'; // Dark gray
const COLOR_TEXT = '#11182B'; // Near black
const COLOR_MUTED = '#6B7280'; // Lighter gray
const COLOR_GREEN = '#047857'; // Success
const COLOR_RED = '#B91C1C'; // Fail
const COLOR_YELLOW = '#A16207'; // Pending
const COLOR_BLUE = '#1D4ED8'; // Assigned
const COLOR_BG_LIGHT = '#F9FAFB'; // Light row background
const COLOR_BORDER = '#E5E7EB'; // Table border
const PAGE_MARGIN = 40;

// --- New Type Definitions (Based on your new requirements) ---
interface FirebaseTimestamp {
  toDate: () => Date;
}

// From /students collection
interface Student {
  id: string;
  name: string;
  email: string;
  subgroup: string;
}

// Hydrated team member (for display)
interface HydratedTeamMember {
  id: string;
  name: string;
  email: string;
  subgroup: string;
  isLeader: boolean;
}

// Hydrated team (for display)
interface HydratedTeam {
  teamName: string;
  members: HydratedTeamMember[];
}

// From /projects collection
interface Project {
  id: string;
  title: string; // 'Project Name'
  description: string; // 'Project Description'
  submissionTime: FirebaseTimestamp; // 'Submission Time'
  status: string; // 'Status'
  techStack: string; // 'Tech Stack' (assuming string for simplicity)
  githubLink: string; // 'Github Link'
  deployedLink: string; // 'Deployed Link'
}

// From /linkReports collection
interface LinkReportLog {
  timestamp: FirebaseTimestamp;
  action: string;
  description: string;
}
interface LinkReport {
  id: string;
  logs: LinkReportLog[];
  proposedNewLink: string;
  status: string;
  reportingTeamName: string; // Assumed to be pre-fetched
}

// From /testcases collection
interface TestCase {
  id: string;
  testcaseName: string;
  testDescription: string;
  designedBy: string;
  expectedResults: string;
  actualResult?: string;
  debuggingReport?: string;
  testStatus: 'pending' | 'pass' | 'fail';
  metadataImageUrl: string | null;
  testedBy: string | null;
  creationTime: FirebaseTimestamp;
  resultSubmissionTime?: FirebaseTimestamp;
  severity?: 'low' | 'medium' | 'high';
}

// From /assignments collection (hydrated)
interface HydratedAssignment {
  id: string;
  status: string;
  testingTeam: HydratedTeam; // The team that performed this assignment
  testCases: TestCase[]; // All test cases for this assignment
}

// The new "master" data object
// Assumes getFullReportData(assignmentId) finds the project
// and returns all related data.
interface ReportData {
  project: Project;
  originalTeam: HydratedTeam;
  linkReports: LinkReport[];
  assignments: HydratedAssignment[]; // All testing assignments for the project
}

// --- Helper Functions ---

/**
 * Fetches an image from a URL and returns it as a Buffer.
 */
async function fetchImage(url: string) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
  } catch (err) {
    console.error(`Failed to fetch image: ${url}`, err);
    return null;
  }
}

/**
 * Formats a Firebase Timestamp into a readable string.
 */
function formatTimestamp(ts?: FirebaseTimestamp) {
  try {
    if (ts && typeof ts.toDate === 'function') {
      return ts.toDate().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch (error) {
    // Handle invalid timestamps
  }
  return 'N/A';
}

/**
 * Gets the color code for a status string.
 */
function getStatusColor(status: string) {
  switch (status?.toUpperCase()) {
    case 'COMPLETED':
    case 'CLOSED':
    case 'PASS':
      return COLOR_GREEN;
    case 'ASSIGNED':
      return COLOR_BLUE;
    case 'UNASSIGNED':
    case 'PENDING':
      return COLOR_YELLOW;
    case 'BLOCKED_LINK':
    case 'FAIL':
      return COLOR_RED;
    default:
      return COLOR_MUTED;
  }
}

/**
 * Adds a new page if the current Y position is past the threshold.
 * Returns the new Y position (either the same or the top margin).
 */
function checkPageBreak(doc: PDFKit.PDFDocument, currentY: number, threshold = 100) {
  if (currentY > doc.page.height - PAGE_MARGIN - threshold) {
    doc.addPage();
    return PAGE_MARGIN;
  }
  return currentY;
}

/**
 * Draws a main section header.
 */
function drawSectionHeader(doc: PDFKit.PDFDocument, title: string, y: number) {
  doc
    .fontSize(18)
    .font(FONT_BOLD)
    .fillColor(COLOR_SECONDARY)
    .text(title, PAGE_MARGIN, y);
  
  // Underline
  doc
    .strokeColor(COLOR_PRIMARY)
    .lineWidth(2)
    .moveTo(PAGE_MARGIN, doc.y + 2)
    .lineTo(PAGE_MARGIN + 150, doc.y + 2)
    .stroke();
    
  doc.moveDown(1);
  return doc.y;
}

/**
 * Draws the "Project Details" table with continuous text flow
 */
function drawProjectDetails(doc: PDFKit.PDFDocument, project: Project, y: number) {
  let tableY = drawSectionHeader(doc, 'Project Details:', y);
  const startX = PAGE_MARGIN;
  const keyWidth = 150;
  const valueWidth = doc.page.width - PAGE_MARGIN * 2 - keyWidth;
  const valueX = startX + keyWidth;

  const data = {
    'Project Name': project.title,
    'Project Description': project.description,
    'Submission Time': formatTimestamp(project.submissionTime),
    'Status': project.status,
    'Tech Stack': project.techStack,
    'GitHub Link': project.githubLink,
    'Deployed Link': project.deployedLink,
  };

  doc.font(FONT_REGULAR).fontSize(10);

  for (const [key, value] of Object.entries(data)) {
    const val = value || 'N/A';
    
    // Check if we need a page break before starting this row
    tableY = checkPageBreak(doc, tableY, 50);
    
    // Get the starting Y position for this row
    const startRowY = tableY;
    
    // Draw the Key text in the first column
    doc.fillColor(COLOR_TEXT).font(FONT_BOLD);
    doc.text(key, startX, startRowY, { width: keyWidth - 10, continued: false });
    const keyEndY = doc.y;
    
    // Draw the Value text in the second column, starting at the same Y as the key
    doc.fillColor(COLOR_TEXT).font(FONT_REGULAR);
    
    // Handle link formatting for GitHub and Deployed links
    if (key.includes('Link') && val !== 'N/A') {
      doc.fillColor(COLOR_BLUE);
      doc.text(val, valueX, startRowY, {
        width: valueWidth - 10,
        continued: false,
        link: val,
        underline: true
      });
    } else {
      doc.text(val, valueX, startRowY, {
        width: valueWidth - 10,
        continued: false
      });
    }
    
    const valueEndY = doc.y;
    
    // Set the Y position to be after whichever text was longer, plus margin
    tableY = Math.max(keyEndY, valueEndY);
    doc.moveDown(1.5); // Add consistent spacing between rows
    tableY = doc.y;
    
    // Reset color for next iteration
    doc.fillColor(COLOR_TEXT);
  }
  
  return tableY;
}

/**
 * Draws the table for Team Details.
 */
function drawTeamDetails(doc: PDFKit.PDFDocument, team: HydratedTeam, title: string, y: number) {
  let tableY = drawSectionHeader(doc, title, y);
  doc.fontSize(14).font(FONT_BOLD).fillColor(COLOR_TEXT).text(team.teamName, PAGE_MARGIN, tableY);
  doc.moveDown(0.5);
  tableY = doc.y;
  
  const headers = ['Name', 'Role', 'Email', 'Subgroup'];
  const colWidths = [150, 80, 170, 115]; 
  
  // Draw Header
  let x = PAGE_MARGIN;
  doc.font(FONT_BOLD).fontSize(10);
  headers.forEach((header, i) => {
    doc.rect(x, tableY, colWidths[i], 25).fillAndStroke(COLOR_SECONDARY, COLOR_BORDER);
    doc.fillColor('#FFFFFF').text(header, x + 5, tableY + 8, { width: colWidths[i] - 10 });
    x += colWidths[i];
  });
  tableY += 25;

  // Draw Rows
  doc.font(FONT_REGULAR).fontSize(9);
  for (const member of team.members) {
    const role = member.isLeader ? 'Team Leader' : 'Member';
    const row = [member.name, role, member.email, member.subgroup];
    const rowHeight = doc.heightOfString(member.email, { width: colWidths[2] - 10 }) + 10;
    
    tableY = checkPageBreak(doc, tableY, rowHeight);
    let cellX = PAGE_MARGIN;
    const rowColor = member.isLeader ? '#FEF3C7' : (tableY % 2 === 0 ? '#FFFFFF' : COLOR_BG_LIGHT); // Highlight leader
    
    row.forEach((cell, i) => {
      doc.rect(cellX, tableY, colWidths[i], rowHeight).fillAndStroke(rowColor, COLOR_BORDER);
      doc.fillColor(COLOR_TEXT).text(cell, cellX + 5, tableY + 5, { width: colWidths[i] - 10 });
      cellX += colWidths[i];
    });
    tableY += rowHeight;
  }
  return tableY;
}

/**
 * Draws the table for Link Reports.
 */
function drawLinkReports(doc: PDFKit.PDFDocument, reports: LinkReport[], y: number) {
  let tableY = drawSectionHeader(doc, 'Link Reports', y);
  
  if (!reports || reports.length === 0) {
    doc.font(FONT_REGULAR).fontSize(10).fillColor(COLOR_MUTED).text('No link reports submitted for this project.', PAGE_MARGIN);
    return doc.y;
  }

  const headers = ['Reporting Team', 'New Link', 'Status', 'Logs'];
  const colWidths = [100, 150, 80, 220];

  // Draw Header
  let x = PAGE_MARGIN;
  doc.font(FONT_BOLD).fontSize(10);
  headers.forEach((header, i) => {
    doc.rect(x, tableY, colWidths[i], 25).fillAndStroke(COLOR_SECONDARY, COLOR_BORDER);
    doc.fillColor('#FFFFFF').text(header, x + 5, tableY + 8, { width: colWidths[i] - 10 });
    x += colWidths[i];
  });
  tableY += 25;

  // Draw Rows
  doc.font(FONT_REGULAR).fontSize(9);
  for (const report of reports) {
    // Format logs
    const logs = report.logs.map(log => `[${formatTimestamp(log.timestamp)}] ${log.action}: ${log.description}`).join('\n');
    const row = [report.reportingTeamName, report.proposedNewLink, report.status, logs];
    
    let maxHeight = 0;
    row.forEach((cell, i) => {
      const height = doc.heightOfString(cell, { width: colWidths[i] - 10 });
      if (height > maxHeight) maxHeight = height;
    });
    const rowHeight = maxHeight + 10;
    
    tableY = checkPageBreak(doc, tableY, rowHeight);
    let cellX = PAGE_MARGIN;
    const rowColor = (tableY % 2 === 0) ? '#FFFFFF' : COLOR_BG_LIGHT;

    row.forEach((cell, i) => {
      doc.rect(cellX, tableY, colWidths[i], rowHeight).fillAndStroke(rowColor, COLOR_BORDER);
      
      if (i === 2) { // Status column
        doc.fillColor(getStatusColor(cell)).font(FONT_BOLD).text(cell, cellX + 5, tableY + 5, { width: colWidths[i] - 10 });
      } else {
        doc.fillColor(COLOR_TEXT).font(FONT_REGULAR).text(cell, cellX + 5, tableY + 5, { width: colWidths[i] - 10 });
      }
      cellX += colWidths[i];
    });
    tableY += rowHeight;
  }
  return tableY;
}

/**
 * Draws a formatted debugging report table from JSON data.
 */
function drawDebuggingReportTable(doc: PDFKit.PDFDocument, reportString: string | undefined, y: number) {
  if (!reportString) {
    doc.font(FONT_REGULAR).fontSize(10).fillColor(COLOR_MUTED).text('No debugging report available.', PAGE_MARGIN, y);
    return doc.y + 10;
  }

  let reportData;
  try {
    // Try to parse as JSON
    reportData = JSON.parse(reportString);
  } catch (error) {
    // If parsing fails, fall back to drawing raw string
    doc.font(FONT_BOLD).fontSize(11).fillColor(COLOR_TEXT).text('Debugging Report:', PAGE_MARGIN, y);
    const startY = doc.y + 2;
    const textWidth = doc.page.width - PAGE_MARGIN * 2 - 10;
    const textHeight = doc.heightOfString(reportString, { width: textWidth });
    const boxHeight = textHeight + 10;

    doc.rect(PAGE_MARGIN, startY, doc.page.width - PAGE_MARGIN * 2, boxHeight).stroke(COLOR_BORDER);
    doc.font(FONT_REGULAR).fontSize(10).fillColor(COLOR_TEXT).text(reportString, PAGE_MARGIN + 5, startY + 5, {
      width: textWidth
    });

    return startY + boxHeight + 15;
  }

  // If we get here, JSON parsing succeeded
  doc.font(FONT_BOLD).fontSize(11).fillColor(COLOR_TEXT).text('Debugging Report:', PAGE_MARGIN, y);
  let tableY = doc.y + 10;

  const startX = PAGE_MARGIN;
  const keyWidth = 150;
  const valueWidth = doc.page.width - PAGE_MARGIN * 2 - keyWidth;

  // Helper function to format camelCase to readable text
  const formatKey = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .trim();
  };

  doc.font(FONT_REGULAR).fontSize(10);

  // Iterate through the parsed JSON object
  for (const [key, value] of Object.entries(reportData)) {
    const formattedKey = formatKey(key);
    const val = value?.toString() || 'N/A';
    
    const rowHeight = Math.max(
      doc.heightOfString(formattedKey, { width: keyWidth - 10 }),
      doc.heightOfString(val, { width: valueWidth - 10 })
    ) + 10; // 5px padding top/bottom

    tableY = checkPageBreak(doc, tableY, rowHeight);

    // Key Cell
    doc.rect(startX, tableY, keyWidth, rowHeight).fillAndStroke(COLOR_BG_LIGHT, COLOR_BORDER);
    doc.fillColor(COLOR_TEXT).font(FONT_BOLD).text(formattedKey, startX + 5, tableY + 5, { width: keyWidth - 10 });

    // Value Cell
    doc.rect(startX + keyWidth, tableY, valueWidth, rowHeight).fillAndStroke('#FFFFFF', COLOR_BORDER);
    doc.fillColor(COLOR_TEXT).font(FONT_REGULAR).text(val, startX + keyWidth + 5, tableY + 5, {
      width: valueWidth - 10
    });

    tableY += rowHeight;
  }

  return tableY + 15;
}

/**
 * Draws the Test Case Summary cards (image_cf1fda.png)
 * (Updated to center-align text and remove broken icons)
 */
function drawSummaryCards(doc: PDFKit.PDFDocument, pass: number, fail: number, pending: number, y: number) {
  let cardY = drawSectionHeader(doc, 'Test Case Summary (All Assignments)', y);
  const cardWidth = 160;
  const cardHeight = 80; // Increased height for better spacing
  const spacing = (doc.page.width - PAGE_MARGIN * 2 - (cardWidth * 3)) / 2;

  const cardData = [
    { title: 'Pass', value: pass, color: '#F0FDF4', borderColor: '#A7F3D0', textColor: COLOR_GREEN },
    { title: 'Fail', value: fail, color: '#FEF2F2', borderColor: '#FECACA', textColor: COLOR_RED },
    { title: 'Pending', value: pending, color: '#FEFCE8', borderColor: '#FEF08A', textColor: COLOR_YELLOW },
  ];

  let cardX = PAGE_MARGIN;

  for (const card of cardData) {
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 5).fillAndStroke(card.color, card.borderColor);
    
    // Centered Number
    doc
      .fontSize(32) // Larger font for the number
      .font(FONT_BOLD)
      .fillColor(card.textColor)
      .text(card.value.toString(), cardX, cardY + 20, { // Adjusted Y
        width: cardWidth,
        align: 'center'
      });
      
    // Centered Title
    doc
      .fontSize(14)
      .font(FONT_REGULAR)
      .fillColor(card.textColor)
      .text(card.title, cardX, cardY + 55, { // Adjusted Y
        width: cardWidth,
        align: 'center'
      });
      
    cardX += cardWidth + spacing;
  }
  return cardY + cardHeight + 20; // Return Y after the cards
}

/**
 * Draws a single, full-page Test Case report.
 */
async function drawTestCasePage(doc: PDFKit.PDFDocument, tc: TestCase, index: number) {
  let y = PAGE_MARGIN;
  
  // 2. Status Badge (Calculate and Draw First)
  const statusColor = getStatusColor(tc.testStatus);
  const statusText = tc.testStatus.toUpperCase();
  const statusWidth = doc.widthOfString(statusText) + 20;
  const badgeX = doc.page.width - PAGE_MARGIN - statusWidth;
  const badgeY = PAGE_MARGIN; // Draw at the same Y as the title
  
  // Draw Badge
  doc.roundedRect(badgeX, badgeY, statusWidth, 25, 5).fill(statusColor);
  doc.fontSize(12).font(FONT_BOLD).fillColor('#FFFFFF').text(statusText, badgeX + 10, badgeY + 7); // Adjusted Y for vertical center

  // 1. Header: "Test Case X: [Name]" (Draw Second, with width constraint)
  const titleWidth = doc.page.width - PAGE_MARGIN * 2 - statusWidth - 10; // 10px gutter
  doc
    .fontSize(18)
    .font(FONT_BOLD)
    .fillColor(COLOR_SECONDARY)
    .text(`Test Case ${index}: ${tc.testcaseName}`, PAGE_MARGIN, y, { // y is PAGE_MARGIN
      width: titleWidth 
    });
  
  // Get Y after title (in case it wraps)
  const titleEndY = doc.y;
  
  // Set Y to be *after* whichever is taller: the title or the badge
  y = Math.max(titleEndY, badgeY + 25) + 15; // +25 for badge height, +15 for margin

  // 3. Details Table (Designed By, Tested By, etc.)
  const details = {
    'Designed By': tc.designedBy || 'N/A',
    'Tested By': tc.testedBy || 'N/A',
    'Severity': tc.severity?.toUpperCase() || 'N/A',
    'Created': formatTimestamp(tc.creationTime),
    'Submitted': formatTimestamp(tc.resultSubmissionTime),
  };

  // Use the static 2-column grid layout
  const col1X = PAGE_MARGIN;
  const col2X = PAGE_MARGIN + 280; // Start of second column
  const keyWidth = 100;
  const valueWidth = 160;

  doc.font(FONT_REGULAR).fontSize(10);

  // --- Row 1 ---
  doc.font(FONT_BOLD).fillColor(COLOR_MUTED).text('Designed By', col1X, y);
  doc.font(FONT_REGULAR).fillColor(COLOR_TEXT).text(details['Designed By'], col1X + keyWidth, y, { width: valueWidth });
  doc.font(FONT_BOLD).fillColor(COLOR_MUTED).text('Severity', col2X, y);
  doc.font(FONT_REGULAR).fillColor(COLOR_TEXT).text(details['Severity'], col2X + keyWidth, y, { width: valueWidth });
  y = doc.y + 5; 

  // --- Row 2 ---
  doc.font(FONT_BOLD).fillColor(COLOR_MUTED).text('Tested By', col1X, y);
  doc.font(FONT_REGULAR).fillColor(COLOR_TEXT).text(details['Tested By'], col1X + keyWidth, y, { width: valueWidth });
  doc.font(FONT_BOLD).fillColor(COLOR_MUTED).text('Created', col2X, y);
  doc.font(FONT_REGULAR).fillColor(COLOR_TEXT).text(details['Created'], col2X + keyWidth, y, { width: valueWidth });
  y = doc.y + 5;

  // --- Row 3 ---
  doc.font(FONT_BOLD).fillColor(COLOR_MUTED).text('Submitted', col1X, y);
  doc.font(FONT_REGULAR).fillColor(COLOR_TEXT).text(details['Submitted'], col1X + keyWidth, y, { width: valueWidth });
  y = doc.y + 15; 
  
  // 4. Description Blocks
  const drawTextBox = (title: string, text: string | undefined, boxY: number) => {
    doc.font(FONT_BOLD).fontSize(11).fillColor(COLOR_TEXT).text(title, PAGE_MARGIN, boxY);
    
    const startY = doc.y + 2; 
    const content = text || 'N/A';
    const textWidth = doc.page.width - PAGE_MARGIN * 2 - 10; 

    const textHeight = doc.heightOfString(content, { width: textWidth });
    const boxHeight = textHeight + 10; 

    doc.rect(PAGE_MARGIN, startY, doc.page.width - PAGE_MARGIN * 2, boxHeight).stroke(COLOR_BORDER);
    doc.font(FONT_REGULAR).fontSize(10).fillColor(COLOR_TEXT).text(content, PAGE_MARGIN + 5, startY + 5, {
      width: textWidth
    });

    return startY + boxHeight + 15; 
  };
  
  y = drawTextBox('Test Description:', tc.testDescription, y);
  y = drawTextBox('Expected Results:', tc.expectedResults, y);
  y = drawTextBox('Actual Result:', tc.actualResult, y);
  
  if (tc.testStatus === 'fail') {
    let debugContent = tc.debuggingReport;
    if (typeof debugContent === 'object' && debugContent !== null) {
      debugContent = JSON.stringify(debugContent, null, 2); 
    }
    y = drawDebuggingReportTable(doc, debugContent, y);
  }

  // 5. Screenshot
  y += 10;
  doc.font(FONT_BOLD).fontSize(11).fillColor(COLOR_TEXT).text('Test Execution Screenshot:', PAGE_MARGIN, y);
  y = doc.y + 5;

  if (tc.metadataImageUrl) {
    const image = await fetchImage(tc.metadataImageUrl);
    if (image) {
      const imgWidth = doc.page.width - PAGE_MARGIN * 2;
      const imgHeight = 250;
      if (y + imgHeight > doc.page.height - PAGE_MARGIN) {
        doc.addPage();
        y = PAGE_MARGIN;
      }
      doc.image(image, PAGE_MARGIN, y, {
        fit: [imgWidth, imgHeight],
        align: 'center',
      });
      y += imgHeight + 10;
    } else {
      doc.font(FONT_REGULAR).fontSize(10).fillColor(COLOR_MUTED).text('Screenshot could not be loaded.', PAGE_MARGIN, y);
    }
  } else {
    doc.font(FONT_REGULAR).fontSize(10).fillColor(COLOR_MUTED).text('No screenshot provided.', PAGE_MARGIN, y);
  }
  
  return y;
}

/**
 * Draws the footer on all pages.
 */
function drawFooter(doc: PDFKit.PDFDocument, assignmentId: string) {
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    const text = `Page ${i - pages.start + 1} of ${pages.count} | Report Generated: ${new Date().toLocaleDateString()}`;
    const bottom = doc.page.height - 30;
    doc
      .fontSize(8)
      .font(FONT_REGULAR)
      .fillColor(COLOR_MUTED)
      .text(text, PAGE_MARGIN, bottom, { align: 'center' });
  }
}

// --- Core Generation Function ---
async function generateTestReport(assignmentId: string) {
  // 1. Get ALL data. This function is assumed to be updated.
  const data = (await getFullReportData(assignmentId)) as ReportData | null;
  if (!data) throw new Error('Incomplete or missing report data');

  if (!data.assignments) data.assignments = [];
  if (!data.linkReports) data.linkReports = [];
  if (!data.originalTeam) data.originalTeam = { teamName: 'N/A', members: [] };

  const doc = new PDFDocument({
    margin: PAGE_MARGIN,
    size: 'A4',
    bufferPages: true, // Needed for page numbers
  });
  const buffers: Buffer[] = [];

  const streamPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
  });

  // 2. Register Font (Times New Roman)
  try {
    const fontPath = (name: string) => path.join(process.cwd(), 'src/assets/fonts', name);

    // --- Define the filenames you added to src/assets/fonts ---
    const regularFile = fontPath('times.ttf');
    const boldFile = fontPath('timesbd.ttf');
    const italicFile = fontPath('timesi.ttf');
    const boldItalicFile = fontPath('timesbi.ttf');

    let fontsLoaded = 0;

    // *** FIX 3: Uncommented font registration block ***
    // Register Regular
    if (fs.existsSync(regularFile)) {
      doc.registerFont('CustomTimesRegular', regularFile); // Register with a new name
      FONT_REGULAR = 'CustomTimesRegular'; // Assign the new name to the 'let' variable
      fontsLoaded++;
    }

    // Register Bold
    if (fs.existsSync(boldFile)) {
      doc.registerFont('CustomTimesBold', boldFile);
      FONT_BOLD = 'CustomTimesBold';
      fontsLoaded++;
    }

    // Register Italic
    if (fs.existsSync(italicFile)) {
      doc.registerFont('CustomTimesItalic', italicFile);
      FONT_ITALIC = 'CustomTimesItalic';
      fontsLoaded++;
    }

    // Register Bold-Italic
    if (fs.existsSync(boldItalicFile)) {
      doc.registerFont('CustomTimesBoldItalic', boldItalicFile);
      FONT_BOLD_ITALIC = 'CustomTimesBoldItalic';
      fontsLoaded++;
    }

    if (fontsLoaded === 4) {
      console.log('Successfully loaded all Times New Roman fonts.');
    } else {
      console.warn(`Loaded only ${fontsLoaded}/4 fonts. Missing fonts will use default fallbacks.`);
    }

  } catch (err) {
    console.error('Critical font loading error. Using default fonts:', err);
    // Fallbacks are already set, so we are safe.
  }

  // --- Page 1: Title & Project Details ---
  let y = PAGE_MARGIN;
  doc
    .fontSize(24)
    .font(FONT_BOLD)
    .fillColor(COLOR_PRIMARY)
    .text('Software Testing Report', PAGE_MARGIN, y, { align: 'center' });
  y = doc.y + 10;
  doc
    .fontSize(12)
    .font(FONT_REGULAR)
    .fillColor(COLOR_MUTED)
    .text(`Project: ${data.project.title}`, PAGE_MARGIN, y, { align: 'center' });
  y = doc.y + 20;

  y = drawProjectDetails(doc, data.project, y);
  
  // --- Page 2: Team Details ---
  doc.addPage();
  y = PAGE_MARGIN;
  y = drawTeamDetails(doc, data.originalTeam, 'Project Submitting Team', y);
  
  // --- Page 3: Link Reports ---
  doc.addPage();
  y = PAGE_MARGIN;
  y = drawLinkReports(doc, data.linkReports, y);
  
  // --- Page 4: Test Case Summary & Assignments ---
  doc.addPage();
  y = PAGE_MARGIN;

  const allTestCases = data.assignments.flatMap(a => a.testCases);
  const passedTests = allTestCases.filter((tc) => tc.testStatus === 'pass').length;
  const failedTests = allTestCases.filter((tc) => tc.testStatus === 'fail').length;
  const pendingTests = allTestCases.filter((tc) => tc.testStatus === 'pending').length;

  y = drawSummaryCards(doc, passedTests, failedTests, pendingTests, y);
  y += 20; // Add some space
  
  // --- Subsequent Pages: Individual Assignments & Test Cases ---
  for (const [assignmentIndex, assignment] of data.assignments.entries()) {
    
    // Only add a new page for assignments after the first one
    if (assignmentIndex > 0) {
      doc.addPage();
      y = PAGE_MARGIN; // Reset y for this new page
    }
    // For the first assignment (assignmentIndex === 0), continue on the same page with current y
    
    // Draw the assignment header
    y = drawSectionHeader(doc, 'Testing Assignment Details', y);
    y = drawTeamDetails(doc, assignment.testingTeam, 'Testing Team:', y);
    doc.moveDown(2);
    y = doc.y;
    doc.fontSize(12).font(FONT_REGULAR).fillColor(COLOR_MUTED).text('The following pages detail each test case executed by this team.', PAGE_MARGIN, y);
    y = doc.y;

    // Loop through test cases
    if (assignment.testCases.length === 0) {
       doc.font(FONT_REGULAR).fontSize(10).fillColor(COLOR_MUTED).text('No test cases were submitted for this assignment.', PAGE_MARGIN + 10, y + 10);
    }

    for (const [i, tc] of assignment.testCases.entries()) {
      // Add a new page *for each test case*
      doc.addPage();
      // drawTestCasePage now draws on the current page
      await drawTestCasePage(doc, tc, i + 1);
    }
  }

  // --- Final Step: Add Footers ---
  doc.flushPages(); // Flush buffered pages before drawing footers
  drawFooter(doc, assignmentId);

  // End the document
  doc.end();
  const pdfBuffer = await streamPromise;
  return { pdfBuffer, projectTitle: data.project.title || 'report' };
}

// --- API Route Handler ---
// *** FIX 1: Changed signature to properly destructure 'params' ***
// --- API Route Handler ---
export const GET = async (
  req: NextRequest,
  { params }: { params: { assignmentId: string } }
) => {
  const { assignmentId }  = await params;

  if (!assignmentId) {
    return NextResponse.json({ error: 'Assignment ID missing' }, { status: 400 });
  }

  try {
    const { pdfBuffer, projectTitle } = await generateTestReport(assignmentId);
    const safeTitle = projectTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    const uint8 = new Uint8Array(pdfBuffer);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="testing_report_${safeTitle}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('Report generation failed:', err);
    return NextResponse.json(
      { error: 'Failed to generate report', details: err?.message },
      { status: 500 }
    );
  }
};