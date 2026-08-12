import { db } from '../config/db.js';
import crypto from 'crypto';

let tableReady = false;

const ensureTable = async () => {
    if (tableReady) return;
    await db.execute(`
        CREATE TABLE IF NOT EXISTS multi_link_csv_jobs (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            project_id INT NOT NULL,
            project_url_id INT NOT NULL,
            partner_id INT NULL,
            user_type VARCHAR(32) NULL,
            status ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
            total_rows INT NOT NULL DEFAULT 0,
            processed_rows INT NOT NULL DEFAULT 0,
            error_message TEXT NULL,
            payload LONGTEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            completed_at DATETIME NULL,
            INDEX idx_project_url (project_id, project_url_id),
            INDEX idx_status (status)
        )
    `);
    tableReady = true;
};

const MultiLinkCsvJob = {
    create: async ({ project_id, project_url_id, partner_id, user_type, rows }) => {
        await ensureTable();
        const id = crypto.randomUUID();
        await db.execute(
            `INSERT INTO multi_link_csv_jobs
             (id, project_id, project_url_id, partner_id, user_type, status, total_rows, processed_rows, payload)
             VALUES (?, ?, ?, ?, ?, 'pending', ?, 0, ?)`,
            [
                id,
                project_id,
                project_url_id,
                partner_id || null,
                user_type || null,
                rows.length,
                JSON.stringify(rows)
            ]
        );
        return id;
    },

    getById: async (id) => {
        await ensureTable();
        const [rows] = await db.execute(
            `SELECT id, project_id, project_url_id, partner_id, user_type, status,
                    total_rows, processed_rows, error_message, created_at, updated_at, completed_at
             FROM multi_link_csv_jobs WHERE id = ?`,
            [id]
        );
        return rows[0] || null;
    },

    getByIdWithPayload: async (id) => {
        await ensureTable();
        const [rows] = await db.execute(
            `SELECT * FROM multi_link_csv_jobs WHERE id = ?`,
            [id]
        );
        return rows[0] || null;
    },

    getLatestByProjectUrl: async (project_id, project_url_id) => {
        await ensureTable();
        const [rows] = await db.execute(
            `SELECT id, project_id, project_url_id, partner_id, user_type, status,
                    total_rows, processed_rows, error_message, created_at, updated_at, completed_at
             FROM multi_link_csv_jobs
             WHERE project_id = ? AND project_url_id = ?
             ORDER BY created_at DESC
             LIMIT 1`,
            [project_id, project_url_id]
        );
        return rows[0] || null;
    },

    markProcessing: async (id) => {
        await db.execute(
            `UPDATE multi_link_csv_jobs
             SET status = 'processing', error_message = NULL, updated_at = NOW()
             WHERE id = ? AND status IN ('pending', 'processing')`,
            [id]
        );
    },

    updateProgress: async (id, processed_rows) => {
        await db.execute(
            `UPDATE multi_link_csv_jobs
             SET processed_rows = ?, updated_at = NOW()
             WHERE id = ?`,
            [processed_rows, id]
        );
    },

    markCompleted: async (id, processed_rows) => {
        await db.execute(
            `UPDATE multi_link_csv_jobs
             SET status = 'completed', processed_rows = ?, error_message = NULL,
                 completed_at = NOW(), updated_at = NOW(), payload = NULL
             WHERE id = ?`,
            [processed_rows, id]
        );
    },

    markFailed: async (id, error_message) => {
        await db.execute(
            `UPDATE multi_link_csv_jobs
             SET status = 'failed', error_message = ?, completed_at = NOW(), updated_at = NOW()
             WHERE id = ?`,
            [String(error_message || 'Unknown error').slice(0, 2000), id]
        );
    },

    getPendingIds: async (limit = 5) => {
        await ensureTable();
        const [rows] = await db.query(
            `SELECT id FROM multi_link_csv_jobs
             WHERE status = 'pending'
             ORDER BY created_at ASC
             LIMIT ?`,
            [Number(limit)]
        );
        return rows.map((r) => r.id);
    }
};

export default MultiLinkCsvJob;
