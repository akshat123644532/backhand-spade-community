import { SendMailClient } from "zeptomail";

const url = process.env.ZEPTOMAIL_URL;
const token = process.env.ZEPTOMAIL_TOKEN;
const FROM_ADDRESS = process.env.ZEPTOMAIL_FROM_ADDRESS;
const FROM_NAME = process.env.ZEPTOMAIL_FROM_NAME || "Spade Community";

const client = new SendMailClient({ url, token });

/**
 * Send a transactional email via ZeptoMail.
 * @param {Object} opts
 * @param {string} opts.toEmail   - Recipient email
 * @param {string} opts.toName    - Recipient name
 * @param {string} opts.subject   - Email subject
 * @param {string} opts.htmlBody  - HTML body
 * @returns {Promise<boolean>}
 */
async function sendTransactionalEmail({ toEmail, toName, subject, htmlBody }) {
  try {
    // console.log('DEBUG toEmail:', toEmail);
    // console.log('DEBUG toName:', toName);
    // console.log('DEBUG subject:', subject);
    // console.log('DEBUG htmlBody:', htmlBody);
    const resp = await client.sendMail({
      from: {
        address: FROM_ADDRESS,
        name: FROM_NAME,
      },
      to: [
        {
          email_address: {
            address: toEmail,
            name: toName || toEmail,
          },
        },
      ],
      subject,
      htmlbody: htmlBody,
    });

    // console.log(`✅ Email sent to ${toEmail}`, resp);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${toEmail}:`, error);
    return false; // don't crash the main flow
  }
}

export { sendTransactionalEmail };