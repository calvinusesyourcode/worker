/*
 *  test data
 */

const init_time = Date.now()

import pgPromise from 'pg-promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
import { db } from './app.js';

import { customAlphabet } from 'nanoid';
export function generateId(prefix, length=16) {
    const nanoid = customAlphabet("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz");
    return [prefix, nanoid(16)].join("_");
}

// await db.none(`INSERT INTO orgs (id) VALUES ($1)`, [
//     "upnorth",
// ])

// await db.none(`INSERT INTO projects (org_id, id, tldr) VALUES ($1, $2, $3)`, [
//     "upnorth",
//     "content",
//     "social media videos, photos, blogs, etc"
// ])

await db.none(`DELETE FROM job_records`)
await db.none(`DELETE FROM records`)
await db.none(`DELETE FROM jobs`)
console.log("3")
await db.none(
    `INSERT INTO jobs (id, tldr, status, org_id, project_id) 
    VALUES ($[id], $[tldr], $[status], $[org_id], $[project_id])`, {
        id: generateId("job"),
        tldr: "create an upnorth video about fitness",
        status: "pending",
        org_id: "upnorth",
        project_id: "content"
    });
    console.log("4")

process.exit(0)