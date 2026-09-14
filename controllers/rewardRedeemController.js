import RewardRedeem from '../models/rewardRedeemModel.js';
import Panelist from '../models/Panelistmodel.js';
import { addRewardPoints } from '../utils/rewardHelper.js';
import RewardSetting from '../models/rewardSettingModel.js';

export const addRedeemRequest = async (req, res) => {
    try {
        const { user_id, reward_points, requested_by, remark, comment } = req.body;

        if (!user_id || !reward_points) {
            return res.status(400).json({
                success: false,
                message: "user_id and reward_points are required!"
            });
        }

        const settings = await RewardSetting.get();

        if (!settings) {
            return res.status(500).json({
                success: false,
                message: "Reward settings not configured!"
            });
        }

        // Fetch panelist to check current balance
        const panelist = await Panelist.findById(user_id);
        if (!panelist) {
            return res.status(404).json({
                success: false,
                message: "Panelist not found!"
            });
        }

        // NEW: minimum_payout ko minimum redeemable points threshold ki tarah use kar rahe hain
        if (Number(panelist.balance_point) < Number(settings.minimum_payout)) {
            return res.status(400).json({
                success: false,
                message: `You need at least ${settings.minimum_payout} points in your balance to redeem!`,
                data: {
                    current_balance: Number(panelist.balance_point),
                    minimum_payout: Number(settings.minimum_payout)
                }
            });
        }

        if (Number(reward_points) > Number(settings.max_redeem_points)) {
            return res.status(400).json({
                success: false,
                message: `You can redeem maximum ${settings.max_redeem_points} points at a time!`,
                data: {
                    requested_points: Number(reward_points),
                    max_redeem_points: Number(settings.max_redeem_points)
                }
            });
        }

        // NEW: user apne balance se zyada redeem request na kar sake
        if (Number(reward_points) > Number(panelist.balance_point)) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance points to redeem!",
                data: {
                    balance_point: panelist.balance_point,
                    requested_points: reward_points
                }
            });
        }

        const id = await RewardRedeem.create({
            user_id,
            reward_points,
            requested_by,
            remark,
            comment
        });

        return res.status(201).json({
            success: true,
            message: "Redeem request added successfully!",
            data: { id }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
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

        if (request.status !== 'pending') {
            return res.status(409).json({
                success: false,
                message: `Redeem request already ${request.status}!`
            });
        }

        if (status === 'approved') {
            const panelist = await Panelist.findById(request.user_id);
            if (!panelist) {
                return res.status(404).json({ success: false, message: "Panelist not found!" });
            }

            if (Number(panelist.balance_point) < Number(request.reward_points)) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient balance points to approve this redeem request!",
                    data: {
                        balance_point: panelist.balance_point,
                        reward_points: request.reward_points
                    }
                });
            }

            await addRewardPoints({
                user_id: request.user_id,
                points: request.reward_points,
                transaction_type: 'debit',
                transaction_by: action_by || 'Admin',
                remark: 'Redeem Request Approved',
                reference_id: String(id),
                comment: comment || remark || ''
            });
        }

        await RewardRedeem.updateStatus(id, { status, action_by, remark, comment });
        return res.status(200).json({ success: true, message: `Redeem request ${status} successfully!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};