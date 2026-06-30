import RewardSetting from '../models/rewardSettingModel.js';

export const getSettings = async (req, res) => {
    try {
        const settings = await RewardSetting.get();
        return res.status(200).json({ success: true, data: settings });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateSettings = async (req, res) => {
    try {
        const {
            registration_reward_points,
            minimum_payout,
            amazon_enabled,
            flipkart_enabled,
            paypal_enabled
        } = req.body;

        if (
            registration_reward_points === undefined ||
            minimum_payout === undefined ||
            amazon_enabled === undefined ||
            flipkart_enabled === undefined ||
            paypal_enabled === undefined
        ) {
            return res.status(400).json({ success: false, message: "All fields are required!" });
        }

        await RewardSetting.update({
            registration_reward_points,
            minimum_payout,
            amazon_enabled,
            flipkart_enabled,
            paypal_enabled
        });

        return res.status(200).json({ success: true, message: "Reward settings updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};