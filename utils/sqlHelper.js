
export const buildUpdateQuery = (table, updateData, whereClause, whereParams = [], extraSql = '') => {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
    }

    if (fields.length === 0) {
        throw new Error("No fields provided to update!");
    }

    if (extraSql) {
        fields.push(extraSql);
    }

    const sql = `UPDATE ${table} SET ${fields.join(', ')} WHERE ${whereClause}`;
    return { sql, values: [...values, ...whereParams] };
};