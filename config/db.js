const mysql = require('mysql2');
require('dotenv').config();

if (!process.env.DB_PASSWORD) {
    console.error('ERROR: DB_PASSWORD is not defined in the .env file.');
    process.exit(1);
}

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'agro_nacional',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool.promise();
