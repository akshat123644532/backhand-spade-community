import InvoiceSettings from '../models/invoiceSettingsModel.js';
import { logActivity } from '../utils/activityLogger.js';

// ─── GET INVOICE SETTINGS ──────────────────────────────────────────
export const getInvoiceSettings = async (req, res) => {
    try {
        const settings = await InvoiceSettings.get();
        if (!settings) {
            return res.status(404).json({ success: false, message: "Invoice settings not found!" });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        settings.logo_image = settings.logo_image ? `${baseUrl}${settings.logo_image}` : null;

        return res.status(200).json({ success: true, data: settings });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// ─── UPDATE INVOICE SETTINGS ───────────────────────────────────────
export const updateInvoiceSettings = async (req, res) => {
    try {
        const { address, payment_term, footer_content } = req.body;

        const updateData = {};
        if (address !== undefined) updateData.address = address;
        if (payment_term !== undefined) updateData.payment_term = payment_term;
        if (footer_content !== undefined) updateData.footer_content = footer_content;
        if (req.file) updateData.logo_image = `/uploads/${req.file.filename}`;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, message: "Nothing to update!" });
        }

        await InvoiceSettings.update(updateData);

        await logActivity({
            admin_id: req.user?.id,
            action: 'UPDATE',
            module: 'InvoiceSettings',
            description: `Invoice settings updated`,
            ip_address: req.ip
        });

        const updated = await InvoiceSettings.get();
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        updated.logo_image = updated.logo_image ? `${baseUrl}${updated.logo_image}` : null;

        return res.status(200).json({ success: true, message: "Invoice settings updated successfully!", data: updated });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};