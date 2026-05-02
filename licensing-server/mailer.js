const { Resend } = require('resend');
require('dotenv').config();

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Sends a license key email to the customer using Resend.
 * @param {string} email - Recipient email
 * @param {string} licenseKey - The generated license key
 */
async function sendLicenseEmail(email, licenseKey) {
    if (!resend) {
        console.log(`[MAIL MOCK] To: ${email} | Key: ${licenseKey}`);
        return;
    }

    try {
        const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || 'CineFlow <onboarding@resend.dev>',
            to: [email],
            subject: 'Your CineFlow Suite License Key',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #7c3aed;">CineFlow Suite</h2>
                    <p>Thank you for your purchase! Your workstation license is now ready.</p>
                    <div style="background: #f4f4f4; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                        <code style="font-size: 20px; font-weight: bold; letter-spacing: 2px; color: #333;">${licenseKey}</code>
                    </div>
                    <p><strong>Installation:</strong></p>
                    <ol>
                        <li>Download the installer from <a href="https://licensing.alan-design.com/download">here</a>.</li>
                        <li>Open CineFlow and enter your email and this license key in the Activation Screen.</li>
                    </ol>
                    <p style="font-size: 12px; color: #666; margin-top: 40px;">
                        If you need help, visit our <a href="https://alan-design.com/support">Support Page</a>.
                    </p>
                </div>
            `,
        });

        if (error) {
            console.error('[RESEND ERROR]', error);
            return;
        }

        console.log(`[MAIL] Email sent to ${email} (ID: ${data.id})`);
    } catch (err) {
        console.error('[MAIL EXCEPTION]', err);
    }
}

module.exports = { sendLicenseEmail };
