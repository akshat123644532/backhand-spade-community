const getScamalyticsData = async (ip) => {
    if (!ip) return null;

    const username = process.env.SCAMALYTICS_USERNAME;
    const apiKey = process.env.SCAMALYTICS_API_KEY;
    const baseUrl = process.env.SCAMALYTICS_BASE_URL;

    if (!username || !apiKey || !baseUrl) {
        return null;
    }

    try {
        const url = new URL(`${baseUrl}/${username}`);

        url.searchParams.set('key', apiKey);
        url.searchParams.set('ip', ip);

        const response = await fetch(url.toString());

        if (!response.ok) {
            return null;
        }

        const result = await response.json();

        return result?.scamalytics || result;
    } catch (error) {
        return null;
    }
};

export default getScamalyticsData;