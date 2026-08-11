
const escapeCsvValue = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};


export const buildCsv = (rows, columns) => {
    const header = columns.map((c) => escapeCsvValue(c.label)).join(',');
    if (!rows || !rows.length) return header + '\n';

    const body = rows
        .map((row) =>
            columns
                .map((c) => escapeCsvValue(typeof c.value === 'function' ? c.value(row) : row[c.key]))
                .join(',')
        )
        .join('\n');

    return header + '\n' + body;
};

export const sendCsv = (res, filename, csvContent) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.status(200).send('\uFEFF' + csvContent);
};