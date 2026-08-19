import Client from '../models/clientModel.js';
import { logActivity } from '../utils/activityLogger.js';
import { decrypt, encrypt } from '../utils/cryptoHelper.js';
import { buildCsv, sendCsv } from '../utils/csvExport.js';

const prepareApiSecretKeyForStorage = (apiSecretKey) => {
    if (apiSecretKey === undefined || apiSecretKey === null || apiSecretKey === '') {
        return apiSecretKey;
    }
    const plainSecret = decrypt(apiSecretKey);
    return encrypt(plainSecret);
};

const withDecryptedApiSecret = (client) => {
    if (!client) return client;
    if (!client.api_secret_key) return client;
    try {
        return {
            ...client,
            api_secret_key: decrypt(client.api_secret_key),
        };
    } catch (error) {
        return client;
    }
};

export const addClient = async (req, res) => {
    const { name, email, country, contact_no, website_url, api_base_url, api_secret_key, api_header_key, status } = req.body;
    const adminId = req.user ? req.user.id : null;
    try {
        if (!name || !email) return res.status(400).json({ success: false, message: "Name and email are required" });
        const existingClient = await Client.findByEmail(email);
        if (existingClient) return res.status(400).json({ success: false, message: "Client email already registered!" });

        const encryptedApiSecretKey = api_secret_key
            ? prepareApiSecretKeyForStorage(api_secret_key)
            : api_secret_key;

        await Client.create({
            name,
            email,
            country,
            contact_no,
            admin_id: adminId,
            website_url,
            api_base_url,
            api_secret_key: encryptedApiSecretKey,
            api_header_key,
            status,
        });

        await logActivity({ admin_id: adminId, action: 'ADD', module: 'Client', description: `Client "${name}" added`, ip_address: req.ip });

        res.status(201).json({ success: true, message: "Client added successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getAllClients = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const country = req.query.country || '';
        const result = await Client.getAll({ page, limit, search, country });
        if (Array.isArray(result.data)) {
            result.data = result.data.map(withDecryptedApiSecret);
        }
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getClientById = async (req, res) => {
    const { id } = req.params;
    try {
        const client = await Client.getById(id);
        if (!client) return res.status(404).json({ success: false, message: "Client not found!" });
        res.status(200).json({ success: true, client: withDecryptedApiSecret(client) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateClient = async (req, res) => {
    const { id } = req.params;
    try {
        const client = await Client.getById(id);
        if (!client) return res.status(404).json({ success: false, message: "Client not found!" });

        const { name, country, contact_no, website_url, api_base_url, api_secret_key, api_header_key, status } = req.body;

        const updateData = { name, country, contact_no, website_url, api_base_url, api_secret_key, api_header_key, status };
        Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

        if (Object.prototype.hasOwnProperty.call(updateData, 'api_secret_key') && updateData.api_secret_key) {
            updateData.api_secret_key = prepareApiSecretKeyForStorage(updateData.api_secret_key);
        }

        await Client.update(id, updateData);

        await logActivity({ admin_id: req.user?.id, action: 'UPDATE', module: 'Client', description: `Client ID ${id} updated`, ip_address: req.ip });

        res.status(200).json({ success: true, message: "Client updated successfully" });
    } catch (error) {
        if (error.message === "No fields provided to update!") {
            return res.status(400).json({ success: false, message: "No fields provided to update!" });
        }
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteClient = async (req, res) => {
    const { id } = req.params;
    try {
        const client = await Client.getById(id);
        if (!client) return res.status(404).json({ success: false, message: "Client not found!" });

        await Client.delete(id);

        await logActivity({ admin_id: req.user?.id, action: 'DELETE', module: 'Client', description: `Client ID ${id} deleted`, ip_address: req.ip });

        res.status(200).json({ success: true, message: "Client deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const exportClientsCsv = async (req, res) => {
    try {
        const search = req.query.search || '';
        const country = req.query.country || '';
        const result = await Client.getAll({ page: 1, limit: 1000000, search, country });

        const csv = buildCsv(result.data, [
            { label: 'ID', key: 'id' },
            { label: 'Name', key: 'name' },
            { label: 'Email', key: 'email' },
            { label: 'Country', key: 'country' },
            { label: 'Contact No', key: 'contact_no' },
            { label: 'Website', key: 'website_url' },
            { label: 'Status', key: 'status' }
        ]);

        return sendCsv(res, 'clients.csv', csv);
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};