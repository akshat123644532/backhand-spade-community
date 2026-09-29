import express from 'express';

import {
    getCampaignContent,
    testCampaign
} from '../controllers/emailCampaign.controller.js';

const router = express.Router();


router.get(
    '/content/:campaignId',
    getCampaignContent
);
router.post(
    '/test',
    testCampaign
);


export default router;