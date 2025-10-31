import { NextRequest, NextResponse } from 'next/server';
import { getFullReportData } from '../../../../../../services/reports'; // Adjust path
import PDFDocument from 'pdfkit';
import axios from 'axios';
import path from 'path'; // <-- Requires 'path'
import fs from 'fs';     // <-- Requires 'fs'

// --- START: TYPE DEFINITIONS ---
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
// --- END: TYPE DEFINITIONS ---

// --- Helper: Fetch image from S3 ---
async function fetchImage(url: string) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
  } catch (error) {
    console.error(`Failed to fetch image: ${url}`, error);
    return null;
  }
}

// --- Helper: Format timestamp ---
function formatTimestamp(ts: FirebaseTimestamp | undefined) {
  if (ts && typeof ts.toDate === 'function') {
    return ts.toDate().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return 'N/A';
}

// --- Main PDF Generator ---
async function generateTestReport(
  assignmentId: string
): Promise<{ pdfBuffer: Buffer; projectTitle: string }> {
  const data = (await getFullReportData(assignmentId)) as ReportData | null;

  if (!data || !data.project || !data.originalTeam || !data.testingTeam || !data.testCases) {
    console.error('Could not fetch complete report data for assignment:', assignmentId);
    console.log('Received data:', JSON.stringify(data, null, 2));
    throw new Error('Could not fetch complete report data. Required fields are missing.');
  }

  const projectTitle = data.project.title || 'report';

  const doc = new PDFDocument({
    margin: 50,
    size: 'A4',
    autoFirstPage: false,
  });

  const buffers: Buffer[] = [];

  // --- Register fonts ---
  try {
    const fontDir = path.join(process.cwd(), 'fonts');
    doc.registerFont('Helvetica', fs.readFileSync(path.join(fontDir, 'Roboto-Regular.ttf')));
    doc.registerFont('Helvetica-Bold', fs.readFileSync(path.join(fontDir, 'Roboto-Bold.ttf')));
  } catch (error) {
    console.error('CRITICAL: Failed to load local .ttf fonts.', error);
    throw new Error(
      'Failed to initialize PDF fonts. Check /fonts directory for Roboto-Regular.ttf and Roboto-Bold.ttf.'
    );
  }

  // --- Create first page ---
  doc.addPage();
  doc.font('Helvetica');

  const streamPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
  });

  // --- PDF CONTENT ---
  doc.fillColor('#b91c1c').fontSize(24).font('Helvetica-Bold').text('Project Testing Report', {
    align: 'center',
  });
  doc.moveDown(1.5);

  // 1. Project Details
  doc.fillColor('#000').fontSize(16).font('Helvetica-Bold').text('1. Project Details');
  doc.moveDown(0.5);
  doc.fontSize(12).font('Helvetica');
  doc.text(`Project: `, { continued: true }).font('Helvetica-Bold').text(data.project.title);
  doc.font('Helvetica').text(`Description: `, { continued: true }).text(data.project.description || 'N/A');
  doc.text(`GitHub: `, { continued: true })
    .fillColor('blue')
    .text(data.project.githubLink || 'N/A', { link: data.project.githubLink });
  doc.fillColor('#000')
    .text(`Live URL: `, { continued: true })
    .fillColor('blue')
    .text(data.project.deployedLink || 'N/A', { link: data.project.deployedLink });
  doc.fillColor('#000')
    .text(`SRS: `, { continued: true })
    .fillColor('blue')
    .text(data.project.srsLink || 'N/A', { link: data.project.srsLink });
  doc.moveDown(1.5);

  // 2. Submitting Team
  doc.fillColor('#000').fontSize(16).font('Helvetica-Bold').text('2. Submitting Team');
  doc.moveDown(0.5);
  doc.fontSize(12).font('Helvetica-Bold').text(data.originalTeam.teamName);
  doc.font('Helvetica').list(
    data.originalTeam.members?.map(
      (m) => `${m.name} (${m.email}) ${m.isLeader ? '[LEADER]' : ''}`
    ) ?? [],
    { bulletRadius: 2 }
  );
  doc.moveDown(1.5);

  // 3. Testing Team
  doc.fillColor('#000').fontSize(16).font('Helvetica-Bold').text('3. Testing Team');
  doc.moveDown(0.5);
  doc.fontSize(12).font('Helvetica-Bold').text(data.testingTeam.teamName);
  doc.font('Helvetica').list(
    data.testingTeam.members?.map(
      (m) => `${m.name} (${m.email}) ${m.isLeader ? '[LEADER]' : ''}`
    ) ?? [],
    { bulletRadius: 2 }
  );
  doc.moveDown(1.5);

  // 4. Test Cases
  doc.fillColor('#000').fontSize(16).font('Helvetica-Bold').text('4. Test Case Results');
  doc.moveDown(0.5);

  for (const [index, tc] of (data.testCases ?? []).entries()) {
    if (index > 0) doc.addPage().font('Helvetica');

    doc.fontSize(14).font('Helvetica-Bold').text(`Test Case ${index + 1}: ${tc.testcaseName}`);
    doc.moveDown(0.5);

    const statusColor =
      tc.testStatus === 'pass' ? 'green' : tc.testStatus === 'fail' ? 'red' : 'gray';
    doc.fillColor(statusColor).font('Helvetica-Bold').text(tc.testStatus.toUpperCase());
    doc.moveDown(0.5);

    doc.fillColor('#000').fontSize(12).font('Helvetica');
    doc.text(`Designed By: ${tc.designedBy || 'N/A'}`);
    doc.text(`Tested By: ${tc.testedBy || 'N/A'}`);
    doc.text(`Created On: ${formatTimestamp(tc.creationTime)}`);
    doc.text(`Result Submitted On: ${formatTimestamp(tc.resultSubmissionTime)}`);
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('Description:');
    doc.font('Helvetica').text(tc.testDescription || 'N/A');
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('Expected Results:');
    doc.font('Helvetica').text(tc.expectedResults || 'N/A');
    doc.moveDown(1);

    // Screenshot (if any)
    if (tc.metadataImageUrl) {
      doc.font('Helvetica-Bold').text('Test Evidence (Screenshot):');
      const imageBuffer = await fetchImage(tc.metadataImageUrl);
      if (imageBuffer) {
        try {
          doc.image(imageBuffer, {
            fit: [500, 400],
            align: 'center',
            valign: 'center',
          });
        } catch (e) {
          console.error('PDFkit failed to embed image: ', e);
          doc.font('Helvetica').fillColor('red').text('Error embedding image. URL:');
          doc.fillColor('blue').text(tc.metadataImageUrl, { link: tc.metadataImageUrl });
        }
      } else {
        doc.font('Helvetica').fillColor('gray').text('Could not load image from S3.');
        doc.fillColor('blue').text(tc.metadataImageUrl, { link: tc.metadataImageUrl });
      }
    } else {
      doc.font('Helvetica-Bold').text('Test Evidence (Screenshot):');
      doc.font('Helvetica').fillColor('gray').text('No metadata image was uploaded.');
    }

    doc.moveDown(1);
  }

  doc.end();
  const pdfBuffer: Buffer = await streamPromise;

  return { pdfBuffer, projectTitle };
}

// --- ✅ API Route Handler (Fixed for Vercel) ---
export async function GET(
  request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const { assignmentId } = params;

    if (!assignmentId) {
      return NextResponse.json({ error: 'Assignment ID is required' }, { status: 400 });
    }

    const { pdfBuffer, projectTitle } = await generateTestReport(assignmentId);

    const safeTitle = projectTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `testing_report_${safeTitle}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Failed to generate PDF report. Error details:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate PDF report',
        details: error?.message || 'An unknown error occurred',
      },
      { status: 500 }
    );
  }
}
