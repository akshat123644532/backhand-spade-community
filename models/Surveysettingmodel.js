import { db } from '../config/db.js';

const SurveySetting = {

    // Get all survey settings
    getAll: async ({ page = 1, limit = 10, search = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE deleted_at IS NULL`;
        const params = [];

        if (search) {
            where += ` AND language LIKE ?`;
            params.push(`%${search}%`);
        }

        const [rows] = await db.query(
            `SELECT id, language, created_at AS createdAt, updated_at AS updatedAt
             FROM survey_settings ${where}
             ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM survey_settings ${where}`, params
        );
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    // Get by ID
    getById: async (id) => {
        try {
            const [rows] = await db.execute(
                `SELECT id, language, complete_redirect_content, terminate_redirect_content, 
                        quality_term_redirect_content, survey_close_redirect_content, 
                        created_at AS createdAt, updated_at AS updatedAt
                 FROM survey_settings WHERE id = ? AND deleted_at IS NULL`,
                [id]
            );
            return rows[0] || null;
        } catch (error) {
            console.error('SurveySetting GET BY ID error:', error);
            throw error;
        }
    },

    // Get by Language
    getByLanguage: async (language) => {
        try {
            const [rows] = await db.execute(
                `SELECT id, language, complete_redirect_content, terminate_redirect_content, 
                        quality_term_redirect_content, survey_close_redirect_content, 
                        created_at AS createdAt, updated_at AS updatedAt
                 FROM survey_settings WHERE language = ? AND deleted_at IS NULL`,
                [language]
            );
            return rows[0] || null;
        } catch (error) {
            console.error('SurveySetting GET BY LANGUAGE error:', error);
            throw error;
        }
    },

    // Create new survey setting
    create: async (data) => {
        try {
            const {
                language,
                complete_redirect_content,
                terminate_redirect_content,
                quality_term_redirect_content,
                survey_close_redirect_content
            } = data;

            const [result] = await db.execute(
                `INSERT INTO survey_settings 
                (language, complete_redirect_content, terminate_redirect_content, 
                 quality_term_redirect_content, survey_close_redirect_content)
                VALUES (?, ?, ?, ?, ?)`,
                [
                    language,
                    complete_redirect_content || null,
                    terminate_redirect_content || null,
                    quality_term_redirect_content || null,
                    survey_close_redirect_content || null
                ]
            );

            return result.insertId;
        } catch (error) {
            console.error('SurveySetting CREATE error:', error);
            throw error;
        }
    },

    // Update survey setting
    update: async (id, data) => {
        try {
            const fields = [];
            const values = [];

            if (data.complete_redirect_content !== undefined) {
                fields.push('complete_redirect_content = ?');
                values.push(data.complete_redirect_content);
            }
            if (data.terminate_redirect_content !== undefined) {
                fields.push('terminate_redirect_content = ?');
                values.push(data.terminate_redirect_content);
            }
            if (data.quality_term_redirect_content !== undefined) {
                fields.push('quality_term_redirect_content = ?');
                values.push(data.quality_term_redirect_content);
            }
            if (data.survey_close_redirect_content !== undefined) {
                fields.push('survey_close_redirect_content = ?');
                values.push(data.survey_close_redirect_content);
            }

            if (fields.length === 0) {
                return null; // Nothing to update
            }

            values.push(id);

            const [result] = await db.execute(
                `UPDATE survey_settings SET ${fields.join(', ')}, updated_at = NOW() 
                 WHERE id = ? AND deleted_at IS NULL`,
                values
            );

            return result;
        } catch (error) {
            console.error('SurveySetting UPDATE error:', error);
            throw error;
        }
    },

    // Delete (soft delete)
    delete: async (id) => {
        try {
            const [result] = await db.execute(
                `UPDATE survey_settings SET deleted_at = NOW() 
                 WHERE id = ? AND deleted_at IS NULL`,
                [id]
            );
            return result;
        } catch (error) {
            console.error('SurveySetting DELETE error:', error);
            throw error;
        }
    }
};

export default SurveySetting;