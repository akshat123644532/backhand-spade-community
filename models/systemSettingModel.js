import { db } from '../config/db.js';

const SurveySetting = {
    getAll: async ({ page = 1, limit = 10, search = '' }) => {
        try {
            const offset = (page - 1) * limit;
            
            let query = 'SELECT * FROM survey_settings';
            let countQuery = 'SELECT COUNT(*) as total FROM survey_settings';
            let params = [];

            if (search && search.trim() !== '') {
                query += ' WHERE language LIKE ?';
                countQuery += ' WHERE language LIKE ?';
                params.push(`%${search}%`);
            }

            query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const [rows] = await db.execute(query, params);

            const countParams = search ? [`%${search}%`] : [];
            const [countResult] = await db.execute(countQuery, countParams);

            return {
                data: rows,
                total: countResult[0].total,
                page,
                limit,
                pages: Math.ceil(countResult[0].total / limit)
            };
        } catch (error) {
            throw new Error(`Error in getAll: ${error.message}`);
        }
    },

    getById: async (id) => {
        try {
            const parsedId = parseInt(id);
            if (isNaN(parsedId)) {
                throw new Error('Invalid ID format');
            }

            const [rows] = await db.execute(
                'SELECT * FROM survey_settings WHERE id = ?',
                [parsedId]
            );

            return rows[0] || null;
        } catch (error) {
            throw new Error(`Error in getById: ${error.message}`);
        }
    },

    getByLanguage: async (language) => {
        try {
            if (!language || language.trim() === '') {
                throw new Error('Language is required');
            }

            const [rows] = await db.execute(
                'SELECT * FROM survey_settings WHERE language = ?',
                [language.trim()]
            );

            return rows[0] || null;
        } catch (error) {
            throw new Error(`Error in getByLanguage: ${error.message}`);
        }
    },

    create: async (data) => {
        try {
            const {
                language,
                complete_redirect_content,
                terminate_redirect_content,
                quality_term_redirect_content,
                survey_close_redirect_content
            } = data;

            if (!language || language.trim() === '') {
                throw new Error('Language is required');
            }

            const [result] = await db.execute(
                `INSERT INTO survey_settings 
                (language, complete_redirect_content, terminate_redirect_content, quality_term_redirect_content, survey_close_redirect_content) 
                VALUES (?, ?, ?, ?, ?)`,
                [
                    language.trim(),
                    complete_redirect_content || null,
                    terminate_redirect_content || null,
                    quality_term_redirect_content || null,
                    survey_close_redirect_content || null
                ]
            );

            return result.insertId;
        } catch (error) {
            throw new Error(`Error in create: ${error.message}`);
        }
    },

    update: async (id, data) => {
        try {
            const parsedId = parseInt(id);
            if (isNaN(parsedId)) {
                throw new Error('Invalid ID format');
            }

            const allowedFields = [
                'complete_redirect_content',
                'terminate_redirect_content',
                'quality_term_redirect_content',
                'survey_close_redirect_content'
            ];

            const updateData = {};
            for (const key of allowedFields) {
                if (data[key] !== undefined && data[key] !== null) {
                    updateData[key] = data[key];
                }
            }

            if (Object.keys(updateData).length === 0) {
                throw new Error('No valid fields to update');
            }

            const fields = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
            const values = [...Object.values(updateData), parsedId];

            const [result] = await db.execute(
                `UPDATE survey_settings SET ${fields} WHERE id = ?`,
                values
            );

            if (result.affectedRows === 0) {
                throw new Error('Record not found or no changes made');
            }

            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error in update: ${error.message}`);
        }
    },

    delete: async (id) => {
        try {
            const parsedId = parseInt(id);
            if (isNaN(parsedId)) {
                throw new Error('Invalid ID format');
            }

            const [result] = await db.execute(
                'DELETE FROM survey_settings WHERE id = ?',
                [parsedId]
            );

            if (result.affectedRows === 0) {
                throw new Error('Record not found');
            }

            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error in delete: ${error.message}`);
        }
    }
};

export default SurveySetting;