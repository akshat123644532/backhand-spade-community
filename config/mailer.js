import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

// Render free tier blocks SMTP ports 25/465/587 — use Resend (HTTPS) in production
const useResend = Boolean(process.env.RESEND_API_KEY);
const verifiedSender = process.env.EMAIL_FROM;
const gmailUser = process.env.EMAIL_USER;

const defaultFrom = useResend && verifiedSender
    ? `"Spade Community" <${verifiedSender}>`
    : `"Spade Community" <${gmailUser}>`;

const normalizeFrom = (from) => {
    if (!from) return defaultFrom;

    if (useResend && verifiedSender) {
        const displayNameMatch = from.match(/^(.+?)\s*<[^>]+>$/);
        const displayName = displayNameMatch?.[1]?.trim() || 'Spade Community';
        return `${displayName} <${verifiedSender}>`;
    }

    return from;
};

const resend = useResend ? new Resend(process.env.RESEND_API_KEY) : null;

let smtpTransport = null;
if (!useResend) {
    const smtpPort = Number(process.env.EMAIL_PORT) === 465 ? 465 : 587;
    smtpTransport = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
            user: gmailUser,
            pass: process.env.EMAIL_PASS?.replace(/\s/g, ''),
        },
        // Local dev only — corporate proxy/antivirus may break cert chain
        tls: {
            rejectUnauthorized: false,
        },
    });
}

const transporter = {
    sendMail: async ({ from, to, subject, html, text }) => {
        if (useResend) {
            const { data, error } = await resend.emails.send({
                from: normalizeFrom(from),
                to: Array.isArray(to) ? to : [to],
                subject,
                html,
                text,
            });

            if (error) {
                throw new Error(error.message || JSON.stringify(error));
            }

            return data;
        }

        return smtpTransport.sendMail({
            from: from || defaultFrom,
            to,
            subject,
            html,
            text,
        });
    },
};

console.log(useResend ? 'Email provider: Resend API (HTTPS)' : 'Email provider: SMTP');

export default transporter;
