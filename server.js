import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
dotenv.config();

import adminRoutes from './routes/adminRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import partnerRoutes from './routes/Partnerroutes.js';
import projectManagerRoutes from './routes/projectManagerRoutes.js';
import countryRoutes from './routes/countryRoutes.js';
import salesProjectRoutes from './routes/salesProjectRoutes.js';
import salesManagerRoutes from './routes/salesManagerRoutes.js';
import prescreenRoutes from './routes/prescreenRoutes.js';
import prescreenSurveyRoutes from './routes/prescreenSurveyRoutes.js';
import surveyRoutes from './routes/surveyRoutes.js';
import surveyGroupProjectRoutes from './routes/surveyGroupProjectRoutes.js';
import salesLogRoutes from './routes/salesLogRoutes.js';
import surveyPageRoutes from './routes/surveyPageRoutes.js';
import activityLogRoutes from './routes/activityLogRoutes.js';
import emailTemplateRoutes from './routes/emailTemplateRoutes.js';
import invoiceSettingsRoutes from './routes/invoiceSettingsRoutes.js';
import systemEmailRoutes from './routes/systemEmailRoutes.js';


const app = express();

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use('/uploads', express.static('uploads'));
app.set("trust proxy", 2);

app.use('/api/admin', adminRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/projectmanager', projectManagerRoutes);
app.use('/api/countries', countryRoutes);
app.use('/api/sales/project', salesProjectRoutes);
app.use('/api/salesmanager', salesManagerRoutes);
app.use('/api/prescreen', prescreenRoutes);
app.use('/api/prescreen-survey', prescreenSurveyRoutes);
app.use('/api/survey', surveyRoutes);
app.use('/api/sales/log', salesLogRoutes);
app.use('/api/survey/groupproject', surveyGroupProjectRoutes);
app.use('/api/survey-pages', surveyPageRoutes);
app.use('/api/activity', activityLogRoutes);
app.use('/api/email-templates', emailTemplateRoutes);
app.use('/api/invoice/settings', invoiceSettingsRoutes);
app.use('/api/system-emails', systemEmailRoutes);
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});