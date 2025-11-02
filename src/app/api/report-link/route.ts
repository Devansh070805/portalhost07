import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

// --- SET YOUR "FROM" EMAIL HERE ---
const FROM_EMAIL = "noreply@ucs503testing.space"; 

// Helper function to format the list of affected teams
function formatAffectedTeams(teams: { name: string, subgroup: string }[] = []): string {
    if (teams.length === 0) return "<li>No other teams listed.</li>";
    return teams.map(team => `<li><b>${team.name}</b> (Subgroup: ${team.subgroup})</li>`).join('');
}

export async function POST(request: Request) {
    console.log("\n--- [EMAIL API]: /api/report-link HIT! ---"); 
    
    try {
        const body = await request.json();
        console.log("[EMAIL API]: Received request body:", JSON.stringify(body, null, 2)); 

        const { to, email, ...data } = body;

        if (!to || !email) {
            console.error("[EMAIL API]: ❌ FAILED - Missing 'to' or 'email' field"); 
            return NextResponse.json({ error: "Missing 'to' or 'email' field" }, { status: 400 });
        }

        let subject = "";
        let htmlBody = "";

        // --- Branch 1: Email for the Faculty ---
        if (to === 'faculty') {
            console.log(`[EMAIL API]: 1. Building email for FACULTY at ${email}`); 
            const { 
                projectName, 
                description, 
                uploadingTeamName, 
                uploadingTeamSubgroup,
                reportingTeamName,
                reportingTeamSubgroup,
                affectedTestingTeams
            } = data;
            
            subject = `[URGENT] Project Report Filed: ${projectName}`;
            htmlBody = `
                <div>
                    <h3>A new project link report has been filed for your review.</h3>
                    <p>Please log in to the faculty dashboard to review and resolve this issue.</p>
                    <hr>
                    <h4>Report Details:</h4>
                    <ul>
                        <li><strong>Project:</strong> ${projectName}</li>
                        <li><strong>Uploading Team:</strong> ${uploadingTeamName} (Subgroup: ${uploadingTeamSubgroup})</li>
                        <li><strong>Reporting Team:</strong> ${reportingTeamName} (Subgroup: ${reportingTeamSubgroup})</li>
                    </ul>
                    <h4>Issue Description:</h4>
                    <blockquote style="padding: 10px; border-left: 4px solid #ccc; background: #f9f9f9;">
                        ${description || "No description provided."}
                    </blockquote>
                    <h4>All Affected Testing Teams (Now Locked):</h4>
                    <ul>
                        ${formatAffectedTeams(affectedTestingTeams)}
                    </ul>
                </div>
            `;
        } 
        
        // --- Branch 2: Email for the Uploader Team Leader ---
        else if (to === 'uploader') {
            console.log(`[EMAIL API]: 1. Building email for UPLOADER at ${email}`); 
            const { projectName, description } = data;
            
            subject = `[ACTION REQUIRED] An Issue Was Reported With Your Project: ${projectName}`;
            htmlBody = `
                <div>
                    <h3>An issue has been reported for your project: <strong>${projectName}</strong>.</h3>
                    <p>A testing team has reported that your project's live link is not working. Your project's testing assignments are now <strong>locked</strong> until this issue is resolved.</p>
                    
                    <h4>Issue Reported by Tester:</h4>
                    <blockquote style="padding: 10px; border-left: 4px solid #ccc; background: #f9f9f9;">
                        ${description || "No description provided."}
                    </blockquote>
                    
                    <h4>Next Steps:</h4>
                    <p>Please log in to your student dashboard, go to the "My Project Issues" inbox, and submit an updated, working link for faculty approval.</p>
                </div>
            `;
        } 
        
        // --- Error Branch ---
        else {
            console.error(`[EMAIL API]: ❌ FAILED - Invalid 'to' field: ${to}`); 
            return NextResponse.json({ error: "Invalid 'to' field" }, { status: 400 });
        }

        // Send the email
        console.log(`[EMAIL API]: 2. Attempting to send email via Resend to ${to} (${email})...`); 
        await resend.emails.send({
            from: `Project Portal <${FROM_EMAIL}>`,
            to: [email], // The dynamic email address
            subject: subject,
            html: htmlBody
        });

        console.log(`[EMAIL API]: ✅ SUCCESS - Email sent to ${to} (${email})`); 
        return NextResponse.json({ success: true, message: `Email sent to ${to}.` });

    } catch (error: any) {
        console.error("--- [EMAIL API]: ❌ CRITICAL ERROR SENDING EMAIL ---", error); 
        return NextResponse.json({ error: error.message || "Failed to send email" }, { status: 500 });
    }
}