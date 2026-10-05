import { db } from '../config/db.js';

const TABLE = 'panelist_signup_details';

const PanelistSignupDetails = {
    create: async (data) => {
        const [result] = await db.execute(
            `INSERT INTO \`${TABLE}\` (
                panelist_id,
                ip_address,
                user_agent,
                browser,
                browser_version,
                os,
                os_version,
                device_type,
                device_name,
                fraud_score,
                fraud_risk,
                vpn,
                tor,
                proxy,
                datacenter,
                country,
                country_code,
                state,
                city,
                postal_code,
                latitude,
                longitude,
                asn,
                isp_name,
                organization_name
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.panelist_id,
                data.ip_address ?? null,
                data.user_agent ?? null,
                data.browser ?? null,
                data.browser_version ?? null,
                data.os ?? null,
                data.os_version ?? null,
                data.device_type ?? null,
                data.device_name ?? null,
                data.fraud_score ?? null,
                data.fraud_risk ?? null,
                data.vpn ? 1 : 0,
                data.tor ? 1 : 0,
                data.proxy ? 1 : 0,
                data.datacenter ? 1 : 0,
                data.country ?? null,
                data.country_code ?? null,
                data.state ?? null,
                data.city ?? null,
                data.postal_code ?? null,
                data.latitude ?? null,
                data.longitude ?? null,
                data.asn ?? null,
                data.isp_name ?? null,
                data.organization_name ?? null
            ]
        );

        return result.insertId;
    },

    getByPanelistId: async (panelistId) => {
        const [rows] = await db.execute(
            `SELECT *
             FROM \`${TABLE}\`
             WHERE panelist_id = ?
             ORDER BY created_at DESC`,
            [panelistId]
        );

        return rows;
    }
};

export default PanelistSignupDetails;