import nodemailer from 'nodemailer';
import { smtpConfig } from './smtp.js';

let transporter;

const isSmtpConfigured = () =>
    Boolean(smtpConfig.host && smtpConfig.user && smtpConfig.pass);

const isRetryableSmtpError = (error) => {
    const code = error?.code;
    return (
        code === 'ETIMEDOUT' ||
        code === 'ECONNECTION' ||
        code === 'ESOCKET' ||
        code === 'ECONNRESET' ||
        code === 'EENVELOPE'
    );
};

const getTransporter = () => {
    if (!isSmtpConfigured()) {
        return null;
    }

    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure,
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.pass,
            },
            tls: {
                rejectUnauthorized: smtpConfig.rejectUnauthorized,
            },
            // Prefer IPv4 — IPv6 / flaky routes to Gmail often cause ETIMEDOUT on Windows
            family: 4,
            connectionTimeout: 30_000,
            greetingTimeout: 30_000,
            socketTimeout: 30_000,
        });
    }

    return transporter;
};

export const sendEmail = async ({ to, subject, html, text, from }, { retries = 2 } = {}) => {
    const mailTransporter = getTransporter();

    if (!mailTransporter) {
        console.warn(
            'SMTP is not configured. Skipping email send. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env.'
        );
        return { skipped: true };
    }

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const info = await mailTransporter.sendMail({
                from: from || smtpConfig.from,
                to,
                subject,
                html,
                text,
            });
            return { skipped: false, messageId: info.messageId };
        } catch (error) {
            lastError = error;
            if (attempt < retries && isRetryableSmtpError(error)) {
                console.warn(
                    `SMTP send attempt ${attempt + 1} failed (${error.code}). Retrying...`
                );
                await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
                continue;
            }
            throw error;
        }
    }

    throw lastError;
};

// Backward-compatible wrapper for existing transporter.sendMail(...) call sites
const mailer = {
    sendMail: async (options) => sendEmail(options),
};

console.log(
    isSmtpConfigured()
        ? `Email provider: SMTP (${smtpConfig.host}:${smtpConfig.port})`
        : 'Email provider: SMTP (not configured)'
);

export default mailer;
