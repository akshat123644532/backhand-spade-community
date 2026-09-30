import { db } from '../config/db.js';

const EmailCampaign = {

    create: async ({
        campaignName,
        mailingListKey,
        subject,
        fromEmail,
        totalRecipients,
        conn = db
    }) => {

        const [result] = await conn.execute(
            `INSERT INTO email_campaigns
            (
                campaign_name,
                mailing_list_key,
                subject,
                from_email,
                total_recipients,
                status
            )
            VALUES (?, ?, ?, ?, ?, 'PENDING')`,
            [
                campaignName,
                mailingListKey,
                subject,
                fromEmail,
                totalRecipients
            ]
        );

        return result.insertId;
    },

    updateZohoDetails: async ({
        id,
        zohoCampaignId,
        zohoCampaignKey,
        conn = db
    }) => {

        await conn.execute(
            `UPDATE email_campaigns
             SET
                zoho_campaign_id = ?,
                zoho_campaign_key = ?
             WHERE id = ?`,
            [
                zohoCampaignId,
                zohoCampaignKey,
                id
            ]
        );
    },

    updateStatus: async ({
        id,
        status,
        sentAt = null,
        conn = db
    }) => {

        await conn.execute(
            `UPDATE email_campaigns
             SET
                status = ?,
                sent_at = COALESCE(?, sent_at)
             WHERE id = ?`,
            [
                status,
                sentAt,
                id
            ]
        );
    },

    getById: async (id, conn = db) => {

        const [rows] = await conn.execute(
            `SELECT *
             FROM email_campaigns
             WHERE id = ?`,
            [id]
        );

        return rows[0] || null;
    },

    getByZohoCampaignKey: async (
        zohoCampaignKey,
        conn = db
    ) => {

        const [rows] = await conn.execute(
            `SELECT *
             FROM email_campaigns
             WHERE zoho_campaign_key = ?`,
            [zohoCampaignKey]
        );

        return rows[0] || null;
    }

};

export default EmailCampaign;