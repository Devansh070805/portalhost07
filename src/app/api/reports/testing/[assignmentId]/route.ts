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

  const doc = new PDFDocument({ margin: 50, size: 'A4', autoFirstPage: false });
  const buffers: Buffer[] = [];

  try {
    const fontDir = path.join(process.cwd(), 'fonts');
    doc.registerFont('Helvetica', fs.readFileSync(path.join(fontDir, 'Roboto-Regular.ttf')));
    doc.registerFont('Helvetica-Bold', fs.readFileSync(path.join(fontDir, 'Roboto-Bold.ttf')));
  } catch {
    console.warn('Warning: could not load fonts, using defaults.');
  }

  doc.addPage();
  doc.font('Helvetica');

  const streamPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
  });

  doc.fontSize(24).font('Helvetica-Bold').fillColor('#b91c1c')
    .text('Project Testing Report', { align: 'center' });
  doc.moveDown(1.5);

  doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text('1. Project Details');
  doc.moveDown(0.5);
  doc.fontSize(12).font('Helvetica');
  doc.text(`Title: ${data.project.title}`);
  doc.text(`Description: ${data.project.description || 'N/A'}`);
  doc.text(`GitHub: ${data.project.githubLink || 'N/A'}`);
  doc.text(`Live URL: ${data.project.deployedLink || 'N/A'}`);
  doc.text(`SRS: ${data.project.srsLink || 'N/A'}`);
  doc.moveDown(1);

  doc.fontSize(16).font('Helvetica-Bold').text('2. Submitting Team');
  doc.moveDown(0.5);
  doc.font('Helvetica').list(
    data.originalTeam.members.map(
      (m) => `${m.name} (${m.email}) ${m.isLeader ? '[LEADER]' : ''}`
    )
  );
  doc.moveDown(1);

  doc.fontSize(16).font('Helvetica-Bold').text('3. Testing Team');
  doc.moveDown(0.5);
  doc.font('Helvetica').list(
    data.testingTeam.members.map(
      (m) => `${m.name} (${m.email}) ${m.isLeader ? '[LEADER]' : ''}`
    )
  );
  doc.moveDown(1);

  doc.fontSize(16).font('Helvetica-Bold').text('4. Test Cases');
  for (const [i, tc] of data.testCases.entries()) {
    if (i > 0) doc.addPage().font('Helvetica');
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica-Bold').text(`Test Case ${i + 1}: ${tc.testcaseName}`);
    doc.moveDown(0.25);
    doc.fontSize(12).font('Helvetica').text(`Status: ${tc.testStatus}`);
    doc.text(`Designed By: ${tc.designedBy}`);
    doc.text(`Tested By: ${tc.testedBy || 'N/A'}`);
    doc.text(`Created: ${formatTimestamp(tc.creationTime)}`);
    doc.text(`Submitted: ${formatTimestamp(tc.resultSubmissionTime)}`);
    doc.moveDown(0.5);
    if (tc.metadataImageUrl) {
      const image = await fetchImage(tc.metadataImageUrl);
      if (image) doc.image(image, { fit: [450, 300] });
    }
  }

  doc.end();
  const pdfBuffer = await streamPromise;
  return { pdfBuffer, projectTitle: data.project.title || 'report' };
}

// --- ✅ Fixed Handler for Vercel (no type errors) ---
export const GET = async (
  req: NextRequest,
  context: any // 👈 use `any` to satisfy Next.js’ build system on Vercel
) => {
  const assignmentId = context?.params?.assignmentId;

  if (!assignmentId) {
    return NextResponse.json({ error: 'Assignment ID missing' }, { status: 400 });
  }

  try {
    const { pdfBuffer, projectTitle } = await generateTestReport(assignmentId);
    const safeTitle = projectTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    return new NextResponse(pdfBuffer, {
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
