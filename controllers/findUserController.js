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

const isMultiLink = (type) =>
    String(type || '').trim().toLowerCase().replace(/\s+/g, ' ') === 'multi link';

// uid = panelist_id directly. Simple, unique, and lets reward-points logic
// match a completed survey (survery_data.UserId, decrypted) straight back to
// a panelist via Panelist.findById(uid) — no extra lookup needed.
const buildUidForPanelist = (panelist) => String(panelist.id);

// Injects the encrypted uid into the vendor survey link as a `uid` query param.
const applyEncryptedUidToLink = (link, uid) => {
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
        const { id } = req.params; // project_id
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
        const { id } = req.params; // project_id
        const { filters, page, limit } = req.body; // filters = [{ question_id, answers: [...] }, ...]

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

// Invite selected panelists. Vendor URL is picked from supplier_mapping (Single Link)
// or project_mutiple_Url (Multi Link, round-robin). The uid used in the link is
// derived from the panelist and never stored — only the encrypted link is emailed.
export const inviteUsers = async (req, res) => {
    try {
        const { id } = req.params; // project_id
        const { panelist_ids, email_template_id, project_url_id } = req.body;

        if (!panelist_ids || !Array.isArray(panelist_ids) || panelist_ids.length === 0) {
            return res.status(400).json({ success: false, message: "panelist_ids array is required!" });
        }
        if (!email_template_id) {
            return res.status(400).json({ success: false, message: "email_template_id is required!" });
        }

        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        const template = await EmailTemplate.getById(email_template_id);
        if (!template) return res.status(404).json({ success: false, message: "Email template not found!" });

        // Project_Link_Type lives on project_url_Info, not project_Info.
        let urlInfo = null;
        if (project_url_id) {
            urlInfo = await ProjectUrl.getById(project_url_id);
            if (!urlInfo || Number(urlInfo.project_id) !== Number(id)) {
                return res.status(404).json({ success: false, message: "Project URL not found for this project!" });
            }
        } else {
            const urlInfoRows = await ProjectUrl.getByProjectId(id);
            if (!urlInfoRows || !urlInfoRows.length) {
                return res.status(400).json({
                    success: false,
                    message: "Add Project URL Info first before inviting users!"
                });
            }
            if (urlInfoRows.length > 1) {
                return res.status(400).json({
                    success: false,
                    message: "Multiple Project URLs found for this project. Please pass project_url_id in the request body.",
                    availableUrls: urlInfoRows.map(u => ({
                        project_url_id: u.id,
                        project_url_code: u.project_url_code,
                        Project_Link_Type: u.Project_Link_Type
                    }))
                });
            }
            urlInfo = urlInfoRows[0];
        }

        const multiLink = isMultiLink(urlInfo.Project_Link_Type);

        let singleVenderUrl = null;
        let multiVenderUrls = [];

        if (multiLink) {
            const rows = await ProjectMultipleUrl.getActiveVenderUrlsByProjectId(id);
            multiVenderUrls = rows.map(r => r.VenderURL);
            if (!multiVenderUrls.length) {
                return res.status(400).json({
                    success: false,
                    message: "No active Vendor URL found in project_mutiple_Url for this project!"
                });
            }
        } else {
            singleVenderUrl = await SupplierMapping.getVenderUrlByProjectId(id);
            if (!singleVenderUrl) {
                return res.status(400).json({
                    success: false,
                    message: "No active Vendor URL found in supplier_mapping for this project!"
                });
            }
        }

        let invited = 0;
        for (let i = 0; i < panelist_ids.length; i++) {
            const panelistId = panelist_ids[i];
            const panelist = await Panelist.findById(panelistId);
            if (!panelist) continue;

            // Multi link: each panelist gets one VenderURL, round-robin.
            const rawLink = multiLink
                ? multiVenderUrls[i % multiVenderUrls.length]
                : singleVenderUrl;

            // uid auto-filled from panelist, then encrypted before going into the link.
            const panelistUid = buildUidForPanelist(panelist);
            console.log('DEBUG rawLink:', rawLink);          // TEMP — remove after debugging
            console.log('DEBUG panelistUid:', panelistUid);  // TEMP — remove after debugging

            const survey_link = applyEncryptedUidToLink(rawLink, panelistUid);
            console.log('DEBUG survey_link:', survey_link);  // TEMP — remove after debugging

            const rendered = EmailTemplate.render(template, {
                user_name: panelist.name,
                survey_name: project.Project_Name,
                survey_url: survey_link
            });
            console.log('DEBUG rendered.body:', rendered.body); // TEMP — remove after debugging

            transporter.sendMail({
                to: panelist.email,
                subject: rendered.subject,
                html: rendered.body
            }).catch(err => console.error('Invite email failed:', err.message));

            // No uid / survey_link stored — table stays exactly as it was.
            await ProjectInvitedUser.create({
                project_id: id,
                panelist_id: panelistId,
                email_template_id,
                message: rendered.subject
            });
            invited++;
        }

        return res.status(200).json({ success: true, message: `${invited} user(s) invited successfully!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
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