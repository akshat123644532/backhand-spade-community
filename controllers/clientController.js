import Client from '../models/clientModel.js';

export const addClient = async (req, res) => {
    const { name, email, country, contact_no } = req.body;
    const adminId = req.user ? req.user.id : null; 
    try {
        if (!email || !name) {
            return res.status(400).json({ success: false, message: "Name and email are required" });
        }

        const existingClient = await Client.findByEmail(email);
        if (existingClient) {
            return res.status(400).json({ success: false, message: "Client email already register!" });
        }

        await Client.create({ name, email, country, contact_no, admin_id: adminId });
        res.status(201).json({ success: true, message: "Client added sucessfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getAllClients = async (req, res) => {
    try {
        const clients = await Client.getAll();
        res.status(200).json({ success: true, count: clients.length, clients });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getClientById = async (req, res) => {
    const { id } = req.params;
    try {
        const client = await Client.getById(id);
        if (!client) {
            return res.status(404).json({ success: false, message: "Client not found!" });
        }
        res.status(200).json({ success: true, client });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateClient = async (req, res) => {
    const { id } = req.params;
    const { name, country, contact_no } = req.body;
    try {
        await Client.update(id, { name, country, contact_no });
        res.status(200).json({ success: true, message: "Client updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteClient = async (req, res) => {
    const { id } = req.params;
    try {
        await Client.delete(id);
        res.status(200).json({ success: true, message: "Client deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};