import { db } from './config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const insertCountries = async () => {
    try {
        const filePath = path.join(__dirname, 'country1.json');
        const countries = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        console.log(`Total countries found: ${countries.length}`);

        // Table create karo agar exist nahi karta
        await db.execute(`
            CREATE TABLE IF NOT EXISTS countries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                country_id INT NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                iso2 VARCHAR(5) DEFAULT NULL,
                iso3 VARCHAR(5) DEFAULT NULL,
                calling_code VARCHAR(20) DEFAULT NULL
            )
        `);
        console.log('Table ready!');

        // Ek ek karke insert karo
        let success = 0;
        let skipped = 0;

        for (const country of countries) {
            try {
                await db.execute(
                    `INSERT IGNORE INTO countries (country_id, name, iso2, iso3, calling_code) VALUES (?, ?, ?, ?, ?)`,
                    [
                        country.country_id,
                        country.name,
                        country.iso2 || null,
                        country.iso3 || null,
                        country.calling_code || null
                    ]
                );
                success++;
            } catch (err) {
                console.log(`Skipped: ${country.name} — ${err.message}`);
                skipped++;
            }
        }

        console.log(`✅ Inserted: ${success}`);
        console.log(`⏭️  Skipped: ${skipped}`);
        console.log('Done!');
        process.exit(0);

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

insertCountries();