import { db } from '../config/db.js';

class RewardSetting {
    static async get() {
        const [rows] = await db.execute(`SELECT * FROM reward_settings LIMIT 1`);
        return rows[0] || null;
    }

    static async update(data) {
        const {
            registration_reward_points,
            minimum_payout,
            amazon_enabled,
            flipkart_enabled,
            paypal_enabled
        } = data;

        await db.execute(`
            UPDATE reward_settings SET
                registration_reward_points = ?,
                minimum_payout = ?,
                amazon_enabled = ?,
                flipkart_enabled = ?,
                paypal_enabled = ?
            LIMIT 1
        `, [
            registration_reward_points,
            minimum_payout,
            amazon_enabled,
            flipkart_enabled,
            paypal_enabled
        ]);
    }
}

export default RewardSetting;