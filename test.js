/*
 *  test data
 */

const init_time = Date.now()

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

import { customAlphabet } from 'nanoid';
export function generateId(prefix, length=16) {
    const nanoid = customAlphabet("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz");
    return [prefix, nanoid(16)].join("_");
}


await db.query(`DELETE FROM job_records`)
await db.query(`DELETE FROM jobs`)

await db.query(
    "INSERT INTO jobs (id, tldr, status, parent_id) VALUES ($1, $2, $3, $4)", [
    generateId("job"),
    "create an upnorth video about fitness",
    "pending",
    null,
])

process.exit(0)