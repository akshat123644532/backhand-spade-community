import { db } from '../config/db.js';

class RewardSetting {
    static async ensureTremendousColumn() {
        try {
            await db.execute(
                `ALTER TABLE reward_settings
                 ADD COLUMN tremendous_enabled TINYINT(1) NOT NULL DEFAULT 0`
            );
        } catch (error) {
            // Duplicate column is expected after the first successful migration.
            if (!String(error?.message ?? '').toLowerCase().includes('duplicate')) {
                // Ignore other race conditions; SELECT will surface real failures.
            }
        }
    }

    static async get() {
        try {
            await RewardSetting.ensureTremendousColumn();
            const query = 'SELECT * FROM reward_settings WHERE id = 1 LIMIT 1';
            const [rows] = await db.execute(query);
            return rows?.[0] || null;
        } catch (error) {
            console.error('RewardSetting GET error:', error);
            throw error;
        }
    }

    static async update(data) {
        try {
            await RewardSetting.ensureTremendousColumn();
            const {
                registration_reward_points,
                minimum_payout,
                max_redeem_points,
                amazon_enabled,
                flipkart_enabled,
                paypal_enabled,
                tremendous_enabled
            } = data;

            const query = `
                UPDATE reward_settings SET 
                    registration_reward_points = ?, 
                    minimum_payout = ?,
                    max_redeem_points = ?,
                    amazon_enabled = ?, 
                    flipkart_enabled = ?, 
                    paypal_enabled = ?,
                    tremendous_enabled = ?,
                    updated_at = NOW() 
                WHERE id = 1
            `;

            const values = [
                registration_reward_points,
                minimum_payout,
                max_redeem_points,
                amazon_enabled ? 1 : 0,
                flipkart_enabled ? 1 : 0,
                paypal_enabled ? 1 : 0,
                tremendous_enabled ? 1 : 0
            ];

            await db.execute(query, values);

            return await RewardSetting.get();
        } catch (error) {
            console.error('RewardSetting UPDATE error:', error);
            throw error;
        }
    }
}

export default RewardSetting;
