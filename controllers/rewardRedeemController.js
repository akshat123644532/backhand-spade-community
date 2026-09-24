import RewardRedeem from '../models/rewardRedeemModel.js';
import Panelist from '../models/Panelistmodel.js';
import { addRewardPoints } from '../utils/rewardHelper.js';
import RewardSetting from '../models/rewardSettingModel.js';
import EmailTemplate from '../models/emailTemplateModel.js';
import { sendTransactionalEmail } from '../services/emailServices.js';
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

        const panelist = await Panelist.findById(user_id);
        if (!panelist) {
            return res.status(404).json({
                success: false,
                message: "Panelist not found!"
            });
        }

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

// ✅ FIXED — user ka remark/comment ab kabhi overwrite nahi hota.
// Admin apna decision "admin_remark" / "admin_comment" mein deta hai — dono admin
// panel aur panelist dono ko separately dikhte hain.
export const updateRedeemStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            status,
            action_by,
            admin_remark,
            admin_comment
        } = req.body;

        // ---------------------------------------------------------
        // 1. Validate status
        // ---------------------------------------------------------

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status must be approved or rejected!'
            });
        }

        // ---------------------------------------------------------
        // 2. Get redeem request
        // ---------------------------------------------------------
        
        const request = await RewardRedeem.getById(id);
        
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Redeem request not found!'
            });
        }

        // ---------------------------------------------------------
        // 3. Make sure request is still pending
        // ---------------------------------------------------------

        if (request.status !== 'pending') {
            return res.status(409).json({
                success: false,
                message:
                    `Redeem request already ${request.status}!`
            });
        }

        let panelist = null;
        let emailWarning = null;

        // =========================================================
        // APPROVED
        // =========================================================

        if (status === 'approved') {

            // -----------------------------------------------------
            // 4. Get panelist
            // -----------------------------------------------------

            panelist =
                await Panelist.findById(request.user_id);

            if (!panelist) {
                return res.status(404).json({
                    success: false,
                    message: 'Panelist not found!'
                });
            }

            // -----------------------------------------------------
            // 5. Check balance
            // -----------------------------------------------------

            if (
                Number(panelist.balance_point) <
                Number(request.reward_points)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Insufficient balance points to approve this redeem request!',
                    data: {
                        balance_point:
                            panelist.balance_point,
                        reward_points:
                            request.reward_points
                    }
                });
            }

            // -----------------------------------------------------
            // 6. Debit reward points
            // -----------------------------------------------------

            await addRewardPoints({
                user_id: request.user_id,
                points: request.reward_points,
                transaction_type: 'debit',
                transaction_by:
                    action_by || 'Admin',
                remark:
                    'Redeem Request Approved',
                reference_id: String(id),
                comment:
                    admin_comment ||
                    admin_remark ||
                    ''
            });

            // -----------------------------------------------------
            // 7. Update redeem request status
            // -----------------------------------------------------

            await RewardRedeem.updateStatus(id, {
                status,
                action_by,
                admin_remark,
                admin_comment
            });

            // =====================================================
            // 8. SEND APPROVAL EMAIL
            // =====================================================

            try {

                if (!panelist.email) {

                    emailWarning =
                        'Panelist email address not found.';

                    console.warn(
                        `[Redeem] Email not sent. ` +
                        `Panelist ${request.user_id} has no email.`
                    );

                } else {

                    const template =
                        await EmailTemplate.getByKey(
                            'redeem-request-approved-email'
                        );

                    if (!template) {

                        emailWarning =
                            'Redeem approval email template not found or inactive.';

                        console.warn(
                            '[Redeem] Approval email template not found.'
                        );

                    } else {

                        /*
                         * Use the values that your email template expects.
                         *
                         * Current parameters:
                         *
                         * {name}
                         * {reward_points}
                         * {reward_amount}
                         */
                        const { subject, body } =
                            EmailTemplate.render(
                                template,
                                {
                                    name:
                                        panelist.name ||
                                        'Panelist',

                                    reward_points:
                                        request.reward_points,

                                    admin_remark:
                                        admin_comment ||
                                        admin_remark ||
                                        ''
                                }
                            );

                        const emailResult =
                            await sendTransactionalEmail({
                                toEmail:
                                    panelist.email,

                                toName:
                                    panelist.name ||
                                    panelist.email,

                                subject,

                                htmlBody: body
                            });
                
                        if (
                            !emailResult 
                        ) {

                            emailWarning =
                                emailResult?.error ||
                                'Redeem approval email could not be sent.';

                            console.error(
                                '[Redeem] APPROVAL EMAIL FAILED:',
                                emailWarning
                            );

                        } else {

                            console.log(
                                `REDEEM APPROVAL EMAIL SENT TO: ` +
                                `${panelist.email} ✅`
                            );
                        }
                    }
                }

            } catch (mailError) {

                emailWarning =
                    mailError?.message ||
                    'Redeem approval email could not be sent.';

                console.error(
                    '[Redeem] APPROVAL EMAIL FAILED:',
                    emailWarning
                );
            }

        } else {

            // =====================================================
            // REJECTED
            // =====================================================

            await RewardRedeem.updateStatus(id, {
                status,
                action_by,
                admin_remark,
                admin_comment
            });
        }

        // ---------------------------------------------------------
        // 9. Get updated request
        // ---------------------------------------------------------

        const updated =
            await RewardRedeem.getById(id);

        // ---------------------------------------------------------
        // 10. Response
        // ---------------------------------------------------------

        return res.status(200).json({
            success: true,

            message: emailWarning
                ? `Redeem request ${status} successfully, but email could not be sent.`
                : `Redeem request ${status} successfully!`,

            ...(emailWarning && {
                email_warning: emailWarning
            }),

            data: updated
        });

    } catch (error) {

        console.error(
            '[Redeem] updateRedeemStatus error:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Server error!',
            error: error.message
        });
    }
};