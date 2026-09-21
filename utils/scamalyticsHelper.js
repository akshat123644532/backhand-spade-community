const USERNAME = process.env.SCAMALYTICS_USERNAME;
const API_KEY = process.env.SCAMALYTICS_API_KEY;
const BASE_URL =
    process.env.SCAMALYTICS_BASE_URL || 'https://api11.scamalytics.com/v3';

const TEST_MODE =
    String(process.env.SCAMALYTICS_TEST_MODE || 'false') === 'true';

export const checkIpFraud = async (ip) => {
    if (!ip) {
        return {
            ip: null,
            status: 'error',
            error_message: 'No IP provided'
        };
    }

    const url = new URL(`${BASE_URL}/${USERNAME}`);

    url.searchParams.set('key', API_KEY);
    url.searchParams.set('ip', ip);

    if (TEST_MODE) {
        url.searchParams.set('test', '1');
    }

    try {
        const controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, 5000);

        const res = await fetch(url.toString(), {
            signal: controller.signal
        });

        clearTimeout(timeout);

        const data = await res.json();

        const s = data?.scamalytics;
        const geo = data?.external_datasources?.maxmind_geolite2 || {};

        if (!s || s.status !== 'ok') {
            return {
                ip,
                status: 'error',
                error_message: s?.error || `HTTP ${res.status}`,
                raw_response: data || null
            };
        }

        return {
            ip,
            status: 'ok',
            error_message: null,

            scamalytics_score: s.scamalytics_score ?? null,
            scamalytics_risk: s.scamalytics_risk ?? null,
            scamalytics_url: s.scamalytics_url ?? null,

            scamalytics_isp: s.scamalytics_isp ?? null,
            scamalytics_org: s.scamalytics_org ?? null,

            scamalytics_isp_score: s.scamalytics_isp_score ?? null,
            scamalytics_isp_risk: s.scamalytics_isp_risk ?? null,

            is_datacenter:
                s.scamalytics_proxy?.is_datacenter ?? null,

            is_vpn:
                s.scamalytics_proxy?.is_vpn ?? null,

            is_resproxy:
                s.scamalytics_proxy?.is_resproxy ?? null,

            is_apple_icloud_private_relay:
                s.scamalytics_proxy?.is_apple_icloud_private_relay ?? null,

            is_amazon_aws:
                s.scamalytics_proxy?.is_amazon_aws ?? null,

            is_google:
                s.scamalytics_proxy?.is_google ?? null,

            is_blacklisted_external:
                s.is_blacklisted_external ?? null,

            ip_country_code:
                geo.ip_country_code || null,

            ip_country_name:
                geo.ip_country_name || null,

            ip_state_name:
                geo.ip_state_name || null,

            ip_city:
                geo.ip_city || null,

            ip_time_zone:
                geo.ip_time_zone || null,

            credits_remaining:
                s.credits?.remaining ?? null,

            raw_response: data
        };
    } catch (err) {
        return {
            ip,
            status: 'error',
            error_message:
                err.name === 'AbortError'
                    ? 'Scamalytics request timed out'
                    : err.message,
            raw_response: null
        };
    }
};

export default {
    checkIpFraud
};