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
            data: formatSettings(settings)
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
            amazon_enabled === undefined ||
            flipkart_enabled === undefined ||
            paypal_enabled === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required!"
            });
        }

        if (
            isNaN(registration_reward_points) ||
            isNaN(questionnaire_reward_points) ||
            isNaN(minimum_payout) ||
            isNaN(max_redeem_points)
        ) {
            return res.status(400).json({
                success: false,
                message: "Points and payout must be numeric values!"
            });
        }

        if (
            Number(registration_reward_points) < 0 ||
            Number(questionnaire_reward_points) < 0 ||
            Number(minimum_payout) < 0 ||
            Number(max_redeem_points) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Values cannot be negative!"
            });
        }

        const updatedData = await RewardSetting.update({
            registration_reward_points: parseInt(registration_reward_points),
            questionnaire_reward_points: parseInt(questionnaire_reward_points),
            minimum_payout: parseFloat(minimum_payout),
            max_redeem_points: parseInt(max_redeem_points),
            amazon_enabled: amazon_enabled === true || amazon_enabled === 'true',
            flipkart_enabled: flipkart_enabled === true || flipkart_enabled === 'true',
            paypal_enabled: paypal_enabled === true || paypal_enabled === 'true',
            tremendous_enabled: tremendous_enabled === true || tremendous_enabled === 'true'
            
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
            data: formatSettings(updatedData)
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
