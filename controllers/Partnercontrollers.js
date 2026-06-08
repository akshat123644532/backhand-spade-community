import Partner from '../models/partnerModel.js';


export const addPartner = async (req, res) => {
    try {
        const {
            name, email, contact_no, country, contact_person,
            website_url, panel_size, complete, terminate,
            over_quota, quality_term, survey_close, about_partner,
            code, status
        } = req.body;

   
        if (!name || !email) {
            return res.status(400).json({ success: false, message: "Name and email are required!" });
        }

        if (!code) {
            return res.status(400).json({ success: false, message: "Partner code is required!" });
        }

       
        const emailExists = await Partner.findByEmail(email);
        if (emailExists) {
            return res.status(400).json({ success: false, message: "Email already registered!" });
        }

       
        const codeExists = await Partner.findByCode(code);
        if (codeExists) {
            return res.status(400).json({ success: false, message: "Partner code already exists!" });
        }

        await Partner.create({
            name, email, contact_no, country, contact_person,
            website_url, panel_size, complete, terminate,
            over_quota, quality_term, survey_close, about_partner,
            code, status
        });

        return res.status(201).json({
            success: true,
            message: "Partner added successfully!",
            data: { name, email, code }
        });

    } catch (error) {
        console.error("ADD PARTNER ERROR:", error);
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// ─────────────────────────────────────────────
// GET ALL PARTNERS (list)
// GET /api/partner/list
// ─────────────────────────────────────────────
export const getAllPartners = async (req, res) => {
    try {
        const partners = await Partner.getAll();

        return res.status(200).json({
            success: true,
            count: partners.length,
            data: partners 
        });

    } catch (error) {
        console.error("GET PARTNERS ERROR:", error);
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};


export const getPartnerById = async (req, res) => {
    try {
        const { id } = req.params;
        const partner = await Partner.getById(id);

        if (!partner) {
            return res.status(404).json({ success: false, message: "Partner not found!" });
        }

        return res.status(200).json({ success: true, data: partner });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};


export const updatePartner = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, email, contact_no, country, contact_person,
            website_url, panel_size, complete, terminate,
            over_quota, quality_term, survey_close, about_partner, status
        } = req.body;

        const partner = await Partner.getById(id);
        if (!partner) {
            return res.status(404).json({ success: false, message: "Partner not found!" });
        }

        
        if (email && email !== partner.email) {
            const emailExists = await Partner.findByEmail(email);
            if (emailExists) {
                return res.status(400).json({ success: false, message: "Email already in use!" });
            }
        }

        const updateData = {
            name, email, contact_no, country, contact_person,
            website_url, panel_size, complete, terminate,
            over_quota, quality_term, survey_close, about_partner, status
        };

       
        Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

        await Partner.update(id, updateData);

        return res.status(200).json({ success: true, message: "Partner updated successfully!" });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// ─────────────────────────────────────────────
// DELETE PARTNER
// DELETE /api/partner/:id
// ─────────────────────────────────────────────
export const deletePartner = async (req, res) => {
    try {
        const { id } = req.params;

        const partner = await Partner.getById(id);
        if (!partner) {
            return res.status(404).json({ success: false, message: "Partner not found!" });
        }

        await Partner.delete(id);

        return res.status(200).json({ success: true, message: "Partner deleted successfully!" });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};