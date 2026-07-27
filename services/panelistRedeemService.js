import PanelistPortal from '../models/panelistPortalModel.js';
import RewardSetting from '../models/rewardSettingModel.js';

const createServiceError = (status, message, data) => {
    const error = new Error(message);
    error.status = status;
    if (data !== undefined) error.data = data;
    return error;
};

export const submitRedeemRequest = async ({ userId, reward_points, remark, comment }) => {
    if (!reward_points) {
        throw createServiceError(400, 'Reward points are required!');
    }

    const panelist = await PanelistPortal.getDashboard(userId);
    if (!panelist) {
        throw createServiceError(404, 'Panelist not found!');
    }

    const settings = await RewardSetting.get();
    const minimum_payout = settings?.minimum_payout || 500;

    if (panelist.balance_point < minimum_payout) {
        throw createServiceError(400, `Minimum ${minimum_payout} points required to redeem!`, {
            balance_point: panelist.balance_point,
            minimum_payout
        });
    }

    if (reward_points > panelist.balance_point) {
        throw createServiceError(400, 'Insufficient balance points!', {
            balance_point: panelist.balance_point
        });
    }

    const request_id = await PanelistPortal.submitRedeemRequest({
        user_id: userId,
        reward_points,
        requested_by: panelist.name,
        remark,
        comment
    });

    return { request_id };
};
