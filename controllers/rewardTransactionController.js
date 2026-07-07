import RewardTransaction from '../models/rewardTransactionModel.js';

export const addTransaction = async (req, res) => {
    try {
        const { user_id, reward_points, transaction_type, transaction_by, remark, reference_id, status, comment } = req.body;

        if (!user_id || !reward_points || !transaction_type) {
            return res.status(400).json({ success: false, message: "user_id, reward_points and transaction_type are required!" });
        }

        if (!['credit', 'debit'].includes(transaction_type)) {
            return res.status(400).json({ success: false, message: "transaction_type must be credit or debit!" });
        }

        const id = await RewardTransaction.create({ user_id, reward_points, transaction_type, transaction_by, remark, reference_id, status, comment });
        return res.status(201).json({ success: true, message: "Transaction added successfully!", data: { id } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllTransactions = async (req, res) => {
    try {
        const { page, limit, search, status, transaction_type, start_date, end_date } = req.query;
        const result = await RewardTransaction.getAll({ page, limit, search, status, transaction_type, start_date, end_date });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getTransactionById = async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await RewardTransaction.getById(id);
        if (!transaction) return res.status(404).json({ success: false, message: "Transaction not found!" });
        return res.status(200).json({ success: true, data: transaction });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await RewardTransaction.getById(id);
        if (!transaction) return res.status(404).json({ success: false, message: "Transaction not found!" });
        await RewardTransaction.delete(id);
        return res.status(200).json({ success: true, message: "Transaction deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};