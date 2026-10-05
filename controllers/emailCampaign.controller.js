import EmailCampaign from '../models/emailCampaign.model.js';

import {
    verifyCampaignContentToken
} from '../utils/zohoCampaignContent.util.js';
import EmailCampaignService
    from '../services/emailCampaign.service.js';

export const getCampaignContent = async (
    req,
    res
) => {

    try {

        const { campaignId } = req.params;
        const { token } = req.query;


        /*
         * -----------------------------------------------------
         * Validate campaign ID
         * -----------------------------------------------------
         */

        if (!campaignId) {

            return res
                .status(400)
                .send('Campaign ID is required.');
        }


        /*
         * -----------------------------------------------------
         * Verify signed token
         * -----------------------------------------------------
         */

        const isValidToken =
            verifyCampaignContentToken(
                campaignId,
                token
            );


        if (!isValidToken) {

            return res
                .status(403)
                .send('Invalid content token.');
        }


        /*
         * -----------------------------------------------------
         * Check local campaign
         * -----------------------------------------------------
         */

        const campaign =
            await EmailCampaign.getById(
                campaignId
            );


        if (!campaign) {

            return res
                .status(404)
                .send('Campaign not found.');
        }


        /*
         * -----------------------------------------------------
         * Return HTML with campaign-level values filled in.
         * $[UD:FNAME]$ and $[UD:SPECIFIC_SURVEY_LINK]$ stay
         * for Zoho to resolve per recipient.
         * -----------------------------------------------------
         */

        const html =
            await EmailCampaignService.getRenderedCampaignHtml(
                campaignId
            );

        res.setHeader(
            'Content-Type',
            'text/html; charset=utf-8'
        );

        res.setHeader(
            'Cache-Control',
            'no-store'
        );

        return res
            .status(200)
            .send(html);

    } catch (error) {

        console.error(
            'Get campaign content error:',
            error
        );

        return res
            .status(500)
            .send(
                error.message ||
                'Unable to load campaign content.'
            );
    }
};
export const testCampaign = async (req, res) => {

    try {

        const {
            projectId,
            panelistIds,
            projectUrlId
        } = req.body;


        if (!projectId) {
            return res.status(400).json({
                success: false,
                message: 'projectId is required.'
            });
        }


        if (
            !panelistIds ||
            !Array.isArray(panelistIds) ||
            panelistIds.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'panelistIds must be a non-empty array.'
            });
        }


        const result =
            await EmailCampaignService.createCampaign({

                projectId,

                panelistIds,

                projectUrlId:
                    projectUrlId || null

            });


        return res.status(200).json(result);

    } catch (error) {

        console.error(
            'Test campaign error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error.message

        });
    }
};