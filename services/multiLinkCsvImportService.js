import Project from '../models/projectModel.js';
import ProjectMultipleUrl from '../models/projectMultipleUrlModel.js';
import Panelist from '../models/Panelistmodel.js';
import MultiLinkCsvJob from '../models/multiLinkCsvJobModel.js';
import { encryptId } from '../utils/Encryptionhelper.js';

const BATCH_SIZE = 200;
const runningJobs = new Set();

const buildVenderUrl = ({ token, email }) => {
    const baseUrl = (process.env.CLIENT_BASE_URL || 'https://spade-community.com').replace(/\/$/, '');
    return `${baseUrl}/dosurvey/${token}?uid=${encodeURIComponent(email)}`;
};

const parsePayloadRows = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    try {
        const parsed = JSON.parse(payload);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const assignEmails = async (rows) => {
    const used = new Set();
    const missingIndexes = [];

    const normalized = rows.map((row, index) => {
        const liveLink = String(row.Live_Link || '').trim();
        const email = String(row.email || '').trim();
        if (email) {
            used.add(email.toLowerCase());
            return { Live_Link: liveLink, email };
        }
        missingIndexes.push(index);
        return { Live_Link: liveLink, email: null };
    });

    if (!missingIndexes.length) return normalized;

    const panelistEmails = await Panelist.getActiveEmails(missingIndexes.length, [...used]);
    if (panelistEmails.length < missingIndexes.length) {
        const err = new Error(
            `Not enough active panelists for rows without email. Needed ${missingIndexes.length}, available ${panelistEmails.length}.`
        );
        err.statusCode = 400;
        throw err;
    }

    missingIndexes.forEach((rowIndex, i) => {
        normalized[rowIndex].email = panelistEmails[i];
    });

    return normalized;
};

const insertInBatches = async ({
    jobId,
    rows,
    project_id,
    project_url_id,
    partner_id,
    UserType,
    token
}) => {
    let processed = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE).map((row) => ({
            project_id,
            project_url_id,
            partner_id: partner_id || null,
            Live_Link: row.Live_Link || null,
            VenderURL: buildVenderUrl({ token, email: row.email }),
            Vender_UserName: row.email,
            UserType: UserType || (partner_id ? 'PARTNER' : 'VENDOR'),
            Status: 'active'
        }));

        await ProjectMultipleUrl.bulkCreate(chunk);
        processed += chunk.length;
        await MultiLinkCsvJob.updateProgress(jobId, processed);
    }

    return processed;
};

export const getImportJobStatus = async (jobId) => {
    const job = await MultiLinkCsvJob.getById(jobId);
    if (!job) return null;

    const total = Number(job.total_rows || 0);
    const processed = Number(job.processed_rows || 0);
    const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

    return {
        jobId: job.id,
        project_id: job.project_id,
        project_url_id: job.project_url_id,
        status: job.status,
        total_rows: total,
        processed_rows: processed,
        percent,
        error_message: job.error_message || null,
        created_at: job.created_at,
        updated_at: job.updated_at,
        completed_at: job.completed_at || null
    };
};

export const getLatestImportJobStatus = async (project_id, project_url_id) => {
    const job = await MultiLinkCsvJob.getLatestByProjectUrl(project_id, project_url_id);
    if (!job) return null;
    return getImportJobStatus(job.id);
};

export const processMultiLinkCsvJob = async (jobId) => {
    if (runningJobs.has(jobId)) return;
    runningJobs.add(jobId);

    console.log(`[MultiLinkCSV] Process started | jobId=${jobId}`);

    try {
        const job = await MultiLinkCsvJob.getByIdWithPayload(jobId);
        if (!job) {
            throw new Error(`Job not found: ${jobId}`);
        }

        if (job.status === 'completed') {
            console.log(`[MultiLinkCSV] Process skipped (already completed) | jobId=${jobId}`);
            return;
        }

        await MultiLinkCsvJob.markProcessing(jobId);

        const project = await Project.getById(job.project_id);
        if (!project) {
            throw new Error(`Project not found for job ${jobId}`);
        }

        const rawRows = parsePayloadRows(job.payload);
        if (!rawRows.length) {
            throw new Error('Job payload is empty');
        }

        const rowsWithEmail = await assignEmails(rawRows);

        const tokenPayload = {
            partnerid: job.partner_id || null,
            projectUrlId: job.project_url_id,
            projectid: job.project_id,
            startDate: project.startDate || null,
            endDate: project.endDate || null
        };
        const token = encryptId(JSON.stringify(tokenPayload));

        const processed = await insertInBatches({
            jobId,
            rows: rowsWithEmail,
            project_id: job.project_id,
            project_url_id: job.project_url_id,
            partner_id: job.partner_id,
            UserType: job.user_type,
            token
        });

        await MultiLinkCsvJob.markCompleted(jobId, processed);
        console.log(`[MultiLinkCSV] Process completed successfully | jobId=${jobId} | rows=${processed}`);
    } catch (error) {
        console.error(`[MultiLinkCSV] Process failed | jobId=${jobId} | error=${error.message}`);
        try {
            await MultiLinkCsvJob.markFailed(jobId, error.message);
        } catch (markErr) {
            console.error(`[MultiLinkCSV] Failed to mark job as failed | jobId=${jobId} | error=${markErr.message}`);
        }
    } finally {
        runningJobs.delete(jobId);
    }
};

/**
 * Persist job + kick off background processing (non-blocking).
 * API callers should return immediately after this.
 */
export const enqueueMultiLinkCsvImport = async ({
    project_id,
    project_url_id,
    partner_id,
    user_type,
    rows
}) => {
    const jobId = await MultiLinkCsvJob.create({
        project_id,
        project_url_id,
        partner_id,
        user_type,
        rows
    });

    // Detach from request lifecycle
    setImmediate(() => {
        processMultiLinkCsvJob(jobId).catch((err) => {
            console.error(`[MultiLinkCSV] Unhandled background error | jobId=${jobId} | error=${err.message}`);
        });
    });

    return jobId;
};

/** Resume any jobs left pending after a process restart */
export const resumePendingMultiLinkCsvJobs = async () => {
    try {
        const pendingIds = await MultiLinkCsvJob.getPendingIds(10);
        if (!pendingIds.length) return;
        console.log(`[MultiLinkCSV] Resuming ${pendingIds.length} pending job(s)`);
        for (const jobId of pendingIds) {
            setImmediate(() => {
                processMultiLinkCsvJob(jobId).catch((err) => {
                    console.error(`[MultiLinkCSV] Resume failed | jobId=${jobId} | error=${err.message}`);
                });
            });
        }
    } catch (error) {
        console.error(`[MultiLinkCSV] Could not resume pending jobs | error=${error.message}`);
    }
};

export default {
    enqueueMultiLinkCsvImport,
    processMultiLinkCsvJob,
    getImportJobStatus,
    getLatestImportJobStatus,
    resumePendingMultiLinkCsvJobs
};
