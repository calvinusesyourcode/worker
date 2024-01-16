const init_time = Date.now();


import dotenv from 'dotenv';
dotenv.config();
import OpenAI from "openai";
const openai = new OpenAI(process.env.OPENAI_API_KEY);
import { customAlphabet } from "nanoid";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import async from 'async';
import util from 'util';
import csv from 'fast-csv';




const feature_status = ['wishlist', 'todo', 'development', 'alpha', 'beta', 'production']
const job_status = ['scheduled', 'running', 'ongoing', 'reoccuring', 'completed', 'failed', 'cancelled', 'paused']
const user_file_roles = ['owner', 'admin', 'editor', 'viewer']




const db = await open({
    filename: "./saturn.db",
    driver: sqlite3.Database
});

await db.exec(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'tables.sql'), 'utf8'));
console.log(await db.all("SELECT name, sql FROM sqlite_master WHERE type='table'"));




/** @typedef {Object} Job
 * @property {string} id - unique identifier
 * @property {string} tldr - description
 * @property {string} status    - adjective to describe state
 * @property {string|null} parent_id - id of parent job
 */

/** @typedef {Object} Record
 * @property {string} id        - unique identifier
 * @property {number} datetime  - Epoch time in milliseconds
 * @property {string} type      - Type of the record
 * @property {string} tldr      - Short summary
 * @property {string} message   - Detailed message
 * @property {Object} json      - JSON data
 */

/** @typedef {Object} RecordData
 * @property {string} type - Type of the record
 * @property {string} tldr - Short summary
 * @property {string} message - Detailed message
 * @property {Object} json - JSON data
 */

/** @typedef {Object} JobRecord
 * @property {string} job_id - id of job
 * @property {string} record_id - id of record
 */




const data = {
    jobs: /** @type {Job[]} */ ([]),
    records: /** @type {Record[]} */ ([]),
    job_records: /** @type {JobRecord[]} */ ({}),
    threads: /** @type {any[]} */ ([]) // Define the structure for threads if needed
};




// sql helpers
const transactionQueue = async.queue(async (task) => {
    await db.run('BEGIN TRANSACTION');
    try {
        await task();
        await db.run('COMMIT');
    } catch (error) {
        await db.run('ROLLBACK');
        throw new Error(error);
    }
}, 1);
async function punchcard(job, new_status, { type, tldr, message, json }) {
    log(`> ${job.id} :: ${job.status} => ${new_status}`)
    const record_id = generateId("txt");
    transactionQueue.push((async () => {
        await db.run(
            `UPDATE jobs SET status = ? WHERE id = ?`,
            [new_status, job.id]
        );
        await db.run(
            `INSERT INTO records (id, datetime, type, tldr, message, json) VALUES (?, ?, ?, ?, ?, ?)`,
            [record_id, Date.now(), type, tldr, message, JSON.stringify(json)]
        );
        await db.run(
            `INSERT INTO job_records (job_id, record_id) VALUES (?, ?)`,
            [job.id, record_id]
        );
    }), (error) => {
        if (error) {
            console.log(`! transaction failed for ${job.id} & ${record_id}`);
            console.log(error);
        } else {
            console.log(`> ${record_id} :: transaction complete`);
        }
    })
    return record_id;
}




// helpers
function log(message) {
    console.log(message);
}
async function logRecords() {
    const records = await db.all('SELECT * FROM records');
    
    const csvStream = csv.format({ headers: true });
    const writableStream = fs.createWriteStream("records.csv");

    // writableStream.on("finish", function(){
    //     console.log("DONE!");
    // });

    csvStream.pipe(writableStream);
    records.forEach(record => csvStream.write(record));
    csvStream.end();
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function addJob(tldr) {
    data["jobs"].push({
        id: generateId("job"),
        tldr: tldr,
        status: "pending",
    });
}
function generateId(prefix, length=16) {
    const nanoid = customAlphabet("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz");
    return [prefix, nanoid(16)].join("_");
}




// openai helpers
async function waitOnRun(threadId, runId) {
    let run = (await openai.beta.threads.runs.retrieve(threadId, runId))
    while (run.status === "queued" || run.status === "in_progress") {
        await sleep(3000);
        run = (await openai.beta.threads.runs.retrieve(threadId, runId))
    }
    return run
}
async function listMessages(threadId) {
    return (await openai.beta.threads.messages.list(threadId))
}
async function latestMessage(threadId) {
    const messagesList = (await listMessages(threadId))["data"]
    const messages = messagesList.sort((a, b) => a["created_at"] - b["created_at"]).map((msg) => msg["content"].map((content) => content["text"]["value"])).flat()
    return messages[messages.length - 1]
}
async function createThread(messages) {
    return (await openai.beta.threads.create({ messages: messages }))
}
async function startRun(threadId) {
    return (await openai.beta.threads.runs.create(threadId, { assistant_id: process.env.OPENAI_ASSISTANT_ID }))
}
async function createAndRun(messages) {
    const run = await openai.beta.threads.createAndRun({
        assistant_id: process.env.OPENAI_ASSISTANT_ID,
        thread: { messages: messages },
    })
    return run
}




/** @param {Job} job */
async function work(job) {
    await punchcard(job, "working", {
        type: "debug",
        tldr: `> ${job.id}`,
        message: `solving: ${job.tldr}`,
        json: {},
    })

    return

    let prompt = `Return a pseudocode plan for this job, "${job.tldr}"\n\n`;
    let run = (await createAndRun([{ role: "user", content: prompt }]))
    do {

        const runId = run.id
        const threadId = run.thread_id

        run = await waitOnRun(threadId, runId)
        log(`>>> ${run.id} finished with status ${run.status}`)
        let reply = await latestMessage(threadId)
        console.log(reply)
        

    } while (true)
}

// first pass
// data.jobs.push({
//     id: generateId("job"),
//     tldr: "write an html canvas pong game",
//     status: "pending",
//     parent: null,
// });
await db.run("DELETE FROM jobs")
await db.run("DELETE FROM records")
await db.run("INSERT INTO jobs (id, tldr, status, parent_id) VALUES (?, ?, ?, ?)", [
    generateId("job"),
    "write an html canvas pong game",
    "pending",
    null,
])
await db.run("INSERT INTO jobs (id, tldr, status, parent_id) VALUES (?, ?, ?, ?)", [
    generateId("job"),
    "write a video script about golfing in the desert",
    "pending",
    null,
])
await db.run("INSERT INTO jobs (id, tldr, status, parent_id) VALUES (?, ?, ?, ?)", [
    generateId("job"),
    "generate some ideas for improving my business",
    "pending",
    null,
])



console.log(Date.now() - init_time);

while (true) {
    log("> checking for new jobs")
    for (let job of (await db.all("SELECT * FROM jobs"))) {
        if (job.status == "pending" && job.parent == null) setTimeout(async () => await work(job), 100)
    }
    await logRecords();
    await sleep(10000);
}

// const threadId = "thread_6tzIb3gduz8c0qutilFu4kEI"
// const runId = "run_hb0pVEkdDMLeSG7W9Qxl6Qu4"
// const messagesList = (await listMessages(threadId))["data"]
// const messages = messagesList.sort((a, b) => a["created_at"] - b["created_at"]).map((msg) => msg["content"].map((content) => content["text"]["value"])).flat()
// for (let message of messages) {
//     console.log(message)
// }