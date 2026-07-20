import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

const transporter = {
    sendMail: async ({ from, to, subject, html, text }) => {
        const { data, error } = await resend.emails.send({
            from: from || `Spade Community <${process.env.EMAIL_FROM}>`,
            to,
            subject,
            html,
            text
        });

        if (error) {
            throw new Error(error.message || 'Resend email failed');
        }
        return data;
    }
};

export default transporter;