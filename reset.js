/*
 *  WARN: 
 *  This file will reset your database specified in ./app.js
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';


dotenv.config();
const db = new pg.Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
}); await db.connect();


const tables = fs.readFileSync(path.join(path.resolve(), 'tables.sql'), 'utf8').split("---table_separator---")
for (let table of tables) {
    const tablename = table.split("TABLE IF NOT EXISTS ")[1].split(" ")[0]
    try {
        await db.query(`DROP TABLE IF EXISTS ${tablename} CASCADE`)
    } catch (e) {
        console.log(`> did not drop table ${tablename}`)
    }
    await db.query(table)
    console.log(`> created table ${tablename}`)
}

process.exit(0)
