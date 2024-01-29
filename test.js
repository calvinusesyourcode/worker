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

await db.none(`INSERT INTO orgs (id) VALUES ($1) ON CONFLICT DO NOTHING`, [
    "upnorth",
])

await db.none(`INSERT INTO projects (org_id, id, tldr) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [
    "upnorth",
    "content",
    "social media videos, photos, blogs, etc"
])

await db.none(`DELETE FROM job_records`)
await db.none(`DELETE FROM records`)
await db.none(`DELETE FROM jobs`)
await db.none(
    `INSERT INTO jobs (id, tldr, status, org_id, project_id, start_time) 
    VALUES ($[id], $[tldr], $[status], $[org_id], $[project_id], $[start_time])`, {
        id: generateId("job"),
        tldr: "create an upnorth video about fitness",
        status: "scheduled",
        org_id: "upnorth",
        project_id: "content",
        start_time: Date.now()/1000 + 10,
    });
    console.log("4")

process.exit(0)