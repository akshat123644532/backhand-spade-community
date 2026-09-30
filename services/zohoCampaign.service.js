import axios from 'axios';

const ZOHO_CAMPAIGNS_BASE_URL =
    process.env.ZOHO_CAMPAIGNS_BASE_URL ||
    'https://campaigns.zoho.com/api/v1.1';

const ZOHO_ACCOUNTS_BASE_URL =
    process.env.ZOHO_ACCOUNTS_BASE_URL ||
    'https://accounts.zoho.com';

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_TOPIC_ID = process.env.ZOHO_TOPIC_ID;
const ZOHO_MAILING_LIST_KEY = process.env.ZOHO_MAILING_LIST_KEY;
const ZOHO_FROM_EMAIL = process.env.ZOHO_FROM_EMAIL;
const ZOHO_FROM_NAME =
    process.env.ZOHO_FROM_NAME || 'Spade Community';

const REQUEST_TIMEOUT = 30000;

/*
 * Access token cache
 *
 * Zoho access tokens are short-lived.
 * We keep the token in memory and refresh it when it is close to expiry.
 */
let accessTokenCache = {
    accessToken: null,
    expiresAt: 0
};


/**
 * Get a valid Zoho access token.
 *
 * Uses the refresh token to obtain a new access token when:
 * - there is no cached token
 * - the cached token is expired
 * - the cached token is about to expire
 */
const getAccessToken = async () => {

    const now = Date.now();

    // Keep a 2-minute safety buffer before expiry
    if (
        accessTokenCache.accessToken &&
        now < accessTokenCache.expiresAt - 120000
    ) {
        return accessTokenCache.accessToken;
    }

    if (
        !ZOHO_CLIENT_ID ||
        !ZOHO_CLIENT_SECRET ||
        !ZOHO_REFRESH_TOKEN
    ) {
        throw new Error(
            'Zoho OAuth configuration is missing.'
        );
    }

    try {

        const response = await axios.post(
            `${ZOHO_ACCOUNTS_BASE_URL}/oauth/v2/token`,
            new URLSearchParams({
                refresh_token: ZOHO_REFRESH_TOKEN,
                client_id: ZOHO_CLIENT_ID,
                client_secret: ZOHO_CLIENT_SECRET,
                grant_type: 'refresh_token'
            }),
            {
                headers: {
                    'Content-Type':
                        'application/x-www-form-urlencoded'
                },
                timeout: REQUEST_TIMEOUT
            }
        );

        const {
            access_token,
            expires_in
        } = response.data;

        if (!access_token) {
            throw new Error(
                'Zoho OAuth response did not contain access_token.'
            );
        }

        accessTokenCache = {
            accessToken: access_token,
            expiresAt:
                now +
                (Number(expires_in || 3600) * 1000)
        };

        return access_token;

    } catch (error) {

        console.error(
            'Zoho OAuth token refresh failed:',
            error.response?.data || error.message
        );

        throw new Error(
            `Failed to refresh Zoho access token: ${
                error.response?.data?.error ||
                error.response?.data?.message ||
                error.message
            }`
        );
    }
};


/**
 * Clear cached access token.
 *
 * Used when Zoho tells us that the current token is invalid/expired.
 */
const clearAccessToken = () => {

    accessTokenCache = {
        accessToken: null,
        expiresAt: 0
    };
};


/**
 * Make an authenticated Zoho Campaigns API request.
 *
 * This centralizes:
 * - authentication
 * - timeout
 * - error handling
 * - one retry after token expiration
 */
const zohoRequest = async ({
    method = 'GET',
    url,
    data = null,
    params = null,
    retry = true
}) => {

    const accessToken = await getAccessToken();

    try {

        const response = await axios({
            method,
            url,
            data,
            params,

            headers: {
                Authorization:
                    `Zoho-oauthtoken ${accessToken}`,

                ...(data
                    ? {
                        'Content-Type':
                            'application/x-www-form-urlencoded'
                    }
                    : {})
            },

            timeout: REQUEST_TIMEOUT
        });

        return response.data;

    } catch (error) {

        const status = error.response?.status;

        /*
         * If Zoho rejects the access token, clear it and
         * retry the request once with a fresh token.
         */
        if (
            retry &&
            (status === 401 || status === 403)
        ) {

            clearAccessToken();

            return zohoRequest({
                method,
                url,
                data,
                params,
                retry: false
            });
        }

        console.error(
            'Zoho Campaign API error:',
            {
                method,
                url,
                status,
                response: error.response?.data,
                message: error.message
            }
        );

        throw createZohoError(error);
    }
};


/**
 * Convert Axios/Zoho errors into a clean application error.
 */
const createZohoError = (error) => {

    const zohoResponse = error.response?.data;

    const zohoCode =
        zohoResponse?.code ||
        zohoResponse?.response?.code;

    const zohoMessage =
        zohoResponse?.message ||
        zohoResponse?.response?.message ||
        error.message;

    const applicationError = new Error(
        `Zoho Campaign API error${
            zohoCode ? ` (${zohoCode})` : ''
        }: ${zohoMessage}`
    );

    applicationError.code = zohoCode;
    applicationError.zohoResponse = zohoResponse;
    applicationError.status =
        error.response?.status || null;

    return applicationError;
};


/**
 * Add/update one contact in a Zoho mailing list.
 *
 * This is the API we will use for:
 *
 * Contact Email
 * First Name
 * Specific Survey Link
 */
const subscribeContact = async ({
    email,
    firstName,
    lastName = '',
    specificSurveyLink,
    listKey = ZOHO_MAILING_LIST_KEY,
    topicId = null
}) => {
    if (!email) {
        throw new Error('Zoho contact email is required.');
    }

    if (!specificSurveyLink) {
        throw new Error('Specific survey link is required.');
    }

    if (!listKey) {
        throw new Error('Zoho mailing list key is missing.');
    }

    const contactInfo = {
        'Contact Email': email,
        'First Name': firstName || '',
        'FNAME': firstName || '',
        'Specific Survey Link': specificSurveyLink || ''
      };
    const params = new URLSearchParams();

    params.append('resfmt', 'JSON');
    params.append('listkey', listKey);
    params.append('source', 'API');
    params.append('contactinfo', JSON.stringify(contactInfo));
    params.append('topic_id', process.env.ZOHO_TOPIC_ID);

    return zohoRequest({
        method: 'POST',
        url: `${ZOHO_CAMPAIGNS_BASE_URL}/json/listsubscribe`,
        data: params
    });
};


/**
 * Create a Zoho Campaign.
 *
 * contentUrl should point to the HTML content that Zoho
 * can retrieve.
 */
const createCampaign = async ({
    campaignName,
    subject,
    fromEmail = ZOHO_FROM_EMAIL,
    fromName = ZOHO_FROM_NAME,
    listKey = ZOHO_MAILING_LIST_KEY,
    contentUrl,
    topicId = ZOHO_TOPIC_ID
}) => {
    if (!campaignName) {
        throw new Error('Zoho campaign name is required.');
    }

    if (!subject) {
        throw new Error('Zoho campaign subject is required.');
    }

    if (!fromEmail) {
        throw new Error('Zoho campaign from email is required.');
    }

    if (!listKey) {
        throw new Error('Zoho mailing list key is required.');
    }

    if (!contentUrl) {
        throw new Error('Zoho campaign content URL is required.');
    }

    if (!topicId) {
        throw new Error('Zoho topic ID is required.');
    }

    const listDetails = {
        [listKey]: []
    };

    const formData = new URLSearchParams();

    formData.append('resfmt', 'JSON');
    formData.append('campaignname', campaignName);
    formData.append('from_email', fromEmail);
    formData.append('from_name', fromName);
    formData.append('subject', subject);
    formData.append('list_details', JSON.stringify(listDetails));
    formData.append('content_url', contentUrl);
    formData.append('topicId', topicId);

    return zohoRequest({
        method: 'POST',
        url: `${ZOHO_CAMPAIGNS_BASE_URL}/createCampaign`,
        data: formData
    });
};


/**
 * Get campaign details.
 */
const getCampaignDetails = async ({
    campaignKey
}) => {

    if (!campaignKey) {
        throw new Error(
            'Zoho campaign key is required.'
        );
    }

    return zohoRequest({
        method: 'GET',
        url: `${ZOHO_CAMPAIGNS_BASE_URL}/getcampaigndetails`,
        params: {
            resfmt: 'JSON',
            campaignkey: campaignKey
        }
    });
};


/**
 * Send an approved Zoho Campaign.
 *
 * Important:
 * Zoho may reject the campaign if it has not
 * completed its review process.
 */
const sendCampaign = async ({
    campaignKey
}) => {

    if (!campaignKey) {
        throw new Error(
            'Zoho campaign key is required.'
        );
    }

    const formData = new URLSearchParams();

    formData.append('resfmt', 'JSON');
    formData.append(
        'campaignkey',
        campaignKey
    );

    const response = await zohoRequest({
        method: 'POST',
        url: `${ZOHO_CAMPAIGNS_BASE_URL}/sendcampaign`,
        data: formData
    });

    return response;
};


/**
 * Get all mailing lists.
 *
 * Useful for administration/testing.
 */
const getMailingLists = async () => {

    return zohoRequest({
        method: 'GET',
        url: `${ZOHO_CAMPAIGNS_BASE_URL}/getmailinglists`,
        params: {
            resfmt: 'JSON'
        }
    });
};

const getAllContactFields = async () => {
    return zohoRequest({
        method: 'GET',
        url: `${ZOHO_CAMPAIGNS_BASE_URL}/contact/allfields`,
        params: {
            type: 'json'
        }
    });
};

const ZohoCampaignService = {
    getAccessToken,
    subscribeContact,
    createCampaign,
    getCampaignDetails,
    sendCampaign,
    getMailingLists,
    getAllContactFields
};

export default ZohoCampaignService;