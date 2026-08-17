import FindUser from '../models/FindUserModel.js';
import Project from '../models/projectModel.js';
import ProjectInvitedUser from '../models/ProjectInvitedUserModel.js';
import EmailTemplate from '../models/Emailtemplatemodel.js';
import Panelist from '../models/Panelistmodel.js';
import transporter from '../config/mailer.js';
import ProjectUrl from '../models/projectUrlModel.js';
import SupplierMapping from '../models/supplierMappingModel.js';
import ProjectMultipleUrl from '../models/projectMultipleUrlModel.js';

const isMultiLink = (type) =>
    String(type || '').trim().toLowerCase().replace(/[\s_-]+/g, '') === 'multilink';

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

export const inviteUsers = async (req, res) => {
    try {
        const { id } = req.params; 
        const { panelist_ids, email_template_id, project_url_id: bodyUrlId, partner_id } = req.body;

        if (!panelist_ids || !Array.isArray(panelist_ids) || panelist_ids.length === 0) {
            return res.status(400).json({ success: false, message: "panelist_ids array is required!" });
        }
        if (!email_template_id) {
            return res.status(400).json({ success: false, message: "email_template_id is required!" });
        }

        const [project, template, urls, panelistRows] = await Promise.all([
            Project.getById(id),
            EmailTemplate.getById(email_template_id),
            ProjectUrl.getByProjectId(id),
            Panelist.findByIds(panelist_ids)
        ]);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });
        if (!template) return res.status(404).json({ success: false, message: "Email template not found!" });

        let project_url_id = bodyUrlId || null;
        let selectedUrl = null;

        if (project_url_id) {
            selectedUrl = urls.find(u => Number(u.id) === Number(project_url_id)) || null;
            if (!selectedUrl) {
                return res.status(400).json({
                    success: false,
                    message: "No project_url_Info found for this project!"
                });
            }
        } else if (urls?.length) {
            selectedUrl = urls[0];
            project_url_id = selectedUrl.id;
        }

        const multiLink = isMultiLink(selectedUrl?.Project_Link_Type);

        let singleVenderUrl = null;
        if (!multiLink) {
            // Single link — direct shared vendor URL, no per-user assignment needed
            singleVenderUrl = await SupplierMapping.getVenderUrlByProjectId(id);
            if (!singleVenderUrl) {
                return res.status(400).json({
                    success: false,
                    message: "No active Vendor URL found in supplier_mapping for this project!"
                });
            }
        } else if (!project_url_id) {
            return res.status(400).json({
                success: false,
                message: "No project_url_Info found for this project!"
            });
        }

        const panelistById = new Map(panelistRows.map(p => [Number(p.id), p]));
        const skipped = [];
        const inviteRows = [];

        for (const panelistId of panelist_ids) {
            const panelist = panelistById.get(Number(panelistId));
            if (!panelist) continue;

            let survey_link;

            if (multiLink) {
                // Multi-link: only hand out a link if a free (unassigned) slot exists
                const slot = await ProjectMultipleUrl.getUnassignedSlot(id, project_url_id);
                if (!slot) {
                    skipped.push({ panelist_id: panelistId, reason: 'No survey available — all slots are already assigned' });
                    continue;
                }

                const assigned = await ProjectMultipleUrl.assignSlotToPartner(
                    slot.id,
                    partner_id || null,
                    panelist.email
                );
                if (!assigned) {
                    // Race condition — someone else grabbed this slot first
                    skipped.push({ panelist_id: panelistId, reason: 'Slot was just taken, please retry' });
                    continue;
                }

                survey_link = slot.VenderURL || slot.Live_Link;
            } else {
                // Single link — direct shared vendor URL
                survey_link = singleVenderUrl;
            }

            if (!survey_link) {
                skipped.push({ panelist_id: panelistId, reason: 'No survey link resolved' });
                continue;
            }

            const rendered = EmailTemplate.render(template, {
                user_name: panelist.name,
                survey_name: project.Project_Name,
                survey_url: survey_link
            });

            transporter.sendMail({
                to: panelist.email,
                subject: rendered.subject,
                html: rendered.body
            }).catch(err => console.error('Invite email failed:', err.message));

            inviteRows.push({
                project_id: id,
                panelist_id: panelistId,
                email_template_id,
                message: rendered.subject
            });
        }

        await ProjectInvitedUser.createMany(inviteRows);

        return res.status(200).json({
            success: true,
            message: `${inviteRows.length} user(s) invited successfully!`,
            skipped_count: skipped.length,
            skipped
        });
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