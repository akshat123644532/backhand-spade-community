// models/ipDetectionModel.js
import { db } from '../config/db.js';

const TABLE = 'ip_detection';

const IpDetection = {
    /**
 
     * @param {number} surveyDataId - 
     * @param {object} result - 
     */
    insert: async (surveyDataId, result) => {
        const [res] = await db.execute(
            `INSERT INTO \`${TABLE}\`
             (survey_data_id, ip_address,
              scamalytics_score, scamalytics_risk, scamalytics_url,
              scamalytics_isp, scamalytics_org, scamalytics_isp_score, scamalytics_isp_risk,
              is_datacenter, is_vpn, is_resproxy, is_apple_icloud_private_relay,
              is_amazon_aws, is_google, is_blacklisted_external,
              ip_country_code, ip_country_name, ip_state_name, ip_city, ip_time_zone,
              raw_response, status, error_message, credits_remaining)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                surveyDataId,
                result.ip ?? null,
                result.scamalytics_score ?? null,
                result.scamalytics_risk ?? null,
                result.scamalytics_url ?? null,
                result.scamalytics_isp ?? null,
                result.scamalytics_org ?? null,
                result.scamalytics_isp_score ?? null,
                result.scamalytics_isp_risk ?? null,
                result.is_datacenter ?? null,
                result.is_vpn ?? null,
                result.is_resproxy ?? null,
                result.is_apple_icloud_private_relay ?? null,
                result.is_amazon_aws ?? null,
                result.is_google ?? null,
                result.is_blacklisted_external ?? null,
                result.ip_country_code ?? null,
                result.ip_country_name ?? null,
                result.ip_state_name ?? null,
                result.ip_city ?? null,
                result.ip_time_zone ?? null,
                JSON.stringify(result.raw_response ?? {}),
                result.status ?? 'error',
                result.error_message ?? null,
                result.credits_remaining ?? null
            ]
        );
        return res.insertId;
    },

    getBySurveyDataId: async (surveyDataId) => {
        const [rows] = await db.execute(
            `SELECT * FROM \`${TABLE}\` WHERE survey_data_id = ? ORDER BY id DESC LIMIT 1`,
            [surveyDataId]
        );
        return rows[0] || null;
    },

    getByIp: async (ip) => {
        const [rows] = await db.execute(
            `SELECT * FROM \`${TABLE}\` WHERE ip_address = ? ORDER BY id DESC LIMIT 20`,
            [ip]
        );
        return rows;
    }
};

export default IpDetection;