import RewardSetting from '../models/rewardSettingModel.js';
import { logActivity } from '../utils/activityLogger.js';

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
            minimum_payout,
            amazon_enabled,
            flipkart_enabled,
            paypal_enabled
        } = req.body;

        // Validate required fields
        if (
            registration_reward_points === undefined ||
            minimum_payout === undefined ||
            amazon_enabled === undefined ||
            flipkart_enabled === undefined ||
            paypal_enabled === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required!"
            });
        }

        // Validate data types
        if (isNaN(registration_reward_points) || isNaN(minimum_payout)) {
            return res.status(400).json({
                success: false,
                message: "Points and payout must be numeric values!"
            });
        }

        // Validate values
        if (registration_reward_points < 0 || minimum_payout < 0) {
            return res.status(400).json({
                success: false,
                message: "Values cannot be negative!"
            });
        }

        // Update in database
        const updatedData = await RewardSetting.update({
            registration_reward_points: parseInt(registration_reward_points),
            minimum_payout: parseFloat(minimum_payout),
            amazon_enabled: amazon_enabled === true || amazon_enabled === 'true',
            flipkart_enabled: flipkart_enabled === true || flipkart_enabled === 'true',
            paypal_enabled: paypal_enabled === true || paypal_enabled === 'true'
        });

        // Log activity
        await logActivity({
            admin_id: req.user?.id,
            action: 'UPDATE',
            module: 'Reward Settings',
            description: `Reward settings updated. Registration Points: ${registration_reward_points}, Min Payout: $${minimum_payout}`,
            ip_address: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "Reward settings updated successfully!",
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