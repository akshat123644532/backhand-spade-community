import { db } from '../config/db.js';
import RewardTransaction from '../models/rewardTransactionModel.js';
import RewardHistory from '../models/rewardHistoryModel.js';
import Panelist from '../models/Panelistmodel.js';
import { createSystemMessage } from './messageHelper.js';

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

    // Naya: credit hone pe panelist ko reward confirmation message bhejo
    if (transaction_type === 'credit') {
        try {
            const panelist = await Panelist.findById(user_id);
            if (panelist) {
                await createSystemMessage({
                    sender_name: panelist.name,
                    sender_email: panelist.email,
                    subject: 'Reward Confirmation',
                    body: `Hi ${panelist.name},\n\nYou have received ${points} reward points.${remark ? ` (${remark})` : ''}\n\nThank You,\nSpade Community`
                });
            }
        } catch (err) {
            console.error('REWARD MESSAGE CREATE FAILED:', err.message);
        }
    }
};