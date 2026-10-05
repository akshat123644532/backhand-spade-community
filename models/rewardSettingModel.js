import { db } from '../config/db.js';

const DEFAULT_QUESTIONNAIRE_POINTS = 200;

class RewardSetting {
<<<<<<< Updated upstream
    // Get reward settings
    static async get() {
        try {
=======
    static columnsEnsured = false;

    static async addColumnIfMissing(sql) {
        try {
            await db.execute(sql);
        } catch (error) {
            // Duplicate column is expected after the first successful migration.
            if (!String(error?.message ?? '').toLowerCase().includes('duplicate')) {
                // Ignore other race conditions; SELECT will surface real failures.
            }
        }
    }

    static async ensureTremendousColumn() {
        await RewardSetting.addColumnIfMissing(
            `ALTER TABLE reward_settings
             ADD COLUMN tremendous_enabled TINYINT(1) NOT NULL DEFAULT 0`
        );
    }

    static async ensureQuestionnaireColumn() {
        await RewardSetting.addColumnIfMissing(
            `ALTER TABLE reward_settings
             ADD COLUMN questionnaire_reward_points INT NOT NULL DEFAULT ${DEFAULT_QUESTIONNAIRE_POINTS}`
        );
    }

    // Migrations sirf ek baar per server process chalenge
    static async ensureColumns() {
        if (RewardSetting.columnsEnsured) return;
        await RewardSetting.ensureTremendousColumn();
        await RewardSetting.ensureQuestionnaireColumn();
        RewardSetting.columnsEnsured = true;
    }

    static async get() {
        try {
            await RewardSetting.ensureColumns();
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======
            await RewardSetting.ensureColumns();
>>>>>>> Stashed changes
            const {
                registration_reward_points,
                questionnaire_reward_points,
                minimum_payout,
                amazon_enabled,
                flipkart_enabled,
                paypal_enabled
            } = data;

            const query = `
<<<<<<< Updated upstream
                UPDATE reward_settings SET
                    registration_reward_points = ?,
=======
                UPDATE reward_settings SET 
                    registration_reward_points = ?, 
                    questionnaire_reward_points = ?,
>>>>>>> Stashed changes
                    minimum_payout = ?,
                    amazon_enabled = ?,
                    flipkart_enabled = ?,
                    paypal_enabled = ?,
                    updated_at = NOW()
                WHERE id = 1
            `;

            const values = [
                registration_reward_points,
                questionnaire_reward_points ?? DEFAULT_QUESTIONNAIRE_POINTS,
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