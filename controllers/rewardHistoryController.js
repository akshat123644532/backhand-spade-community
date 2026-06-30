import RewardHistory from '../models/rewardHistoryModel.js';

export const addRewardHistory = async (req, res) => {
    try {
        const { user_id, reward_points, transaction_type, reward_type, status, remarks } = req.body;

        if (!user_id || !reward_points || !transaction_type || !reward_type) {
            return res.status(400).json({ success: false, message: "user_id, reward_points, transaction_type and reward_type are required!" });
        }

        if (!['credit', 'debit'].includes(transaction_type)) {
            return res.status(400).json({ success: false, message: "transaction_type must be credit or debit!" });
        }

        await RewardHistory.create({ user_id, reward_points, transaction_type, reward_type, status, remarks, created_by: req.user?.id || null });

        return res.status(201).json({ success: true, message: "Reward history added successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllRewardHistory = async (req, res) => {
    try {
        const { page, limit, search, status, start_date, end_date } = req.query;
        const result = await RewardHistory.getAll({
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 10,
            search, status, start_date, end_date
        });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getRewardHistoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const history = await RewardHistory.getById(id);
        if (!history) return res.status(404).json({ success: false, message: "Record not found!" });
        return res.status(200).json({ success: true, data: history });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};