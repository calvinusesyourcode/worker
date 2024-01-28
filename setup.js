/*
 *  Setup the project once.
 */

const init_time = Date.now()

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
import pgPromise from 'pg-promise';
const db = pgPromise()({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
});

import { customAlphabet } from 'nanoid';
export function generateId(prefix, length=16) {
    const nanoid = customAlphabet("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz");
    return [prefix, nanoid(16)].join("_");
}


let pipeFolderId = generateId("folder");

await db.none(
    `INSERT INTO folders (id, name, type, cloud, root) 
    VALUES ($[id], $[name], $[type], $[cloud], $[root])`, {
        id: pipeFolderId,
        name: "pipe",
        type: "repo",
        cloud: false,
        root: "C:/Users/calvi/3D Objects/pipe"
});

await db.none(
    `INSERT INTO files (id, type, extension, basename, folder_id, visibility) 
    VALUES ($[id], $[type], $[extension], $[basename], $[folder_id], $[visibility])`, {
        id: "pipe",
        type: "script",
        extension: "py",
        basename: "main",
        folder_id: pipeFolderId,
        visibility: "private",
});


// await db.none(
//     "INSERT INTO variables (id, value) VALUES ($1, $2)", [
//     "ELEVENLABS-UPNORTH-JEREYMI-2",
//     "localenv",
// ])


// await db.none(
//     "INSERT INTO jobs (id, tldr, status, parent_id) VALUES ($1, $2, $3, $4)", [
//     generateId("job"),
//     "create an upnorth video about fitness",
//     "pending",
//     null,
// ])

// console.log(
//     (await db.any("SELECT * FROM jobs")).rows
// )

console.log(`\n>> setup took ${Date.now() - init_time}\n`)
process.exit(0)