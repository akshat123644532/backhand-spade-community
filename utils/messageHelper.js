import Message from '../models/messageModel.js';

export const createSystemMessage = async ({ sender_name, sender_email, subject, body }) => {
    try {
        await Message.create({
            sender_name,
            sender_email,
            subject,
            body,
            recipient_admin_id: null
        });
    } catch (error) {
        console.error('CREATE SYSTEM MESSAGE FAILED:', error.message);
    }
};