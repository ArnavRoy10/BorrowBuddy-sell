// backend/utils/emailService.js
// ─────────────────────────────────────────────────────────────────
// Centralized email sending via Nodemailer.
// Uses Gmail SMTP by default — works with any SMTP provider by
// changing the transporter config below.

const nodemailer = require('nodemailer');

// ── Transporter setup ──────────────────────────────────────────────
// Requires these in backend/.env:
//   EMAIL_USER=youraddress@gmail.com
//   EMAIL_PASS=your_16_char_app_password   (NOT your regular Gmail password)
//   EMAIL_FROM_NAME=BorrowBuddy
//
// To get an App Password: Google Account → Security → 2-Step Verification
// (must be ON) → App Passwords → generate one for "Mail"

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️  EMAIL_USER / EMAIL_PASS not set in .env — emails will not be sent.');
        return null;
    }

    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    return transporter;
}

// ── Base email template (shared styling) ───────────────────────────
function wrapTemplate({ title, preheader, bodyHtml, accentColor = '#2563eb' }) {
    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif">
        <span style="display:none;font-size:1px;color:#f3f4f6">${preheader}</span>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
            <tr><td align="center">
                <table role="presentation" width="100%" style="max-width:520px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.06)">
                    <tr>
                        <td style="background:linear-gradient(135deg,${accentColor},#7c3aed);padding:28px 32px;color:white">
                            <div style="font-size:20px;font-weight:700">🔄 BorrowBuddy</div>
                            <div style="font-size:13px;opacity:.85;margin-top:2px">${title}</div>
                        </td>
                    </tr>
                    <tr><td style="padding:28px 32px">${bodyHtml}</td></tr>
                    <tr>
                        <td style="padding:20px 32px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af;text-align:center">
                            This is an automated message from BorrowBuddy.<br>
                            If you didn't expect this email, you can safely ignore it.
                        </td>
                    </tr>
                </table>
            </td></tr>
        </table>
    </body>
    </html>`;
}

// ── Core send function ──────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
    const t = getTransporter();
    if (!t) return { success: false, message: 'Email service not configured' };

    try {
        const info = await t.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME || 'BorrowBuddy'}" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        });
        console.log(`📧 Email sent to ${to}: ${subject} (${info.messageId})`);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error(`❌ Email send failed to ${to}:`, err.message);
        return { success: false, message: err.message };
    }
}

// ═══════════════════════════════════════════════════════════════════
//  TEMPLATED EMAIL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

// ── Request Approved (sent to borrower) ─────────────────────────────
async function sendRequestApprovedEmail({ to, borrowerName, itemName, ownerName, fromDate, toDate, itemUrl }) {
    const html = wrapTemplate({
        title: 'Request Approved',
        preheader: `Your request to borrow "${itemName}" was approved!`,
        accentColor: '#10b981',
        bodyHtml: `
            <div style="text-align:center;margin-bottom:20px">
                <div style="font-size:40px;margin-bottom:8px">🎉</div>
                <h2 style="margin:0;color:#1f2937;font-size:20px">Request Approved!</h2>
            </div>
            <p style="color:#374151;font-size:14px;line-height:1.6">Hi ${borrowerName},</p>
            <p style="color:#374151;font-size:14px;line-height:1.6">
                Great news — <strong>${ownerName}</strong> has approved your request to borrow:
            </p>
            <div style="background:#f0fdf4;border:1px solid #6ee7b7;border-radius:10px;padding:16px;margin:16px 0">
                <div style="font-weight:700;color:#065f46;font-size:16px;margin-bottom:8px">${itemName}</div>
                <div style="font-size:13px;color:#047857">
                    <i>📅</i> ${fmtDate(fromDate)} → ${fmtDate(toDate)}
                </div>
            </div>
            <p style="color:#374151;font-size:14px;line-height:1.6">
                You can now view the owner's contact details and pickup instructions.
            </p>
            <div style="text-align:center;margin-top:24px">
                <a href="${itemUrl}" style="display:inline-block;background:#10b981;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
                    View Contact Details →
                </a>
            </div>
        `
    });

    return sendEmail({ to, subject: `✅ Your request for "${itemName}" was approved!`, html });
}

// ── Request Declined (sent to borrower) ──────────────────────────────
async function sendRequestDeclinedEmail({ to, borrowerName, itemName, ownerName }) {
    const html = wrapTemplate({
        title: 'Request Declined',
        preheader: `Your request to borrow "${itemName}" was declined.`,
        accentColor: '#ef4444',
        bodyHtml: `
            <div style="text-align:center;margin-bottom:20px">
                <div style="font-size:40px;margin-bottom:8px">😔</div>
                <h2 style="margin:0;color:#1f2937;font-size:20px">Request Declined</h2>
            </div>
            <p style="color:#374151;font-size:14px;line-height:1.6">Hi ${borrowerName},</p>
            <p style="color:#374151;font-size:14px;line-height:1.6">
                Unfortunately, <strong>${ownerName}</strong> has declined your request to borrow:
            </p>
            <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:16px;margin:16px 0">
                <div style="font-weight:700;color:#991b1b;font-size:16px">${itemName}</div>
            </div>
            <p style="color:#374151;font-size:14px;line-height:1.6">
                Don't worry — there are plenty of other great items to explore on BorrowBuddy.
            </p>
            <div style="text-align:center;margin-top:24px">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5500'}/browse.html" style="display:inline-block;background:#2563eb;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
                    Browse More Items →
                </a>
            </div>
        `
    });

    return sendEmail({ to, subject: `Update on your request for "${itemName}"`, html });
}

// ── New Request Received (sent to owner) ─────────────────────────────
async function sendNewRequestEmail({ to, ownerName, borrowerName, itemName, fromDate, toDate, requestsUrl }) {
    const html = wrapTemplate({
        title: 'New Borrow Request',
        preheader: `${borrowerName} wants to borrow your "${itemName}"`,
        accentColor: '#2563eb',
        bodyHtml: `
            <div style="text-align:center;margin-bottom:20px">
                <div style="font-size:40px;margin-bottom:8px">📬</div>
                <h2 style="margin:0;color:#1f2937;font-size:20px">New Borrow Request</h2>
            </div>
            <p style="color:#374151;font-size:14px;line-height:1.6">Hi ${ownerName},</p>
            <p style="color:#374151;font-size:14px;line-height:1.6">
                <strong>${borrowerName}</strong> would like to borrow your item:
            </p>
            <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:10px;padding:16px;margin:16px 0">
                <div style="font-weight:700;color:#1e40af;font-size:16px;margin-bottom:8px">${itemName}</div>
                <div style="font-size:13px;color:#2563eb">
                    <i>📅</i> ${fmtDate(fromDate)} → ${fmtDate(toDate)}
                </div>
            </div>
            <p style="color:#374151;font-size:14px;line-height:1.6">
                Log in to approve or decline this request.
            </p>
            <div style="text-align:center;margin-top:24px">
                <a href="${requestsUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
                    Review Request →
                </a>
            </div>
        `
    });

    return sendEmail({ to, subject: `📬 ${borrowerName} wants to borrow "${itemName}"`, html });
}

// ── Return Confirmed / Deposit Refunded (sent to borrower) ───────────
async function sendDepositRefundedEmail({ to, borrowerName, itemName, depositAmount }) {
    const html = wrapTemplate({
        title: 'Deposit Refunded',
        preheader: `Your ₹${depositAmount} deposit for "${itemName}" has been refunded.`,
        accentColor: '#10b981',
        bodyHtml: `
            <div style="text-align:center;margin-bottom:20px">
                <div style="font-size:40px;margin-bottom:8px">💰</div>
                <h2 style="margin:0;color:#1f2937;font-size:20px">Deposit Refunded!</h2>
            </div>
            <p style="color:#374151;font-size:14px;line-height:1.6">Hi ${borrowerName},</p>
            <p style="color:#374151;font-size:14px;line-height:1.6">
                Your return of <strong>${itemName}</strong> has been confirmed, and your security deposit has been released.
            </p>
            <div style="background:#f0fdf4;border:1px solid #6ee7b7;border-radius:10px;padding:16px;margin:16px 0;text-align:center">
                <div style="font-size:13px;color:#047857">Deposit Refunded</div>
                <div style="font-weight:800;color:#065f46;font-size:24px">₹${depositAmount}</div>
            </div>
        `
    });

    return sendEmail({ to, subject: `💰 Your ₹${depositAmount} deposit has been refunded`, html });
}

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

module.exports = {
    sendEmail,
    sendRequestApprovedEmail,
    sendRequestDeclinedEmail,
    sendNewRequestEmail,
    sendDepositRefundedEmail
};