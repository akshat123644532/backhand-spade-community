export const getDeviceInfo = (userAgent = '') => {
    const ua = userAgent.toLowerCase();

    let browser = 'Unknown';
    let browser_version = null;

    if (ua.includes('edg/')) {
        browser = 'Edge';
        browser_version = userAgent.match(/Edg\/([\d.]+)/i)?.[1] || null;
    } else if (ua.includes('opr/')) {
        browser = 'Opera';
        browser_version = userAgent.match(/OPR\/([\d.]+)/i)?.[1] || null;
    } else if (ua.includes('chrome/')) {
        browser = 'Chrome';
        browser_version = userAgent.match(/Chrome\/([\d.]+)/i)?.[1] || null;
    } else if (ua.includes('firefox/')) {
        browser = 'Firefox';
        browser_version = userAgent.match(/Firefox\/([\d.]+)/i)?.[1] || null;
    } else if (ua.includes('safari/') && !ua.includes('chrome/')) {
        browser = 'Safari';
        browser_version = userAgent.match(/Version\/([\d.]+)/i)?.[1] || null;
    }

    let os = 'Unknown';
    let os_version = null;

    if (ua.includes('windows nt')) {
        os = 'Windows';

        const match = userAgent.match(/Windows NT ([\d.]+)/i);

        if (match) {
            const versions = {
                '10.0': '10/11',
                '6.3': '8.1',
                '6.2': '8',
                '6.1': '7'
            };

            os_version = versions[match[1]] || match[1];
        }
    } else if (ua.includes('android')) {
        os = 'Android';
        os_version = userAgent.match(/Android ([\d.]+)/i)?.[1] || null;
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
        os = 'iOS';

        const match = userAgent.match(/OS ([\d_]+)/i);

        if (match) {
            os_version = match[1].replace(/_/g, '.');
        }
    } else if (ua.includes('mac os x')) {
        os = 'macOS';

        const match = userAgent.match(/Mac OS X ([\d_]+)/i);

        if (match) {
            os_version = match[1].replace(/_/g, '.');
        }
    } else if (ua.includes('linux')) {
        os = 'Linux';
    }

    let device_type = 'Desktop';

    if (/mobile|iphone|android.*mobile/i.test(userAgent)) {
        device_type = 'Mobile';
    } else if (/ipad|tablet|android(?!.*mobile)/i.test(userAgent)) {
        device_type = 'Tablet';
    }

    let device_name = null;

    if (/iphone/i.test(userAgent)) {
        device_name = 'iPhone';
    } else if (/ipad/i.test(userAgent)) {
        device_name = 'iPad';
    } else if (/android/i.test(userAgent)) {
        device_name = 'Android Device';
    } else if (/windows/i.test(userAgent)) {
        device_name = 'Windows PC';
    } else if (/macintosh/i.test(userAgent)) {
        device_name = 'Mac';
    } else if (/linux/i.test(userAgent)) {
        device_name = 'Linux PC';
    }

    return {
        browser,
        browser_version,
        os,
        os_version,
        device_type,
        device_name
    };
};

export default getDeviceInfo;