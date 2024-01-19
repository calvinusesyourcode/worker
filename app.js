const init_time = Date.now();

import fs from 'fs';
import path from 'path';
import async from 'async';
import url from 'url';
import util from 'util';

import dotenv from 'dotenv';
dotenv.config();
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import pg from "pg";
const { Client } = pg;
import csv from 'fast-csv';

import { customAlphabet } from "nanoid";
import OpenAI from "openai";
const openai = new OpenAI(process.env.OPENAI_API_KEY);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/*
 *  
 *      A distant planet beckons you... 
 * 
 *      Find the future and yourself....
 * 
 * 
 *     █     █░ ▒█████   ██▀███   ██ ▄█▀▓█████  ██▀███  
 *    ▓█░ █ ░█░▒██▒  ██▒▓██ ▒ ██▒ ██▄█▒ ▓█   ▀ ▓██ ▒ ██▒
 *    ▒█░ █ ░█ ▒██░  ██▒▓██ ░▄█ ▒▓███▄░ ▒███   ▓██ ░▄█ ▒
 *    ░█░ █ ░█ ▒██   ██░▒██▀▀█▄  ▓██ █▄ ▒▓█  ▄ ▒██▀▀█▄  
 *    ░░██▒██▓ ░ ████▓▒░░██▓ ▒██▒▒██▒ █▄░▒████▒░██▓ ▒██▒
 *    ░ ▓░▒ ▒  ░ ▒░▒░▒░ ░ ▒▓ ░▒▓░▒ ▒▒ ▓▒░░ ▒░ ░░ ▒▓ ░▒▓░
 *      ▒ ░ ░    ░ ▒ ▒░   ░▒ ░ ▒░░ ░▒ ▒░ ░ ░  ░  ░▒ ░ ▒░
 *      ░   ░  ░ ░ ░ ▒    ░░   ░ ░ ░░ ░    ░     ░░   ░ 
 *        ░        ░ ░     ░     ░  ░      ░  ░   ░     
 * 
 * 
 *      v0.0.1--broken
 * 
 * 
*/

const test = true;
let pause = false;

const db = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
}); await db.connect();


// TODO: use ai to only write these in one place, the tables.sql file
const feature_status = ['wishlist', 'todo', 'development', 'alpha', 'beta', 'production']
const job_status = ['scheduled', 'running', 'ongoing', 'reoccuring', 'completed', 'failed', 'cancelled', 'paused']
const user_file_roles = ['owner', 'admin', 'editor', 'viewer']


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
const transaction = async (task) => {
    await db.query('BEGIN');
    try {
        await task();
        await db.query('COMMIT');
    } catch (error) {
        await db.query('ROLLBACK');
        throw (error);
    }
};
async function punchcard(job, new_status, { type, tldr, message, json }) {
    log(`> ${job.id} :: ${job.status} => ${new_status}`)
    const record_id = generateId("txt");
    await transaction(async () => {
        if (new_status) {
            await db.query(
                `UPDATE jobs SET status = ? WHERE id = ?`,
                [new_status, job.id]
            );
        };
        await db.query(
            `INSERT INTO records (id, datetime, type, tldr, message, json) VALUES ($1, $2, $3, $4, $5, $6)`,
            [record_id, Date.now(), type, tldr, message, JSON.stringify(json)]
        );
        await db.query(
            `INSERT INTO job_records (job_id, record_id) VALUES ($1, $2)`,
            [job.id, record_id]
        );
    });
    return record_id;
}




// helpers
function log(message) {
    console.log(message);
}
async function logRecords() {
    const records = (await db.query('SELECT * FROM records')).rows;
    
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
// TODO: replace
// function addJob(tldr) {
//     data["jobs"].push({
//         id: generateId("job"),
//         tldr: tldr,
//         status: "pending",
//     });
// }
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

/*
 *
 *                                                .::            .::                               .::           .::  
 *                                                .::           .::         .::                    .::            .:: 
 *    .::     .:::        .::         .: .:::     .::  .::     .::                     .::         .::             .::
 *     .::  :  .::      .::  .::       .::        .:: .::      .::          .::      .::  .::      .:: .::         .::
 *     .:: .:  .::     .::    .::      .::        .:.::        .::          .::     .::    .::     .::   .::       .::
 *     .: .: .:.::      .::  .::       .::        .:: .::       .::         .::      .::  .::      .::   .::      .:: 
 *    .:::    .:::        .::         .:::        .::  .::       .::        .::        .::         .:: .::       .::  
 *                                                                       .:::                                         
 * 
 *      Invent a soul for the machine. Choose your narrator.
 *      
 *      How much untapped alpha is there in simply "thinking differently"?
 * 
 * 
 **/
/** @param {Job} job */
async function work(job) {
    
    await punchcard(job, "working",
    record={
        type: "debug",
        tldr: `> ${job.id}`,
        message: `working on job:: ${job.tldr}`,
        json: {},
    });
    
    if (job.tldr.includes("{{")) {
        let [action, tldr] = job.tldr.split("{{")[1].split("}}");
        let actions = (await db.query("SELECT * FROM actions")).rows.map((action) => action.tldr);

        if (action in actions) {
            await punchcard(job, null,
            record={
                type: "action_input",
                tldr: ``,
                message: `found action:: ${action}`,
                json: {
                    action: action,
                    input: tldr,
                },
            });
            await db.query(`INSERT INTO jobs (id, tldr, status, parent_id) VALUES ($1, $2, $3, $4)`, [
                generateId("job"),
                tldr,
                "pending",
                job.id,
            ]); 
        }
    }

    let threadId;

    let prompt = `# Compute Architecture Initial Path Selection
Return ONLY the index of the next step you select.

# History of current task:
${
    (await db.query(`
        SELECT tldr, message FROM records
        INNER JOIN job_records ON job_records.record_id = records.id
        WHERE job_records.job_id = ?
        LIMIT 10
        ORDER BY datetime DESC
    `, [job.id]))
    .rows
    .slice(0,10)
    .map((record) => `##${record.tldr}\n${record.message}`).join("\n\n")
}

# Overarching goals:
${
    (await db.query(`
        SELECT tldr FROM goals
        INNER JOIN job_goals ON job_goals.goal_id = goals.id
        WHERE job_goals.job_id = ?
    `, [job.id]))
    .rows
    .map((record) => `- ${record.tldr}`).join("\n")
}

# Potential next steps:
${
    ([
        "Brainstorm",
        "Create ",
        "write",
        "edit",
    ])
    .map((i, step) => `${i}. ${step}`).join("\n")
}

`;
    let run = (await createAndRun([{ role: "user", content: prompt }]))
    do {

        const runId = run.id
        threadId = run.thread_id

        run = await waitOnRun(threadId, runId)
        log(`>>> ${run.id} finished with status ${run.status}`)
        let reply = await latestMessage(threadId)
        console.log(reply)
        

    } while (true)
}

if (test) {

    for (let table of fs.readFileSync(path.join(__dirname, 'tables.sql'), 'utf8').split("---table_separator---")) {
        await db.query(`DROP TABLE IF EXISTS ${table.split("TABLE IF NOT EXISTS ")[1].split(" ")[0]} CASCADE`)
        await db.query(table)
        console.log(`> created table ${table.split("TABLE IF NOT EXISTS ")[1].split(" ")[0]}`)
    }
    
    await db.query("DELETE FROM jobs")
    await db.query("DELETE FROM records")
    await db.query("DELETE FROM projects")
    await db.query("DELETE FROM variables")
    await db.query("DELETE FROM actions")


    await db.query(
        "INSERT INTO projects (id) VALUES ($1)", [
        "upnorth",
    ])

    await db.query(
        "INSERT INTO variables (id, value) VALUES ($1, $2)", [
        "ELEVENLABS-UPNORTH-JEREYMI-2",
        "localenv",
    ])

    await db.query(
        "INSERT INTO actions (id, tldr, input, output) VALUES ($1, $2, $3, $4)", [
        "post_video",
        "natural language to video",
        JSON.stringify({
            destinationUserAccount: "saturn",
        }),
        JSON.stringify({
            fileType: "mp4",
        }),
    ])

    await db.query(
        "INSERT INTO jobs (id, tldr, status, parent_id) VALUES ($1, $2, $3, $4)", [
        generateId("job"),
        "write an html canvas pong game",
        "pending",
        null,
    ])
    await db.query(
        "INSERT INTO jobs (id, tldr, status, parent_id) VALUES ($1, $2, $3, $4)", [
        generateId("job"),
        "",
        "pending",
        null,
    ])
    await db.query(
        "INSERT INTO jobs (id, tldr, status, parent_id) VALUES ($1, $2, $3, $4)", [
        generateId("job"),
        "generate some ideas for improving my business",
        "pending",
        null,
    ])

    console.log(
        (await db.query("SELECT * FROM jobs")).rows
    )


    console.log(Date.now() - init_time)

    process.exit(0);

}

/*
 *
 *                                           .::                      .::       .::                                .::  
 *                     .::           .:      .::                     .::        .::                                 .:: 
 *    .::     .:::     .::                   .::        .::         .::       .:.: .:.: .:::.::  .::   .::           .::
 *     .::  :  .::     .: .:        .::      .::      .:   .::      .::         .::   .::   .::  .:: .:   .::        .::
 *     .:: .:  .::     .::  .::     .::      .::     .::::: .::     .::         .::   .::   .::  .::.::::: .::       .::
 *     .: .: .:.::     .:   .::     .::      .::     .:              .::        .::   .::   .::  .::.:              .:: 
 *    .:::    .:::     .::  .::     .::     .:::       .::::          .::        .:: .:::     .::.::  .::::        .::  
 *                                     
 * 
 *      Like breathing, some processes are continuous.
 *      
 *      Ebb and flow with the tides of time. Ride the waves.
 *
 *
 *
 */
while (true) {
    log("> checking for new jobs")
    for (let job of (await db.query("SELECT * FROM jobs").rows)) {
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