const languages = [
    "Arabic",
    "Chinese",
    "Dutch",
    "English",
    "French",
    "German",
    "Hindi",
    "Italian",
    "Japanese",
    "Korean",
    "Russian",
    "Spanish"
];

export const getLanguages = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            data: languages
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};