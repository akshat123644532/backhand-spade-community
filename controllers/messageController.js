import Message from '../models/messageModel.js';
import { sendEmail } from '../config/mailer.js';

export const getAllMessages = async (req, res) => {
    try {
        const { page, limit, search } = req.query;
        const result = await Message.getAll({ page, limit, search });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getUnreadMessageCount = async (req, res) => {
    try {
        const count = await Message.getUnreadCount();
        return res.status(200).json({ success: true, data: { count } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getMessageById = async (req, res) => {
    try {
        const { id } = req.params;
        const message = await Message.getById(id);
        if (!message) return res.status(404).json({ success: false, message: "Message not found!" });

        if (!message.is_read) {
            await Message.markRead(id);
        }

        const replies = await Message.getReplies(id);

        return res.status(200).json({ success: true, data: { ...message, replies } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const markAllMessagesRead = async (req, res) => {
    try {
        await Message.markAllRead();
        return res.status(200).json({ success: true, message: "All messages marked as read!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const message = await Message.getById(id);
        if (!message) return res.status(404).json({ success: false, message: "Message not found!" });

        await Message.delete(id);
        return res.status(200).json({ success: true, message: "Message deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const replyToMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { reply_body } = req.body;

        if (!reply_body) {
            return res.status(400).json({ success: false, message: "Reply body is required!" });
        }

        const message = await Message.getById(id);
        if (!message) return res.status(404).json({ success: false, message: "Message not found!" });

        const replyId = await Message.addReply({
            message_id: id,
            reply_body,
            replied_by: req.user?.id || null
        });

        // Reply email respondent ko bhej do (non-blocking)
        (async () => {
            try {
                await sendEmail({
                    to: message.sender_email,
                    subject: `Re: ${message.subject}`,
                    html: `<p>${reply_body}</p>`
                });
            } catch (mailError) {
                console.error('MESSAGE REPLY EMAIL FAILED:', mailError.message);
            }
        })();

        return res.status(201).json({
            success: true,
            message: "Reply sent successfully!",
            data: { id: replyId }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};