import { db } from '../config/db.js';

class RewardSetting {
    // Get reward settings
    static async get() {
        try {
            const query = 'SELECT * FROM reward_settings WHERE id = 1 LIMIT 1';
            const [rows] = await db.execute(query);
            return rows?.[0] || null;
        } catch (error) {
            console.error('RewardSetting GET error:', error);
            throw error;
        }
    }

    // Update reward settings
    static async update(data) {
        try {
            const {
                registration_reward_points,
                minimum_payout,
                amazon_enabled,
                flipkart_enabled,
                paypal_enabled
            } = data;

            const query = `
                UPDATE reward_settings SET
                    registration_reward_points = ?,
                    minimum_payout = ?,
                    amazon_enabled = ?,
                    flipkart_enabled = ?,
                    paypal_enabled = ?,
                    updated_at = NOW()
                WHERE id = 1
            `;

            const values = [
                registration_reward_points,
                minimum_payout,
                amazon_enabled ? 1 : 0,
                flipkart_enabled ? 1 : 0,
                paypal_enabled ? 1 : 0
            ];

            await db.execute(query, values);

            // Return fresh data after update
            return await RewardSetting.get();
        } catch (error) {
            console.error('RewardSetting UPDATE error:', error);
            throw error;
        }
    }
}

export default RewardSetting;