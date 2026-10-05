import RewardSetting from '../models/rewardSettingModel.js';
import { logActivity } from '../utils/activityLogger.js';

const formatSettings = (s) => ({
    id: s.id,
    registration_reward_points: s.registration_reward_points,
    questionnaire_reward_points: s.questionnaire_reward_points,
    minimum_payout: s.minimum_payout,
    max_redeem_points: s.max_redeem_points,
    amazon_enabled: !!s.amazon_enabled,
    flipkart_enabled: !!s.flipkart_enabled,
    paypal_enabled: !!s.paypal_enabled,
    tremendous_enabled: !!s.tremendous_enabled,
    created_at: s.created_at,
    updated_at: s.updated_at
});

// Get reward settings
export const getSettings = async (req, res) => {
    try {
        const settings = await RewardSetting.get();

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: "Reward settings not configured!"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Reward settings fetched successfully",
<<<<<<< Updated upstream
            data: {
                id: settings.id,
                registration_reward_points: settings.registration_reward_points,
                minimum_payout: settings.minimum_payout,
                amazon_enabled: !!settings.amazon_enabled,
                flipkart_enabled: !!settings.flipkart_enabled,
                paypal_enabled: !!settings.paypal_enabled,
                created_at: settings.created_at,
                updated_at: settings.updated_at
            }
=======
            data: formatSettings(settings)
>>>>>>> Stashed changes
        });
    } catch (error) {
        console.error('GET Settings error:', error);
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

// Update reward settings
export const updateSettings = async (req, res) => {
    try {
        const {
            registration_reward_points,
<<<<<<< Updated upstream
            minimum_payout,
            amazon_enabled,
            flipkart_enabled,
            paypal_enabled
        } = req.body;

        // Validate required fields
        if (
            registration_reward_points === undefined ||
            minimum_payout === undefined ||
=======
            questionnaire_reward_points,
            minimum_payout,
            max_redeem_points,
            amazon_enabled,
            flipkart_enabled,
            paypal_enabled,
            tremendous_enabled
        } = req.body;

        if (
            registration_reward_points === undefined ||
            questionnaire_reward_points === undefined ||
            minimum_payout === undefined ||
            max_redeem_points === undefined ||
>>>>>>> Stashed changes
            amazon_enabled === undefined ||
            flipkart_enabled === undefined ||
            paypal_enabled === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required!"
            });
        }

<<<<<<< Updated upstream
        // Validate data types
        if (isNaN(registration_reward_points) || isNaN(minimum_payout)) {
=======
        if (
            isNaN(registration_reward_points) ||
            isNaN(questionnaire_reward_points) ||
            isNaN(minimum_payout) ||
            isNaN(max_redeem_points)
        ) {
>>>>>>> Stashed changes
            return res.status(400).json({
                success: false,
                message: "Points and payout must be numeric values!"
            });
        }

<<<<<<< Updated upstream
        // Validate values
        if (registration_reward_points < 0 || minimum_payout < 0) {
=======
        if (
            Number(registration_reward_points) < 0 ||
            Number(questionnaire_reward_points) < 0 ||
            Number(minimum_payout) < 0 ||
            Number(max_redeem_points) < 0
        ) {
>>>>>>> Stashed changes
            return res.status(400).json({
                success: false,
                message: "Values cannot be negative!"
            });
        }

        const updatedData = await RewardSetting.update({
            registration_reward_points: parseInt(registration_reward_points),
            questionnaire_reward_points: parseInt(questionnaire_reward_points),
            minimum_payout: parseFloat(minimum_payout),
            amazon_enabled: amazon_enabled === true || amazon_enabled === 'true',
            flipkart_enabled: flipkart_enabled === true || flipkart_enabled === 'true',
<<<<<<< Updated upstream
            paypal_enabled: paypal_enabled === true || paypal_enabled === 'true'
=======
            paypal_enabled: paypal_enabled === true || paypal_enabled === 'true',
            tremendous_enabled: tremendous_enabled === true || tremendous_enabled === 'true'
>>>>>>> Stashed changes
        });

        await logActivity({
            admin_id: req.user?.id,
            action: 'UPDATE',
            module: 'Reward Settings',
            description: `Reward settings updated. Registration Points: ${registration_reward_points}, Questionnaire Points: ${questionnaire_reward_points}, Min Payout: $${minimum_payout}`,
            ip_address: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "Reward settings updated successfully!",
<<<<<<< Updated upstream
            data: {
                id: updatedData.id,
                registration_reward_points: updatedData.registration_reward_points,
                minimum_payout: updatedData.minimum_payout,
                amazon_enabled: !!updatedData.amazon_enabled,
                flipkart_enabled: !!updatedData.flipkart_enabled,
                paypal_enabled: !!updatedData.paypal_enabled,
                created_at: updatedData.created_at,
                updated_at: updatedData.updated_at
            }
=======
            data: formatSettings(updatedData)
>>>>>>> Stashed changes
        });
    } catch (error) {
        console.error('UPDATE Settings error:', error);
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};