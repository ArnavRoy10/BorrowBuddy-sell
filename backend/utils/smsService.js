// backend/utils/smsService.js
// ─────────────────────────────────────────────────────────────────
// Sends SMS OTPs via Twilio. Falls back to console-logging the OTP
// if Twilio credentials aren't configured — so you can develop and
// test the full flow locally without a Twilio account.
//
// Requires these in backend/.env (get a free trial at twilio.com):
//   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   TWILIO_AUTH_TOKEN=your_auth_token
//   TWILIO_PHONE_NUMBER=+1xxxxxxxxxx     (the Twilio number you were given)

let twilioClient = null;

function getTwilioClient() {
    if (twilioClient) return twilioClient;

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        return null;
    }

    try {
        const twilio = require('twilio');
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        return twilioClient;
    } catch (e) {
        console.warn('⚠️  Twilio package not installed. Run: npm install twilio');
        return null;
    }
}

// ── Generate a 6-digit OTP ──────────────────────────────────────────
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Send OTP via SMS (or console fallback) ──────────────────────────
async function sendOtpSms(phoneNumber, otp) {
    const client = getTwilioClient();

    // ── Dev/fallback mode: no Twilio configured ────────────────────
    if (!client || !process.env.TWILIO_PHONE_NUMBER) {
        console.log('');
        console.log('════════════════════════════════════════');
        console.log('📱 SMS NOT CONFIGURED — DEV MODE OTP');
        console.log(`   Phone: ${phoneNumber}`);
        console.log(`   OTP:   ${otp}`);
        console.log('════════════════════════════════════════');
        console.log('');
        return { success: true, dev: true, message: 'OTP logged to console (SMS not configured)' };
    }

    // ── Real SMS via Twilio ──────────────────────────────────────────
    try {
        const formattedPhone = formatPhoneE164(phoneNumber);
        const message = await client.messages.create({
            body: `Your BorrowBuddy verification code is: ${otp}. This code expires in 10 minutes.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: formattedPhone
        });
        console.log(`📱 OTP SMS sent to ${formattedPhone} (SID: ${message.sid})`);
        return { success: true, sid: message.sid };
    } catch (err) {
        console.error('❌ SMS send failed:', err.message);
        return { success: false, message: err.message };
    }
}

// ── Format phone number to E.164 (Twilio requirement) ────────────────
// Assumes Indian numbers by default (+91) if no country code given.
function formatPhoneE164(phone) {
    let cleaned = String(phone).replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.startsWith('91') && cleaned.length === 12) return `+${cleaned}`;
    if (cleaned.length === 10) return `+91${cleaned}`; // assume Indian 10-digit
    return `+${cleaned}`;
}

module.exports = { generateOtp, sendOtpSms, formatPhoneE164 };