import express from 'express';
import {
    getFilterQuestions,
    getAnswerOptions,
    searchUsers,
    inviteUsers,
    listInvitedUsers,
    getEligibleProjectUrls
} from '../controllers/findUserController.js';

const router = express.Router();

router.get('/questions',                    getFilterQuestions);
router.get('/questions/:questionId/answers', getAnswerOptions);
router.get('/:id/urls',                      getEligibleProjectUrls);   
router.post('/:id/search',                   searchUsers);
router.post('/:id/invite',                   inviteUsers);
router.get('/:id/invited',                   listInvitedUsers);

export default router;