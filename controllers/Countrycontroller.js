import Country from '../models/countryModel.js';

export const getAllCountries = async (req, res) => {
    try {
        const search = req.query.search || '';
        const countries = await Country.getAll({ search });
        return res.status(200).json({ success: true, count: countries.length, data: countries });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getCountryById = async (req, res) => {
    try {
        const { id } = req.params;
        const country = await Country.getById(id);
        if (!country) return res.status(404).json({ success: false, message: "Country not found!" });
        return res.status(200).json({ success: true, data: country });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};