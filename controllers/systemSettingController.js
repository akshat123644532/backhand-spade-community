import SystemSetting from '../models/systemSettingModel.js';

export const getSystemSettings = async (req, res) => {
    try {
        const settings = await SystemSetting.get();
        if (!settings) {
            return res.status(404).json({ success: false, message: "System settings not found!" });
        }
        return res.status(200).json({ success: true, data: settings });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateSystemSettings = async (req, res) => {
    try {
        const {
            application_name,
            default_language,
            date_format,
            time_format,
            theme_preference,
            two_factor_auth,
            login_alerts,
            session_timeout_minutes,
            remember_me_days
        } = req.body;

        const updated = await SystemSetting.update({
            application_name,
            default_language,
            date_format,
            time_format,
            theme_preference,
            two_factor_auth,
            login_alerts,
            session_timeout_minutes,
            remember_me_days
        });

        if (!updated) {
            return res.status(400).json({ success: false, message: "Nothing to update!" });
        }

        return res.status(200).json({
            success: true,
            message: "System settings updated successfully!",
            data: updated
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};