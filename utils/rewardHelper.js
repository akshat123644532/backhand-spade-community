import { db } from '../config/db.js';
import RewardTransaction from '../models/rewardTransactionModel.js';
import RewardHistory from '../models/rewardHistoryModel.js';

export const addRewardPoints = async ({ user_id, points, transaction_type = 'credit', transaction_by = 'Admin', remark = '', reference_id = null, comment = '' }) => {

    // 1. panelists table mein balance update
    if (transaction_type === 'credit') {
        await db.execute(
            `UPDATE panelists SET balance_point = balance_point + ?, updated_at = NOW() WHERE id = ?`,
            [points, user_id]
        );
    } else {
        await db.execute(
            `UPDATE panelists SET balance_point = balance_point - ?, updated_at = NOW() WHERE id = ?`,
            [points, user_id]
        );
    }

    await RewardTransaction.create({
        user_id,
        reward_points: points,
        transaction_type,
        transaction_by,
        remark,
        reference_id,
        status: 'completed',
        comment
    });

  
    await RewardHistory.create({
        user_id,
        reward_points: points,
        transaction_type,
        reward_type: remark,
        status: 'completed',
        remarks: comment,
        created_by: null
    });
};