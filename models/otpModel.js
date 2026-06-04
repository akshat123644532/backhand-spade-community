import { db } from '../config/db.js';

const OTP = {

    create: async (email, otpCode, expiresAt) => {

        const query = `
            INSERT INTO otp_verification
            (
                email,
                otp_code,
                expires_at
            )
            VALUES (?, ?, ?)
        `;

        const [result] = await db.execute(
            query,
            [
                email,
                otpCode,
                expiresAt
            ]
        );

        return result;
    },

    findValidOTP: async (email, otp) => {

        const query = `
            SELECT *
            FROM otp_verification
            WHERE email = ?
            AND otp_code = ?
            ORDER BY otp_id DESC
            LIMIT 1
        `;

        const [rows] = await db.execute(
            query,
            [
                email,
                otp
            ]
        );

        return rows[0];
    },

    markVerified: async (otpId) => {

        const query = `
            UPDATE otp_verification
            SET is_verified = 1
            WHERE otp_id = ?
        `;

        await db.execute(query, [otpId]);
    }

};

export default OTP;