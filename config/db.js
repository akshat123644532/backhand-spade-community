import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection fail:', err.message);
    } else {
        console.log('Live MySQL Database Connected.');
        connection.release();
    }
});

console.log('SCAMALYTICS_USERNAME:', process.env.SCAMALYTICS_USERNAME);
console.log('SCAMALYTICS_API_KEY:', process.env.SCAMALYTICS_API_KEY);
console.log('SCAMALYTICS_BASE_URL:', process.env.SCAMALYTICS_BASE_URL);
console.log('SCAMALYTICS_TEST_MODE:', process.env.SCAMALYTICS_TEST_MODE);   
export const db = pool.promise();
