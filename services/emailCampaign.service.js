import EmailTemplate from '../models/Emailtemplatemodel.js';
import EmailCampaign from '../models/emailCampaign.model.js';
import EmailCampaignRecipient from '../models/emailCampaignRecipient.model.js';

import Project from '../models/projectModel.js';
import ProjectUrl from '../models/projectUrlModel.js';
import ProjectMultipleUrl from '../models/projectMultipleUrlModel.js';
import SupplierMapping from '../models/supplierMappingModel.js';
import Panelist from '../models/Panelistmodel.js';
import { runWithConcurrency } from '../utils/concurrency.js';
import ZohoCampaignService from './zohoCampaign.service.js';
import { generateCampaignContentToken } from '../utils/zohoCampaignContent.util.js';
import {
    isMultiLink,
    buildUidForPanelist,
    applyEncryptedUidToLink
} from '../controllers/findUserController.js';

const APP_PUBLIC_URL =
    process.env.APP_PUBLIC_URL;

const ZOHO_MAILING_LIST_KEY =
    process.env.ZOHO_MAILING_LIST_KEY;

const ZOHO_FROM_EMAIL =
    process.env.ZOHO_FROM_EMAIL;

const ZOHO_TOPIC_ID =
    process.env.ZOHO_TOPIC_ID;

const ZOHO_CONTACT_CONCURRENCY = Number(
    process.env.ZOHO_CONTACT_CONCURRENCY || 10
    );

const EmailCampaignService = {

    createCampaign: async ({
        projectId,
        panelistIds,
        projectUrlId = null
    }) => {
        // console.log('projectId', projectId);
        // console.log('panelistIds', panelistIds);
        // console.log('projectUrlId', projectUrlId);
        /*
         * ---------------------------------------------------------
         * 1. Validate basic configuration
         * ---------------------------------------------------------
         */

        if (!ZOHO_MAILING_LIST_KEY) {
            throw new Error(
                'ZOHO_MAILING_LIST_KEY is not configured.'
            );
        }

        if (!ZOHO_FROM_EMAIL) {
            throw new Error(
                'ZOHO_FROM_EMAIL is not configured.'
            );
        }

        if (
            !panelistIds ||
            !Array.isArray(panelistIds) ||
            panelistIds.length === 0
        ) {
            throw new Error(
                'panelistIds must be a non-empty array.'
            );
        }


        /*
         * ---------------------------------------------------------
         * 2. Load project, template, URLs and panelists
         * ---------------------------------------------------------
         */

        const [
            project,
            template,
            urls,
            panelistRows
        ] = await Promise.all([

            Project.getById(projectId),

            EmailTemplate.getByKey(
                'panelist-survey-campaign'
            ),

            ProjectUrl.getByProjectId(projectId),

            Panelist.findByIds(panelistIds)

        ]);


        /*
         * ---------------------------------------------------------
         * 3. Validate project
         * ---------------------------------------------------------
         */

        if (!project) {
            throw new Error(
                'Project not found.'
            );
        }


        /*
         * ---------------------------------------------------------
         * 4. Validate campaign email template
         * ---------------------------------------------------------
         */

        if (!template) {
            throw new Error(
                'Panelist Survey Campaign email template not found.'
            );
        }

        if (
            typeof EmailTemplate.validateCampaignTemplate ===
            'function'
        ) {
            EmailTemplate.validateCampaignTemplate(
                template
            );
        }


        /*
         * ---------------------------------------------------------
         * 5. Validate project URLs
         * ---------------------------------------------------------
         */

        if (!urls || urls.length === 0) {
            throw new Error(
                'Add Project URL Info first before inviting users.'
            );
        }


        /*
         * ---------------------------------------------------------
         * 6. Resolve selected project URL
         * ---------------------------------------------------------
         */

        let selectedUrl = null;

        if (projectUrlId) {

            selectedUrl = urls.find(
                url =>
                    Number(url.id) ===
                    Number(projectUrlId)
            );

            if (!selectedUrl) {
                throw new Error(
                    'Project URL not found for this project.'
                );
            }

        } else {

            if (urls.length > 1) {
                throw new Error(
                    'Multiple Project URLs found. Please provide projectUrlId.'
                );
            }

            selectedUrl = urls[0];
        }


        /*
         * ---------------------------------------------------------
         * 7. Determine link type
         * ---------------------------------------------------------
         */

        const multiLink = isMultiLink(
            selectedUrl.Project_Link_Type
        );


        /*
         * ---------------------------------------------------------
         * 8. Get vendor URLs
         * ---------------------------------------------------------
         */

        let singleVendorUrl = null;
        let multiVendorUrls = [];

        if (multiLink) {

            const rows =
                await ProjectMultipleUrl
                    .getActiveVenderUrlsByProjectId(
                        projectId
                    );

            multiVendorUrls = rows
                .map(row => row.VenderURL)
                .filter(Boolean);


            if (multiVendorUrls.length === 0) {
                throw new Error(
                    'No active Vendor URL found in project_mutiple_Url.'
                );
            }

        } else {

            singleVendorUrl =
                await SupplierMapping
                    .getVenderUrlByProjectId(
                        projectId
                    );


            if (!singleVendorUrl) {
                throw new Error(
                    'No active Vendor URL found in supplier_mapping.'
                );
            }
        }


        /*
         * ---------------------------------------------------------
         * 9. Create panelist lookup
         * ---------------------------------------------------------
         */

        const panelistById = new Map(
            panelistRows.map(
                panelist => [
                    Number(panelist.id),
                    panelist
                ]
            )
        );


        /*
         * ---------------------------------------------------------
         * 10. Prepare recipients
         * ---------------------------------------------------------
         */

        const skipped = [];
        const recipients = [];

        /*
         * For multi-link projects:
         *
         * Each vendor URL can only be assigned ONCE.
         *
         * We intentionally do NOT use:
         *
         *     i % multiVendorUrls.length
         *
         * because that would reuse URLs.
         */

        const availableMultiUrls = [
            ...multiVendorUrls
        ];


        for (const panelistId of panelistIds) {

            const panelist =
                panelistById.get(
                    Number(panelistId)
                );


            if (!panelist) {

                skipped.push({
                    panelist_id: panelistId,
                    reason: 'Panelist not found'
                });

                continue;
            }


            /*
             * -----------------------------------------------------
             * Select vendor URL
             * -----------------------------------------------------
             */

            let rawLink = null;


            if (multiLink) {

                /*
                 * No URL left means we cannot safely invite
                 * this panelist.
                 */
                if (availableMultiUrls.length === 0) {

                    skipped.push({
                        panelist_id: panelistId,
                        reason:
                            'No unused vendor URL available for this panelist'
                    });

                    continue;
                }


                /*
                 * Remove the URL from the available pool
                 * immediately so it cannot be assigned again.
                 *
                 * For now we use the first available URL.
                 * The order is not semantically important.
                 */
                rawLink =
                    availableMultiUrls.shift();

            } else {

                rawLink = singleVendorUrl;
            }


            /*
             * -----------------------------------------------------
             * Generate the panelist-specific survey URL
             * -----------------------------------------------------
             */

            const panelistUid =
                buildUidForPanelist(panelist);


            const surveyLink =
                applyEncryptedUidToLink(
                    rawLink,
                    panelistUid
                );


            /*
             * -----------------------------------------------------
             * Prepare recipient
             * -----------------------------------------------------
             */

            recipients.push({

                userId: panelist.id,

                email: panelist.email,

                name: panelist.name,

                specificSurveyLink:
                    surveyLink

            });
        }


        /*
         * ---------------------------------------------------------
         * 11. Nothing to send
         * ---------------------------------------------------------
         */

        if (recipients.length === 0) {

            return {
                success: false,

                message:
                    'No eligible panelists available for invitation.',

                invitedCount: 0,

                skippedCount:
                    skipped.length,

                skipped
            };
        }


        /*
         * ---------------------------------------------------------
         * 12. Get campaign email content
         * ---------------------------------------------------------
         */

        /*
         * IMPORTANT:
         *
         * We do NOT render:
         *
         *     user_name
         *     survey_url
         *
         * here.
         *
         * The survey link is handled by the Zoho merge field:
         *
         *     SPECIFIC_SURVEY_LINK
         */

        const {
            subject,
            body
        } = EmailTemplate.renderCampaign(
            template
        );


        /*
         * ---------------------------------------------------------
         * 13. Create local campaign
         * ---------------------------------------------------------
         */

        const campaignName =
            `Survey Invitation - ${project.Project_Name} - ${Date.now()}`;


                // Create local campaign
        const campaignId =
        await EmailCampaign.create({
            campaignName,
            mailingListKey: ZOHO_MAILING_LIST_KEY,
            subject,
            fromEmail: ZOHO_FROM_EMAIL,
            totalRecipients: recipients.length
        });


        // Create signed content URL
        if (!APP_PUBLIC_URL) {
        throw new Error(
            'APP_PUBLIC_URL is not configured.'
        );
        }

        const contentToken =
        generateCampaignContentToken(campaignId);

        const contentUrl =
        `${APP_PUBLIC_URL}/api/email-campaign/content/${campaignId}?token=${contentToken}`;

        // Save recipients
        const recipientRows =
        recipients.map(recipient => ({
            campaignId,
            userId: recipient.userId,
            email: recipient.email,
            name: recipient.name,
            specificSurveyLink:
                recipient.specificSurveyLink,
            zohoContactId: null
        }));

        await EmailCampaignRecipient.createMany(
        recipientRows
        );


        // Sync contacts to Zoho
        const zohoResults =
        await runWithConcurrency(
            recipients,
            ZOHO_CONTACT_CONCURRENCY,
            async (recipient, index) => {
    
                try {
    
                    console.log(
                        `[Zoho ${index + 1}/${recipients.length}] ` +
                        `Syncing ${recipient.email}`
                    );
    
                    const result =
                        await ZohoCampaignService.subscribeContact({
                            email: recipient.email,
    
                            firstName:
                                recipient.name,
    
                            specificSurveyLink:
                                recipient.specificSurveyLink,
    
                            listKey:
                                ZOHO_MAILING_LIST_KEY,
                            topicId: ZOHO_TOPIC_ID || process.env.ZOHO_TOPIC_ID
                        });
    
                    console.log(
                        `[Zoho ${index + 1}/${recipients.length}] ` +
                        `SUCCESS ${recipient.email}`
                    );
    
                    return {
                        email: recipient.email,
                        success: true,
                        response: result
                    };
    
                } catch (error) {
    
                    console.error(
                        `[Zoho ${index + 1}/${recipients.length}] ` +
                        `FAILED ${recipient.email}`
                    );
    
                    console.error(
                        error?.response?.data ||
                        error?.message ||
                        error
                    );
    
                    return {
                        email: recipient.email,
                        success: false,
                        error:
                            error?.response?.data ||
                            error?.message ||
                            String(error)
                    };
                }
            }
        );
    
    
    // =====================================================
    // CHECK CONTACT SYNC RESULT
    // =====================================================
    
    const successfulZohoContacts =
        zohoResults.filter(
            result => result.success
        );
    
    const failedZohoContacts =
        zohoResults.filter(
            result => !result.success
        );

        if (failedZohoContacts.length > 0) {

        await EmailCampaign.updateStatus({
            id: campaignId,
            status: 'FAILED'
        });

        throw new Error(
            `Failed to sync ${failedZohoContacts.length} recipient(s) to Zoho.`
        );
        }


        // =====================================================
        // CREATE ONE ZOHO CAMPAIGN
        // =====================================================

        const zohoCampaignResponse =
        await ZohoCampaignService.createCampaign({
            campaignName,
            subject,
            fromEmail:
                ZOHO_FROM_EMAIL,
            fromName:
                process.env.ZOHO_FROM_NAME ||
                'Spade Community',
            listKey:
                ZOHO_MAILING_LIST_KEY,
            contentUrl,
            topicId: ZOHO_TOPIC_ID
        });

        // Save Zoho campaign information
        const zohoCampaignId =
        zohoCampaignResponse?.campaign_id;

        const zohoCampaignKey =
        zohoCampaignResponse?.campaignKey;

        if (!zohoCampaignId || !zohoCampaignKey) {
            await EmailCampaign.updateStatus({
                id: campaignId,
                status: 'FAILED'
        });

        throw new Error(
            'Zoho campaign was created but campaign ID/key was not returned.'
        );
        }

        // Save Zoho information BEFORE sending
        await EmailCampaign.updateZohoDetails({
        id: campaignId,
        zohoCampaignId,
        zohoCampaignKey
        });

        // Send campaign
        const sendResponse =
            await ZohoCampaignService.sendCampaign({
                campaignKey: zohoCampaignKey
            });

        if (
            !sendResponse ||
            sendResponse.status === 'error' ||
            sendResponse.code === '6611'
        ) {
            await EmailCampaign.updateStatus({
                id: campaignId,
                status: 'FAILED'
            });
        
            throw new Error(
                sendResponse?.message ||
                'Zoho campaign could not be sent.'
            );
        }

        await EmailCampaign.updateStatus({
            id: campaignId,
            status: 'SENT'
        });
        // const fields = await ZohoCampaignService.getAllContactFields();

        return {
            success: true,
            campaignId,
            campaignName,
            zohoCampaignId,
            zohoCampaignKey,
            subject,
            invitedCount: recipients.length,
            skippedCount: skipped.length,
            skipped,
            zohoContactFailures: failedZohoContacts
        };
    }
};


export default EmailCampaignService;