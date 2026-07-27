import { db } from '../config/db.js';

const toPositiveIntIds = (ids) => {
    const parsed = ids.map((id) => Number(id));
    if (parsed.some((id) => !Number.isInteger(id) || id <= 0)) {
        throw new Error('All IDs must be positive integers');
    }
    return parsed;
};

const PanelQuestionnaire = {

    create: async (data) => {
        const { language, question_title, question_text, question_type, options, is_required, status } = data;

        const [rows] = await db.execute(
            `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
             FROM panel_questionnaire WHERE deleted_at IS NULL`
        );
        const sort_order = rows[0].next_order;

        const [result] = await db.execute(
            `INSERT INTO panel_questionnaire
             (language, question_title, question_text, question_type, options, is_required, sort_order, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                language,
                question_title,
                question_text,
                question_type || 'textbox',
                JSON.stringify(options || []),
                is_required || 0,
                sort_order,
                status || 'active'
            ]
        );
        return { id: result.insertId, sort_order };
    },

    getAll: async ({ page = 1, limit = 15, search = '', status = '', language = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 15;
        const offset = (p - 1) * l;
        let where = `WHERE deleted_at IS NULL`;
        const params = [];

        if (search) {
            where += ` AND question_title LIKE ?`;
            params.push(`%${search}%`);
        }
        if (status) {
            where += ` AND status = ?`;
            params.push(status);
        }
        if (language) {
            where += ` AND language = ?`;
            params.push(language);
        }

        const [rows] = await db.query(
            `SELECT id, language, question_title, question_text, question_type, options, is_required, sort_order, status
             FROM panel_questionnaire ${where}
             ORDER BY sort_order ASC, id ASC
             LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM panel_questionnaire ${where}`, params
        );
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM panel_questionnaire WHERE id = ? AND deleted_at IS NULL`, [id]
        );
        return rows[0] || null;
    },

    getByTitle: async (question_title) => {
        const [rows] = await db.execute(
            `SELECT id, language, question_title, question_text, question_type, options, is_required, sort_order, status, created_at
             FROM panel_questionnaire WHERE question_title = ? AND deleted_at IS NULL
             ORDER BY sort_order ASC, id ASC`,
            [question_title]
        );
        if (!rows.length) return null;

        return { question_title, language: rows[0].language, questions: rows };
    },

    getByLanguage: async (language) => {
        const [rows] = await db.execute(
            `SELECT id, question_title, question_text, options, sort_order
             FROM panel_questionnaire
             WHERE language = ? AND deleted_at IS NULL AND status = 'active'
             ORDER BY sort_order ASC, id ASC`,
            [language]
        );

        const grouped = {};
        for (const row of rows) {
            const key = row.question_title;
            if (!grouped[key]) {
                grouped[key] = {
                    question_title: key,
                    questions: []
                };
            }
            grouped[key].questions.push({
                id: row.id,
                question_text: row.question_text,
                options: row.options,
                sort_order: row.sort_order
            });
        }

        return Object.values(grouped);
    },

    update: async (id, data) => {
        const fields = [];
        const values = [];

        for (const key of Object.keys(data)) {
            if (key === 'options') {
                fields.push('options = ?');
                values.push(JSON.stringify(data.options || []));
            } else {
                fields.push(`${key} = ?`);
                values.push(data[key]);
            }
        }

        values.push(id);
        const [result] = await db.execute(
            `UPDATE panel_questionnaire SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
            values
        );
        return result;
    },

    toggleStatus: async (id, status) => {
        const [result] = await db.execute(
            `UPDATE panel_questionnaire SET status = ?, updated_at = NOW() WHERE id = ?`,
            [status, id]
        );
        return result;
    },

    // Renumber all active questions to contiguous 1..n (keeps current relative order)
    compactSortOrders: async (connection = db) => {
        const [rows] = await connection.query(
            `SELECT id FROM panel_questionnaire
             WHERE deleted_at IS NULL
             ORDER BY sort_order ASC, id ASC`
        );
        if (!rows.length) return [];

        const ids = rows.map((r) => r.id);
        const caseSql = ids.map((id, index) => `WHEN ${id} THEN ${index + 1}`).join(' ');

        await connection.query(
            `UPDATE panel_questionnaire
             SET sort_order = CASE id ${caseSql} END, updated_at = NOW()
             WHERE id IN (${ids.join(',')})`
        );

        return ids.map((id, index) => ({ id, sort_order: index + 1 }));
    },

    // Reorder questions and persist unique contiguous ranks (1..n)
    // - ordered_ids: array order becomes the new sequence (full list) or relative order in existing slots (partial)
    // - items: each id is moved to the given sort_order rank; others shift around them
    updateSortOrder: async ({ ordered_ids, items } = {}) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [allRows] = await connection.query(
                `SELECT id FROM panel_questionnaire
                 WHERE deleted_at IS NULL
                 ORDER BY sort_order ASC, id ASC`
            );
            const currentIds = allRows.map((row) => row.id);

            let finalOrder;

            if (Array.isArray(items) && items.length > 0) {
                const normalized = items.map((item) => ({
                    id: Number(item.id),
                    sort_order: Number(item.sort_order)
                }));

                if (normalized.some((item) => !Number.isInteger(item.id) || item.id <= 0)) {
                    throw new Error('All IDs must be positive integers');
                }
                if (normalized.some((item) => !Number.isInteger(item.sort_order) || item.sort_order <= 0)) {
                    throw new Error('sort_order must be a positive integer');
                }
                if (new Set(normalized.map((item) => item.id)).size !== normalized.length) {
                    throw new Error('Duplicate question IDs in sort payload');
                }

                const movingIds = normalized.map((item) => item.id);
                const placeholders = movingIds.map(() => '?').join(',');
                const [existing] = await connection.execute(
                    `SELECT id FROM panel_questionnaire
                     WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
                    movingIds
                );
                if (existing.length !== movingIds.length) {
                    throw new Error('One or more questions not found');
                }

                const movingSet = new Set(movingIds);
                finalOrder = currentIds.filter((id) => !movingSet.has(id));

                const sortedItems = [...normalized].sort((a, b) => a.sort_order - b.sort_order);
                for (const item of sortedItems) {
                    const pos = Math.max(0, Math.min(finalOrder.length, item.sort_order - 1));
                    finalOrder.splice(pos, 0, item.id);
                }
            } else if (Array.isArray(ordered_ids) && ordered_ids.length > 0) {
                const orderedIds = toPositiveIntIds(ordered_ids);
                if (new Set(orderedIds).size !== orderedIds.length) {
                    throw new Error('Duplicate question IDs in sort payload');
                }

                const placeholders = orderedIds.map(() => '?').join(',');
                const [existing] = await connection.execute(
                    `SELECT id FROM panel_questionnaire
                     WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
                    orderedIds
                );
                if (existing.length !== orderedIds.length) {
                    throw new Error('One or more questions not found');
                }

                if (orderedIds.length === currentIds.length) {
                    finalOrder = orderedIds;
                } else {
                    const orderedSet = new Set(orderedIds);
                    const slotIndexes = [];
                    currentIds.forEach((id, index) => {
                        if (orderedSet.has(id)) slotIndexes.push(index);
                    });
                    finalOrder = [...currentIds];
                    slotIndexes.forEach((slotIndex, i) => {
                        finalOrder[slotIndex] = orderedIds[i];
                    });
                }
            } else {
                throw new Error('Provide ordered_ids or items with id and sort_order');
            }

            const caseSql = finalOrder
                .map((id, index) => `WHEN ${id} THEN ${index + 1}`)
                .join(' ');

            await connection.query(
                `UPDATE panel_questionnaire
                 SET sort_order = CASE id ${caseSql} END, updated_at = NOW()
                 WHERE id IN (${finalOrder.join(',')})`
            );

            const ranks = finalOrder.map((id, index) => ({ id, sort_order: index + 1 }));
            await connection.commit();
            return ranks;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },

    delete: async (id) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.execute(
                `UPDATE panel_questionnaire SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
                [id]
            );

            if (result.affectedRows === 0) {
                throw new Error('Question not found');
            }

            const ranks = await PanelQuestionnaire.compactSortOrders(connection);
            await connection.commit();
            return ranks;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
};

export default PanelQuestionnaire;
