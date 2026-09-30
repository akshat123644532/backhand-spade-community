import crypto from 'crypto';

const ZOHO_CONTENT_SECRET =
    process.env.ZOHO_CONTENT_SECRET;


const generateCampaignContentToken = (campaignId) => {

    if (!ZOHO_CONTENT_SECRET) {
        throw new Error(
            'ZOHO_CONTENT_SECRET is not configured.'
        );
    }

    return crypto
        .createHmac(
            'sha256',
            ZOHO_CONTENT_SECRET
        )
        .update(String(campaignId))
        .digest('hex');
};


const verifyCampaignContentToken = (
    campaignId,
    token
) => {

    if (!ZOHO_CONTENT_SECRET || !token) {
        return false;
    }

    const expectedToken =
        generateCampaignContentToken(campaignId);

    /*
     * timingSafeEqual prevents simple timing-based
     * comparison attacks.
     */
    if (
        token.length !== expectedToken.length
    ) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(token),
        Buffer.from(expectedToken)
    );
};


export {
    generateCampaignContentToken,
    verifyCampaignContentToken
};