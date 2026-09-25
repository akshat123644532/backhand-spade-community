import ContactUs from '../models/contactUsModel.js';

export const createContactUs = async (req, res) => {
    try {

        const {
            full_name,
            email,
            subject,
            message
        } = req.body;

        // ---------------------------------------------------------
        // Validation
        // ---------------------------------------------------------

        if (!full_name || !String(full_name).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Full name is required!'
            });
        }

        if (!email || !String(email).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Email is required!'
            });
        }

        if (!subject || !String(subject).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Subject is required!'
            });
        }

        if (!message || !String(message).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Message is required!'
            });
        }

        // ---------------------------------------------------------
        // Basic email validation
        // ---------------------------------------------------------

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(String(email).trim())) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address!'
            });
        }

        // ---------------------------------------------------------
        // Save to database
        // ---------------------------------------------------------

        const id = await ContactUs.create({
            full_name: String(full_name).trim(),
            email: String(email).trim().toLowerCase(),
            subject: String(subject).trim(),
            message: String(message).trim()
        });

        // ---------------------------------------------------------
        // Get created record
        // ---------------------------------------------------------

        const contact = await ContactUs.getById(id);

        return res.status(201).json({
            success: true,
            message:
                'Your message has been submitted successfully!',
            data: contact
        });

    } catch (error) {

        console.error(
            '[ContactUs] Create error:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Server error!',
            error: error.message
        });
    }
};