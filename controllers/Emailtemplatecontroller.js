import EmailTemplate from '../models/Emailtemplatemodel.js';

export const addEmailTemplate = async (req, res) => {
    try {
        const { template_key, slug, title, description, subject, body, status } = req.body;

        if (!template_key || !title || !subject || !body) {
            return res.status(400).json({ success: false, message: "template_key, title, subject and body are required!" });
        }

        const id = await EmailTemplate.create({ template_key, slug, title, description, subject, body, status });

        return res.status(201).json({ success: true, message: "Email template added successfully!", data: { id, template_key } });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: "template_key or slug already exists!" });
        }
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllEmailTemplates = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const status = req.query.status || '';

        const result = await EmailTemplate.getAll({ page, limit, search, status });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getEmailTemplateById = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await EmailTemplate.getById(id);
        if (!template) return res.status(404).json({ success: false, message: "Email template not found!" });
        return res.status(200).json({ success: true, data: template });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getEmailTemplateByKey = async (req, res) => {
    try {
        const { key } = req.params;
        const template = await EmailTemplate.getByKey(key);
        if (!template) return res.status(404).json({ success: false, message: "Email template not found!" });
        return res.status(200).json({ success: true, data: template });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateEmailTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { slug, title, description, subject, body, status } = req.body;

        const template = await EmailTemplate.getById(id);
        if (!template) return res.status(404).json({ success: false, message: "Email template not found!" });

        const updateData = {};
        if (slug) updateData.slug = slug;
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (subject) updateData.subject = subject;
        if (body) updateData.body = body;
        if (status) updateData.status = status;

        if (Object.keys(updateData).length > 0) await EmailTemplate.update(id, updateData);

        return res.status(200).json({ success: true, message: "Email template updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteEmailTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await EmailTemplate.getById(id);
        if (!template) return res.status(404).json({ success: false, message: "Email template not found!" });
        await EmailTemplate.delete(id);
        return res.status(200).json({ success: true, message: "Email template deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// Preview: pass sample data via query/body -> get back the rendered subject+body (placeholders replaced)
export const previewEmailTemplate = async (req, res) => {
    try {
        const { key } = req.params;
        const template = await EmailTemplate.getByKey(key);
        if (!template) return res.status(404).json({ success: false, message: "Email template not found!" });

        const rendered = EmailTemplate.render(template, req.body || {});
        return res.status(200).json({ success: true, data: rendered });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};