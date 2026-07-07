import RewardRedeem from '../models/rewardRedeemModel.js';

export const addRedeemRequest = async (req, res) => {
    try {
        const { user_id, reward_points, requested_by, remark, comment } = req.body;

        if (!user_id || !reward_points) {
            return res.status(400).json({ success: false, message: "user_id and reward_points are required!" });
        }

        const id = await RewardRedeem.create({ user_id, reward_points, requested_by, remark, comment });
        return res.status(201).json({ success: true, message: "Redeem request added successfully!", data: { id } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllRedeemRequests = async (req, res) => {
    try {
        const { page, limit, search, status, start_date, end_date } = req.query;
        const result = await RewardRedeem.getAll({ page, limit, search, status, start_date, end_date });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getRedeemRequestById = async (req, res) => {
    try {
        const { id } = req.params;
        const request = await RewardRedeem.getById(id);
        if (!request) return res.status(404).json({ success: false, message: "Redeem request not found!" });
        return res.status(200).json({ success: true, data: request });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateRedeemStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, action_by, remark, comment } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be approved or rejected!" });
        }

        const request = await RewardRedeem.getById(id);
        if (!request) return res.status(404).json({ success: false, message: "Redeem request not found!" });

        await RewardRedeem.updateStatus(id, { status, action_by, remark, comment });
        return res.status(200).json({ success: true, message: `Redeem request ${status} successfully!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};