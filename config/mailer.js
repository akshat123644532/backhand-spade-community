import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const smtpPort = Number(process.env.EMAIL_PORT) === 465 ? 465 : 587;

const nodemailerTransport = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS?.replace(/\s/g, ''),
    },
    // Corporate proxy / antivirus SSL inspection breaks cert chain on this machine
    tls: {
        rejectUnauthorized: false,
    },
});

const transporter = {
    sendMail: async ({ from, to, subject, html, text }) => {
        const info = await nodemailerTransport.sendMail({
            from: from || `"Spade Community" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
            text,
        });
        return info;
    },
};

export default transporter;
