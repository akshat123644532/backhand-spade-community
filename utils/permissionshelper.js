// admins.permissions column me base64(JSON string) store hota hai:
// [{ module, read, write, csv_download }, ...]

export const decodePermissions = (permissionsBase64) => {
    if (!permissionsBase64) return [];
    try {
        const jsonStr = Buffer.from(permissionsBase64, 'base64').toString('utf8');
        const parsed = JSON.parse(jsonStr);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
};

export const hasDownloadAccess = (permissionsBase64, moduleName) => {
    const permissions = decodePermissions(permissionsBase64);
    const modulePerm = permissions.find(
        (p) => (p.module || '').toLowerCase() === (moduleName || '').toLowerCase()
    );
    return !!(modulePerm && modulePerm.csv_download);
};