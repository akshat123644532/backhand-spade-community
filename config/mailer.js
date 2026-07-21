import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();


const nodemailerTransport = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: 587, 
    secure: false, // true for 465, false for 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const transporter = {
    sendMail: async ({ from, to, subject, html, text }) => {
        const info = await nodemailerTransport.sendMail({
            from: from || `"Spade Community" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
            text
        });
        return info;
        
    }
};

export default transporter;