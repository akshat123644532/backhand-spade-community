import ProjectUrl from '../models/projectUrlModel.js';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

let intervalId = null;
let running = false;

export const runCloseExpiredProjectUrls = async () => {
    if (running) {
        console.log('[ProjectUrlCloseScheduler] Skipping run — previous job still in progress.');
        return;
    }

    running = true;
    try {
        const closedCount = await ProjectUrl.closeExpiredByEndDate();
        console.log(`[ProjectUrlCloseScheduler] Closed ${closedCount} expired project URL(s).`);
    } catch (error) {
        console.error(`[ProjectUrlCloseScheduler] Failed | error=${error.message}`);
    } finally {
        running = false;
    }
};

export const startProjectUrlCloseScheduler = () => {
    runCloseExpiredProjectUrls();

    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(runCloseExpiredProjectUrls, TWELVE_HOURS_MS);

    console.log('[ProjectUrlCloseScheduler] Started — runs on startup and every 12 hours.');
};

export default {
    runCloseExpiredProjectUrls,
    startProjectUrlCloseScheduler
};
