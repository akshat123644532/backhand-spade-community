import { db } from '../config/db.js';

const EmailCampaignRecipient = {

    create: async ({
        campaignId,
        userId,
        email,
        name,
        specificSurveyLink,
        zohoContactId = null,
        conn = db
    }) => {

        const [result] = await conn.execute(
            `INSERT INTO email_campaign_recipients
            (
                campaign_id,
                user_id,
                email,
                name,
                specific_survey_link,
                zoho_contact_id,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
            [
                campaignId,
                userId,
                email,
                name,
                specificSurveyLink,
                zohoContactId
            ]
        );

        return result.insertId;
    },

    createMany: async (recipients, conn = db) => {

        if (!recipients || recipients.length === 0) {
            return 0;
        }

        const values = [];

        for (const recipient of recipients) {

            values.push(
                recipient.campaignId,
                recipient.userId,
                recipient.email,
                recipient.name,
                recipient.specificSurveyLink,
                recipient.zohoContactId || null
            );
        }

        const placeholders = recipients
            .map(() => '(?, ?, ?, ?, ?, ?, "PENDING")')
            .join(', ');

        const [result] = await conn.execute(
            `INSERT INTO email_campaign_recipients
            (
                campaign_id,
                user_id,
                email,
                name,
                specific_survey_link,
                zoho_contact_id,
                status
            )
            VALUES ${placeholders}`,
            values
        );

        return result.affectedRows;
    },

    updateZohoContactId: async ({
        id,
        zohoContactId,
        conn = db
    }) => {

        await conn.execute(
            `UPDATE email_campaign_recipients
             SET zoho_contact_id = ?
             WHERE id = ?`,
            [
                zohoContactId,
                id
            ]
        );
    },

    getByCampaignId: async (
        campaignId,
        conn = db
    ) => {

        const [rows] = await conn.execute(
            `SELECT *
             FROM email_campaign_recipients
             WHERE campaign_id = ?
             ORDER BY id ASC`,
            [campaignId]
        );

        return rows;
    }

};

export default EmailCampaignRecipient;