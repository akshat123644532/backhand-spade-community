import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import adminRoutes from './routes/adminRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import partnerRoutes from './routes/Partnerroutes.js';
dotenv.config();
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use('/uploads', express.static('uploads'));
app.set("trust proxy", 2);

app.use('/api/admin', adminRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/admin/partner', partnerRoutes);
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});