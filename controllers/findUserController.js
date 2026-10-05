import FindUser from '../models/FindUserModel.js';
import Project from '../models/projectModel.js';
import ProjectInvitedUser from '../models/ProjectInvitedUserModel.js';
import EmailTemplate from '../models/Emailtemplatemodel.js';
import Panelist from '../models/Panelistmodel.js';
import transporter from '../config/mailer.js';
import ProjectUrl from '../models/projectUrlModel.js';
import SupplierMapping from '../models/supplierMappingModel.js';
import ProjectMultipleUrl from '../models/projectMultipleUrlModel.js';
import { encryptUid } from '../utils/linkSecurityHelper.js';
import EmailCampaignService from '../services/emailCampaign.service.js';
export const isMultiLink = (type) =>
    String(type || '').trim().toLowerCase().replace(/[\s_-]+/g, '') === 'multilink';

export const buildUidForPanelist = (panelist) => String(panelist.id);

export const applyEncryptedUidToLink = (link, uid) => {
    const encrypted = encryptUid(uid);
    try {
        const url = new URL(link);
        url.searchParams.set('uid', encrypted);
        return url.toString();
    } catch {
        return link.includes('uid=')
            ? link.replace(/uid=[^&]*/, `uid=${encrypted}`)
            : `${link}${link.includes('?') ? '&' : '?'}uid=${encrypted}`;
    }
};

export const getFilterQuestions = async (req, res) => {
    try {
        const questions = await FindUser.getFilterQuestions();
        return res.status(200).json({ success: true, data: questions });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAnswerOptions = async (req, res) => {
    try {
        const { questionId } = req.params;
        const question = await FindUser.getAnswerOptions(questionId);
        if (!question) return res.status(404).json({ success: false, message: "Question not found!" });
        return res.status(200).json({ success: true, data: question });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getEligibleProjectUrls = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        const urls = await ProjectUrl.getEligibleByProjectId(id);
        return res.status(200).json({ success: true, data: urls });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const searchUsers = async (req, res) => {
    try {
        const { id } = req.params;
        const { filters, page, limit } = req.body;

        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        if (!filters || !Array.isArray(filters) || filters.length === 0) {
            return res.status(400).json({ success: false, message: "At least one filter is required!" });
        }

        const result = await FindUser.search(filters, { page, limit });

        const questionTitles = await FindUser.getQuestionTitles(filters.map(f => f.question_id));

        const panelistIds = result.data.map(r => r.id);
        const inviteMap = await ProjectInvitedUser.getMapByProject(id, panelistIds);

        result.data = result.data.map(row => {
            const matched_answers = filters.map((f, idx) => ({
                question_id: f.question_id,
                question_title: questionTitles[f.question_id] || null,
                answer: row[`answer_${idx}`]
            }));

            const cleanRow = { ...row };
            filters.forEach((f, idx) => { delete cleanRow[`answer_${idx}`]; });

            return {
                ...cleanRow,
                matched_answers,
                invite_status: inviteMap[row.id]?.invite_status || 'not_invited',
                message: inviteMap[row.id]?.message || null,
                earned_points: row.balance_point
            };
        });

        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const inviteUsers = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            panelist_ids,
            email_template_id,
            project_url_id
        } = req.body;

        /*
         * ---------------------------------------------------------
         * 1. Validate request
         * ---------------------------------------------------------
         */

        if (
            !panelist_ids ||
            !Array.isArray(panelist_ids) ||
            panelist_ids.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "panelist_ids array is required!"
            });
        }

        if (!email_template_id) {
            return res.status(400).json({
                success: false,
                message: "email_template_id is required!"
            });
        }

        /*
         * ---------------------------------------------------------
         * 2. Validate project
         * ---------------------------------------------------------
         */

        const project = await Project.getById(id);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found!"
            });
        }

        /*
         * ---------------------------------------------------------
         * 3. Validate email template
         *
         * This keeps the existing API contract because
         * inviteUsers still receives email_template_id.
         *
         * The actual Zoho campaign template is currently loaded
         * inside EmailCampaignService using:
         *
         * panelist-survey-campaign
         * ---------------------------------------------------------
         */

        const template = await EmailTemplate.getById(email_template_id);

        if (!template) {
            return res.status(404).json({
                success: false,
                message: "Email template not found!"
            });
        }

        /*
         * ---------------------------------------------------------
         * 4. Validate project URL selection
         *
         * EmailCampaignService also validates this, but we keep
         * the request-level validation here so the API returns
         * the same useful error to the frontend.
         * ---------------------------------------------------------
         */

        const urls = await ProjectUrl.getByProjectId(id);

        if (!urls || urls.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Add Project URL Info first before inviting users!"
            });
        }

        if (!project_url_id && urls.length > 1) {
            return res.status(400).json({
                success: false,
                message:
                    "Multiple Project URLs found for this project. Please pass project_url_id in the request body.",
                availableUrls: urls.map(u => ({
                    project_url_id: u.id,
                    project_url_code: u.project_url_code,
                    Project_Link_Type: u.Project_Link_Type
                }))
            });
        }

        let selectedProjectUrlId = project_url_id;

        if (selectedProjectUrlId) {
            const selectedUrl = urls.find(
                u => Number(u.id) === Number(selectedProjectUrlId)
            );

            if (!selectedUrl) {
                return res.status(400).json({
                    success: false,
                    message: "Project URL not found for this project!"
                });
            }
        } else {
            selectedProjectUrlId = urls[0].id;
        }

        /*
         * ---------------------------------------------------------
         * 5. CREATE + SEND ZOHO CAMPAIGN
         * ---------------------------------------------------------
         *
         * All actual email logic is handled by
         * EmailCampaignService:
         *
         * - vendor URL selection
         * - panelist-specific UID
         * - personalized survey URL
         * - local campaign creation
         * - recipient creation
         * - Zoho contact sync
         * - Marketing topic association
         * - Zoho campaign creation
         * - Zoho campaign sending
         *
         * DO NOT call transporter.sendMail() here.
        //  */
        // console.log('panelist_ids', panelist_ids);
        // console.log('selectedProjectUrlId', selectedProjectUrlId);
        // console.log('id', id);
        const campaignResult =
            await EmailCampaignService.createCampaign({
                projectId: Number(id),
                panelistIds: panelist_ids,
                projectUrlId: selectedProjectUrlId
            });

        // console.log('campaignResult', campaignResult);

        /*
         * ---------------------------------------------------------
         * 6. Save existing ProjectInvitedUser records
         * ---------------------------------------------------------
         *
         * This preserves the existing application's invitation
         * tracking.
         *
         * It does NOT send another email.
         */

        const panelistRows =
            await Panelist.findByIds(panelist_ids);

        const panelistById = new Map(
            panelistRows.map(panelist => [
                Number(panelist.id),
                panelist
            ])
        );

        const inviteRows = [];
        const skipped = [];

        for (const panelistId of panelist_ids) {
            const panelist =
                panelistById.get(Number(panelistId));

            if (!panelist) {
                skipped.push({
                    panelist_id: panelistId,
                    reason: "Panelist not found"
                });

                continue;
            }

            inviteRows.push({
                project_id: id,
                panelist_id: panelistId,
                email_template_id,
                message:
                    campaignResult.subject ||
                    "Survey invitation"
            });
        }

        if (inviteRows.length > 0) {
            await ProjectInvitedUser.createMany(inviteRows);
        }

        /*
         * ---------------------------------------------------------
         * 7. Return response
         * ---------------------------------------------------------
         */

        return res.status(200).json({
            success: true,

            message:
                `${campaignResult.invitedCount} user(s) invited successfully!`,

            campaign: {
                campaignId: campaignResult.campaignId,
                campaignName: campaignResult.campaignName,
                zohoCampaignId: campaignResult.zohoCampaignId,
                zohoCampaignKey: campaignResult.zohoCampaignKey,
                subject: campaignResult.subject,
                invitedCount: campaignResult.invitedCount
            },

            skipped_count: campaignResult.skippedCount,
            skipped: campaignResult.skipped,

            zohoContactFailures:
                campaignResult.zohoContactFailures || []
        });

    } catch (error) {
        console.error("Invite users error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Server error!"
        });
    }
};

export const listInvitedUsers = async (req, res) => {
    try {
        const { id } = req.params;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        const result = await ProjectInvitedUser.getByProject(id, { page, limit });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};