import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import {
    getAllMessages,
    getUnreadMessageCount,
    getMessageById,
    markAllMessagesRead,
    deleteMessage,
    replyToMessage
} from '../controllers/messageController.js';

const router = express.Router();

router.get('/list',           verifyToken, getAllMessages);
router.get('/unread-count',   verifyToken, getUnreadMessageCount);
router.patch('/read-all',     verifyToken, markAllMessagesRead);
router.get('/:id',            verifyToken, getMessageById);
router.post('/:id/reply',     verifyToken, replyToMessage);
router.delete('/:id',         verifyToken, deleteMessage);

export default router;