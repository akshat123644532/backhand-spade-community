import Project from '../models/projectModel.js';
import ProjectUrl from '../models/projectUrlModel.js';
import ProjectMultipleUrl from '../models/projectMultipleUrlModel.js';
import MultiLinkCsvJob from '../models/multiLinkCsvJobModel.js';
import { encodeSurveyToken } from '../utils/Encryptionhelper.js';

const BATCH_SIZE = 200;
const runningJobs = new Set();

/** Static uid placeholder — replaced with real respondent uid later */
const UID_PLACEHOLDER = 'XXXXXX';

/** VenderURL = CLIENT_BASE_URL/dosurvey/{token}?pid={project_url_code}&uid=XXXXXX */
const buildVenderUrl = ({ token, project_url_code }) => {
    const baseUrl = (process.env.CLIENT_BASE_URL || 'https://spade-community.com').replace(/\/$/, '');
    const params = new URLSearchParams();
    params.set('pid', String(project_url_code));
    params.set('uid', UID_PLACEHOLDER);
    return `${baseUrl}/dosurvey/${token}?${params.toString()}`;
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

const normalizeImportRows = (rows) =>
    rows.map((row) => ({
        Live_Link: String(row.Live_Link || '').trim() || null
    }));

const insertInBatches = async ({
    jobId,
    rows,
    project_id,
    project_url_id,
    partner_id,
    UserType,
    project_url_code,
    token
}) => {
    let processed = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE).map((row) => ({
            project_id,
            project_url_id,
            partner_id: partner_id || null,
            Live_Link: row.Live_Link || null,
            VenderURL: buildVenderUrl({ token, project_url_code }),
            Vender_UserName: null,
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

        const urlInfo = await ProjectUrl.getById(job.project_url_id);
        if (!urlInfo || Number(urlInfo.project_id) !== Number(job.project_id)) {
            throw new Error(`Project URL not found for job ${jobId}`);
        }
        if (!urlInfo.project_url_code) {
            throw new Error(`project_url_code missing for project_url_id ${job.project_url_id}`);
        }

        const rawRows = parsePayloadRows(job.payload);
        if (!rawRows.length) {
            throw new Error('Job payload is empty');
        }

        const rows = normalizeImportRows(rawRows);

        const token = encodeSurveyToken({
            partnerid: job.partner_id || null,
            projectUrlId: job.project_url_id,
            projectid: job.project_id,
        });

        const processed = await insertInBatches({
            jobId,
            rows,
            project_id: job.project_id,
            project_url_id: job.project_url_id,
            partner_id: job.partner_id,
            UserType: job.user_type,
            project_url_code: urlInfo.project_url_code,
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

/** Kick off background processing after the job row is committed. */
export const startMultiLinkCsvImport = (jobId) => {
    setImmediate(() => {
        processMultiLinkCsvJob(jobId).catch((err) => {
            console.error(`[MultiLinkCSV] Unhandled background error | jobId=${jobId} | error=${err.message}`);
        });
    });
};

/**
 * Persist job + optionally kick off background processing (non-blocking).
 * Pass `conn` to join an open transaction. Use `startProcessing: false` when
 * the caller will commit first, then call startMultiLinkCsvImport(jobId).
 */
export const enqueueMultiLinkCsvImport = async ({
    project_id,
    project_url_id,
    partner_id,
    user_type,
    rows,
    conn,
    startProcessing = true
}) => {
    const jobId = await MultiLinkCsvJob.create(
        {
            project_id,
            project_url_id,
            partner_id,
            user_type,
            rows
        },
        conn
    );

    if (startProcessing) {
        startMultiLinkCsvImport(jobId);
    }

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
    startMultiLinkCsvImport,
    processMultiLinkCsvJob,
    getImportJobStatus,
    getLatestImportJobStatus,
    resumePendingMultiLinkCsvJobs
};
