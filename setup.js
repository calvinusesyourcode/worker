/*
 *  Setup the project once.
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


let pipeFolderId = generateId("folder");

await db.query(
    "INSERT INTO folders (id, name, type, cloud, root) VALUES ($1, $2, $3, $4, $5)", [
        pipeFolderId,
        "pipe",
        "repo",
        false,
        "C:/Users/calvi/3D Objects/pipe"
])

await db.query(
    "INSERT INTO files (id, type, extension, basename, folder_id, visibility) VALUES ($1, $2, $3, $4, $5, $6)", [
        "pipe",
        "script",
        "py",
        "main",
        pipeFolderId,
        "private",
])


// await db.query(
//     "INSERT INTO variables (id, value) VALUES ($1, $2)", [
//     "ELEVENLABS-UPNORTH-JEREYMI-2",
//     "localenv",
// ])


// await db.query(
//     "INSERT INTO jobs (id, tldr, status, parent_id) VALUES ($1, $2, $3, $4)", [
//     generateId("job"),
//     "create an upnorth video about fitness",
//     "pending",
//     null,
// ])

// console.log(
//     (await db.query("SELECT * FROM jobs")).rows
// )

console.log(`\n>> setup took ${Date.now() - init_time}\n`)
process.exit(0)