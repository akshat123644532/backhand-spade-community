import { db } from '../config/db.js';

const safeQuery = async (sql, params = []) => {
    try {
        const [rows] = await db.query(sql, params);
        return rows;
    } catch (error) {
        console.error('DASHBOARD QUERY ERROR:', error.message);
        return null;
    }
};

const last12MonthsLabels = () => {
    const labels = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: d.toLocaleString('default', { month: 'short', year: 'numeric' }) });
    }
    return labels;
};

const fillMonthlyTrend = (rows) => {
    const labels = last12MonthsLabels();
    return labels.map(({ year, month, label }) => {
        const match = (rows || []).find(r => Number(r.year) === year && Number(r.month) === month);
        return { month: label, count: match ? Number(match.count) : 0 };
    });
};

export const getDashboardSummary = async (req, res) => {
    try {
        const [
            totalUsersRow,
            totalClientsRow,
            totalPartnersRow,
            totalPMRow,
            surveyStatusRows,
            surveyTrendRows,
            rfqStatusRows,
            rfqTrendRows,
            userGrowthRows,
            clientStatusRows,
            partnerStatusRows,
            rewardSummaryRows,
            rewardTrendRows
        ] = await Promise.all([
            safeQuery(`SELECT COUNT(*) AS total FROM panelists WHERE deleted_at IS NULL`),
            safeQuery(`SELECT COUNT(*) AS total FROM clients`),
            safeQuery(`SELECT COUNT(*) AS total FROM partners WHERE deleted_at IS NULL`),
            safeQuery(`SELECT COUNT(*) AS total FROM project_managers WHERE deleted_at IS NULL`),
            safeQuery(`SELECT Status AS status, COUNT(*) AS total FROM project_Info WHERE isdeleted = 0 OR isdeleted IS NULL GROUP BY Status`),
            safeQuery(`SELECT YEAR(created_at) AS year, MONTH(created_at) AS month, COUNT(*) AS count FROM project_Info WHERE (isdeleted = 0 OR isdeleted IS NULL) AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH) GROUP BY YEAR(created_at), MONTH(created_at)`),
            safeQuery(`SELECT RFQ AS rfq, COUNT(*) AS total FROM project_Info WHERE isdeleted = 0 OR isdeleted IS NULL GROUP BY RFQ`),
            safeQuery(`SELECT YEAR(created_at) AS year, MONTH(created_at) AS month, COUNT(*) AS count FROM project_Info WHERE (isdeleted = 0 OR isdeleted IS NULL) AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH) GROUP BY YEAR(created_at), MONTH(created_at)`),
            safeQuery(`SELECT YEAR(created_at) AS year, MONTH(created_at) AS month, COUNT(*) AS count FROM panelists WHERE deleted_at IS NULL AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH) GROUP BY YEAR(created_at), MONTH(created_at)`),
            safeQuery(`SELECT status, COUNT(*) AS total FROM clients GROUP BY status`),
            safeQuery(`SELECT status, COUNT(*) AS total FROM partners WHERE deleted_at IS NULL GROUP BY status`),
            safeQuery(`SELECT
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
                SUM(CASE WHEN transaction_type = 'debit' THEN reward_points ELSE 0 END) AS total_redeemed_points,
                COUNT(*) AS total_requests
             FROM reward_history`),
            safeQuery(`SELECT YEAR(created_at) AS year, MONTH(created_at) AS month, SUM(CASE WHEN transaction_type = 'debit' THEN reward_points ELSE 0 END) AS count FROM reward_history WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH) GROUP BY YEAR(created_at), MONTH(created_at)`)
        ]);

        const surveyStatusMap = { active: 0, closed: 0, draft: 0, paused: 0 };
        (surveyStatusRows || []).forEach(r => {
            const key = String(r.status || '').toLowerCase();
            if (key in surveyStatusMap) surveyStatusMap[key] = Number(r.total);
        });

        const rfqStatusMap = { won: 0, lost: 0, pending: 0 };
        (rfqStatusRows || []).forEach(r => {
            const key = String(r.rfq || '').toLowerCase();
            if (key in rfqStatusMap) rfqStatusMap[key] = Number(r.total);
        });

        const rewardSummary = (rewardSummaryRows && rewardSummaryRows[0]) || {};

        const clientActive = (clientStatusRows || []).find(r => r.status === 'active');
        const clientInactive = (clientStatusRows || []).filter(r => r.status !== 'active').reduce((s, r) => s + Number(r.total), 0);

        const partnerActive = (partnerStatusRows || []).find(r => r.status === 'active');
        const partnerInactive = (partnerStatusRows || []).filter(r => r.status !== 'active').reduce((s, r) => s + Number(r.total), 0);

        return res.status(200).json({
            success: true,
            data: {
                totals: {
                    total_users: Number(totalUsersRow?.[0]?.total || 0),
                    total_clients: Number(totalClientsRow?.[0]?.total || 0),
                    total_partners: Number(totalPartnersRow?.[0]?.total || 0),
                    total_project_managers: Number(totalPMRow?.[0]?.total || 0)
                },
                survey: {
                    status_distribution: surveyStatusMap,
                    trend_last_12_months: fillMonthlyTrend(surveyTrendRows)
                },
                rfq: {
                    status_overview: rfqStatusMap,
                    trend_last_12_months: fillMonthlyTrend(rfqTrendRows)
                },
                user_growth: {
                    trend_last_12_months: fillMonthlyTrend(userGrowthRows),
                    by_country: [
                        { country: 'Unknown', total: Number(totalUsersRow?.[0]?.total || 0) }
                    ]
                },
                revenue: {
                    total_revenue: 0,
                    monthly_revenue: 0,
                    pending_invoice_amount: 0,
                    paid_invoice_amount: 0,
                    invoice_status_distribution: { paid: 0, pending: 0, overdue: 0 }
                },
                clients_overview: {
                    total: Number(totalClientsRow?.[0]?.total || 0),
                    active: clientActive ? Number(clientActive.total) : 0,
                    inactive: clientInactive
                },
                partners_overview: {
                    total: Number(totalPartnersRow?.[0]?.total || 0),
                    active: partnerActive ? Number(partnerActive.total) : 0,
                    inactive: partnerInactive
                },
                reward_statistics: {
                    pending_rewards: Number(rewardSummary.pending_count || 0),
                    completed_rewards: Number(rewardSummary.completed_count || 0),
                    total_redeemed_points: Number(rewardSummary.total_redeemed_points || 0),
                    total_reward_requests: Number(rewardSummary.total_requests || 0),
                    redemption_trend_last_12_months: fillMonthlyTrend(rewardTrendRows)
                }
            }
        });
    } catch (error) {
        console.error('DASHBOARD SUMMARY ERROR:', error);
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};