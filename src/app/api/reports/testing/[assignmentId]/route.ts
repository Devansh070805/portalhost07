import { NextRequest, NextResponse } from 'next/server';
import { getFullReportData } from '../../../../../../services/reports';
import PDFDocument from 'pdfkit';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

// --- Types ---
interface FirebaseTimestamp {
  toDate: () => Date;
}
interface Student {
  id: string;
  name: string;
  email: string;
  isLeader: boolean;
}
interface Team {
  teamName: string;
  members: Student[];
}
interface Project {
  id: string;
  title: string;
  description?: string;
  deployedLink?: string;
  githubLink?: string;
  techStack?: string;
  srsLink?: string;
}
interface TestCase {
  id: string;
  testcaseName: string;
  testDescription: string;
  designedBy: string;
  expectedResults: string;
  testStatus: 'pending' | 'pass' | 'fail';
  metadataImageUrl: string | null;
  testedBy: string | null;
  creationTime: FirebaseTimestamp;
  resultSubmissionTime?: FirebaseTimestamp;
}
interface ReportData {
  assignmentId: string;
  project: Project;
  originalTeam: Team;
  testingTeam: Team;
  testCases: TestCase[];
  testingStatus: string;
}

// --- Helpers ---
async function fetchImage(url: string) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
  } catch (err) {
    console.error(`Failed to fetch image: ${url}`, err);
    return null;
  }
}

function formatTimestamp(ts?: FirebaseTimestamp) {
  return ts && typeof ts.toDate === 'function'
    ? ts.toDate().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'N/A';
}

// --- Core ---
async function generateTestReport(assignmentId: string) {
  const data = (await getFullReportData(assignmentId)) as ReportData | null;
  if (!data) throw new Error('Incomplete report data');

  const doc = new PDFDocument({
    margin: 40,
    size: 'A4',
    bufferPages: true,
  });
  const buffers: Buffer[] = [];

  const streamPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
  });

  // Try to use custom Roboto font from src/assets/fonts, fallback to default
  try {
    // ✅ --- THIS IS THE FIXED LINE ---
    // The path now points to 'src/assets/fonts' instead of 'public/assets/fonts'
    const fontPath = path.join(
      process.cwd(),
      'src/assets/fonts/Roboto-VariableFont_wdth,wght.ttf'
    );

    if (fs.existsSync(fontPath)) {
      doc.registerFont('Roboto', fontPath);
      doc.font('Roboto');
    } else {
      console.log('Custom font not found at path, using default Helvetica.');
    }
  } catch (err) {
    console.log('Using default font (custom font loading error):', err);
  }

  // Professional header with styling
  doc.fontSize(24).fillColor('#b91c1c').text('Project Testing Report', { align: 'center' });
  doc.moveDown(1);

  doc.fontSize(12).fillColor('#666666').text(`Report Generated on ${new Date().toLocaleDateString()}`, { align: 'center' });
  doc.moveDown(2);

  // 1. Project Details Section
  doc.fontSize(18).fillColor('#b91c1c').text('1. Project Details');
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#000000');
  doc.text(`Project Title: ${data.project.title}`);
  doc.text(`Description: ${data.project.description || 'N/A'}`);
  doc.text(`GitHub: ${data.project.githubLink || 'N/A'}`);
  doc.text(`Live URL: ${data.project.deployedLink || 'N/A'}`);
  if (data.project.techStack) {
    doc.text(`Tech Stack: ${data.project.techStack}`);
  }
  if (data.project.srsLink) {
    doc.text(`SRS: ${data.project.srsLink}`);
  }
  doc.moveDown(1.5);

  // 2. Project Submitting Team
  doc.fontSize(18).fillColor('#b91c1c').text('2. Project Submitting Team');
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#000000');
  doc.text(`Team Name: ${data.originalTeam.teamName || 'Team Alpha'}`);
  doc.text('Team Members:');
  data.originalTeam.members.forEach((member) => {
    const role = member.isLeader ? 'Team Leader' : 'Member';
    doc.text(`  ${role} - ${member.name} (${member.email})`, { indent: 20 });
  });
  doc.moveDown(1.5);

  // 3. Testing Team
  doc.fontSize(18).fillColor('#b91c1c').text('3. Testing Team');
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#000000');
  doc.text(`Team Name: ${data.testingTeam.teamName || 'Testing Squad'}`);
  doc.text('Team Members:');
  data.testingTeam.members.forEach((member) => {
    const role = member.isLeader ? 'Team Leader' : 'Member';
    doc.text(`  ${role} - ${member.name} (${member.email})`, { indent: 20 });
  });
  doc.moveDown(1.5);

  // 4. Test Cases Summary - Start on new page
  doc.addPage();

  const passedTests = data.testCases.filter((tc) => tc.testStatus === 'pass').length;
  const failedTests = data.testCases.filter((tc) => tc.testStatus === 'fail').length;
  const pendingTests = data.testCases.filter((tc) => tc.testStatus === 'pending').length;

  doc.fontSize(18).fillColor('#b91c1c').text('4. Test Cases & Results');
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#000000');
  doc.text(
    `Summary - Total Test Cases: ${data.testCases.length} | Passed - ${passedTests} | Failed - ${failedTests} | Pending - ${pendingTests}`
  );
  doc.moveDown(1.5);

  // 5. Individual Test Cases
  for (const [i, tc] of data.testCases.entries()) {
    // Add new page for each test case except the first one
    if (i > 0) {
      doc.addPage();
    }

    // Determine status color and text
    let statusColor = '#000000';
    let statusText = 'UNKNOWN';

    if (tc.testStatus === 'pass') {
      statusColor = '#155724';
      statusText = 'PASSED';
    } else if (tc.testStatus === 'fail') {
      statusColor = '#721c24';
      statusText = 'FAILED';
    } else if (tc.testStatus === 'pending') {
      statusColor = '#856404';
      statusText = 'PENDING';
    }

    // Test Case Header
    doc.fontSize(18).fillColor('#b91c1c').text(`Test Case ${i + 1}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(16).fillColor(statusColor).text(`${tc.testcaseName} [${statusText}]`, { align: 'center' });
    doc.moveDown(1);

    // Test Case Details in a more structured format
    doc.fontSize(12).fillColor('#000000');
    doc.text(`Designer: ${tc.designedBy}`);
    doc.text(`Tester: ${tc.testedBy || 'Not assigned yet'}`);
    doc.moveDown(0.5);

    doc.fontSize(11).fillColor('#333333');
    doc.text('Test Description:', { underline: true });
    doc.fontSize(10).fillColor('#000000');
    doc.text(tc.testDescription, { indent: 20 });
    doc.moveDown(0.5);

    doc.fontSize(11).fillColor('#333333');
    doc.text('Expected Results:', { underline: true });
    doc.fontSize(10).fillColor('#000000');
    doc.text(tc.expectedResults, { indent: 20 });
    doc.moveDown(0.5);

    doc.fontSize(10).fillColor('#666666');
    doc.text(`Created: ${formatTimestamp(tc.creationTime)}`);
    if (tc.resultSubmissionTime) {
      doc.text(`Submitted: ${formatTimestamp(tc.resultSubmissionTime)}`);
    }
    doc.moveDown(1);

    // Screenshot/Image handling
    if (tc.metadataImageUrl) {
      doc.fontSize(11).fillColor('#333333');
      doc.text('Test Execution Screenshot:', { underline: true });
      doc.moveDown(0.5);

      try {
        const image = await fetchImage(tc.metadataImageUrl);
        if (image) {
          // Calculate center position for image
          const imageWidth = 450;
          const centerX = (doc.page.width - imageWidth) / 2;
          doc.image(image, centerX, doc.y, {
            fit: [450, 250],
          });
          doc.y += 260; // Move cursor below the image
        } else {
          doc.fontSize(10).fillColor('#666666');
          doc.text('Screenshot could not be loaded', { align: 'center' });
          doc.moveDown(1);
        }
      } catch (error) {
        doc.fontSize(10).fillColor('#666666');
        doc.text('Error loading screenshot', { align: 'center' });
        doc.moveDown(1);
      }
    } else {
      doc.fontSize(10).fillColor('#666666');
      doc.text('No screenshot provided', { align: 'center' });
      doc.moveDown(1);
    }

    // Add debugging report for failed tests (always below image)
    if (tc.testStatus === 'fail') {
      doc.moveDown(1);
      doc.fontSize(11).fillColor('#721c24');
      doc.text('Debugging Report:', { underline: true });
      doc.fontSize(10).fillColor('#721c24');
      doc.text('• Issue: Test case failed - review screenshot and expected vs actual results', { indent: 20 });
      doc.text('• Severity: Requires investigation', { indent: 20 });
      doc.text('• Next Steps: Contact development team for resolution', { indent: 20 });
      doc.moveDown(1);
    }
  }

  // Footer on last page
  if (doc.y > doc.page.height - 100) {
    doc.addPage();
  }

  doc.fontSize(10).fillColor('#666666');
  doc.text('Testing Report generated by Project Testing Management System', { align: 'center' });
  doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.text(`Assignment ID: ${assignmentId}`, { align: 'center' });

  doc.end();
  const pdfBuffer = await streamPromise;
  return { pdfBuffer, projectTitle: data.project.title || 'report' };
}

// --- ✅ Fixed Handler for Vercel ---
export const GET = async (req: NextRequest, context: any) => {
  const assignmentId = context?.params?.assignmentId;

  if (!assignmentId) {
    return NextResponse.json({ error: 'Assignment ID missing' }, { status: 400 });
  }

  try {
    const { pdfBuffer, projectTitle } = await generateTestReport(assignmentId);
    const safeTitle = projectTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // ✅ FIXED: Convert Buffer → Uint8Array for NextResponse
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
    return NextResponse.json({ error: 'Failed to generate report', details: err?.message }, { status: 500 });
  }
};