const init_time = Date.now();

import fs from 'fs';
import path from 'path';
import util from 'util';
import child_process from 'child_process';
import dotenv from 'dotenv';
import pg from "pg";
import csv from 'fast-csv';
import { customAlphabet } from "nanoid";
import OpenAI from "openai";

dotenv.config();
const { Client } = pg;
const __dirname = path.resolve();
const openai = new OpenAI(process.env.OPENAI_API_KEY);
const exec = util.promisify(child_process.exec);

import { jumpToCloud } from './_firebase.js';
import { post_reel_to_instagram } from './_facebook.js';



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


export const db = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
}); await db.connect();

const utilities = JSON.parse(fs.readFileSync(path.join(__dirname, 'tools.json'), 'utf8'))



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
    log(`   ######## PUNCHCARD ########`)
    log(`> ${job.id} :: ${job.status} => ${new_status}`)
    log(`> ${type} :: ${tldr} :: ${message}`)
    log(JSON.stringify(json, null, 2))
    log(`   ###########################`)
    const record_id = generateId("txt");
    await transaction(async () => {
        if (new_status) {
            await db.query(
                `UPDATE jobs SET status = $1 WHERE id = $2`,
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
export function generateId(prefix, length=16) {
    const nanoid = customAlphabet("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz");
    return [prefix, nanoid(16)].join("_");
}
async function handoff(function_name, kwargs) {
    const { job, call_id } = kwargs
    await punchcard(job, "waiting", {
        type: "debug",
        tldr: `${job.id} => ${call_id}`,
        message: `${function_name}`,
        json: {},
    });
    // const args = JSON.parse(call.function.arguments)
    //                 switch (call.function.name) {
        //                     case "create_video":
        //                         const { project, prompt } = JSON.parse(call.function.arguments)
        //                             // TODO: add retrying
        //                             return
        //                         }
        //                         await punchcard(job, null, {
            //                             type: "progress",
            //                             tldr: `> ${call.function.name}`,
            //                             message: `${project} :: ${prompt}`,
        //                             json: {},
        //                         });
    switch (function_name) {

        case "create_video":

            const pythonFile = "C:/Users/calvi/3D Objects/pipe/main.py";
            const { project, prompt } = kwargs;

            if (!project || !prompt) {
                await punchcard(job, null, {
                    type: "error",
                    tldr: `${function_name} failed`,
                    message: `missing ${(!project && !prompt) ? "both args" ? project : "project" : "prompt" } for ${call.function.name}`,
                    json: {},
                });
                return;
            }
            await work({
                id: generateId("job"),
                tldr: `create video for ${project} :: ${prompt}`,
                status: "working",
                parent_id: job.id,
            })


            let videoPath;
            try {
                const { stdout, stderr } = await exec(
                    `python "${pythonFile}" --prompt "${prompt}"`,
                    {cwd: path.dirname(pythonFile), stdio: 'inherit'}
                );
                
                if (stdout.includes("OUTPUT==")) {
                    console.log("OUTPUT FOUND");
                    videoPath = stdout.split("OUTPUT==")[1].split("==OUTPUT")[0].trim();
                }

            } catch (error) {
                console.error(error);
                await punchcard(job, null, {
                    type: "error",
                    tldr: `${function_name} failed`,
                    message: `error running ${pythonFile} --prompt "${prompt}": ${error}`,
                    json: {},
                });
            }
            console.log(`VIDEO PATH!!!!!!!!!: ${videoPath}`);

            await punchcard(job, null, {
                type: "progress",
                tldr: `created video`,
                message: `${project} :: ${prompt}`,
                json: {},
            });

            const videoUrl = await jumpToCloud(videoPath, null, {contentType: 'video/mp4'});
            console.log(`VIDEO URL!!!!!!!!!: ${videoUrl}`);

            break
        
        case "post_video":
            let { instagram, youtube, facebook, tiktok, url, caption } = kwargs;
            const instagram_business_id = "17841405385959097"
            if (!url) {
                await punchcard(job, null, {
                    type: "error",
                    tldr: `${function_name} failed`,
                    message: `missing url for ${function_name}`,
                    json: {},
                });
                return;
            }
            if (instagram) {
                let accessToken;
                try {
                    const pythonFile = "C:/Users/calvi/3D Objects/gui/main.py"
                    const { stdout, stderr } = await exec(
                        `python "${pythonFile}"`,
                        {cwd: path.dirname(pythonFile), stdio: 'inherit'}
                    );
                    if (stdout.includes("OUTPUT==")) {
                        console.log("OUTPUT FOUND");
                        accessToken = stdout.split("OUTPUT==")[1].split("==OUTPUT")[0].trim();
                    }

                } catch (error) {
                    console.error(error);
                    await punchcard(job, null, {
                        type: "error",
                        tldr: `${function_name} failed`,
                        message: `error running ${pythonFile}: ${error}`,
                        json: {},
                    });
                }
                await post_reel_to_instagram(accessToken, instagram_business_id, url, caption);
            }
            if (youtube) {
                if (caption.length > 40) {
                    caption = one_shot(
                        `Return this caption "${caption}" modified to be less than 40 characters. NOTHING ELSE. NO EXTRA SYNTAX. JUST THE UPDATED CAPTION.`,
                        {model: "gpt-4-1106-preview", max_tokens: 30, temperature: 0.5}
                    )
                }
                try {
                    fetch(
                        "https://script.google.com/macros/s/AKfycbyiVEZ0jRLfNLraT4E58ObHMjOL_AwbdKdHfIu_4OWIlB-ynT6U5gSQT1aBzaGfvR2y/exec",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                video_url: url,
                                short_description: caption,
                            }),
                        }
                    )
                } catch (error) {
                    console.error(error);
                    await punchcard(job, null, {
                        type: "error",
                        tldr: `${function_name} failed`,
                        message: `error posting to youtube: ${error}`,
                        json: {},
                    });
                }
            }

            break
        default:
            await punchcard(job, null, {
                type: "error",
                tldr: `${function_name} failed`,
                message: `function ${function_name} not found`,
                json: {},
            });
            return;
    }
    await punchcard(job, null, {
        type: "debug",
        tldr: `${function_name} completed`,
        message: `of ${job.id} => ${call_id}`,
        json: {},
    });
}
function one_shot(prompt, kwargs={model: "gpt-4-1106-preview", max_tokens: 64, temperature: 0.5}) {
    return openai.chat.completions.create({ prompt: prompt, ...kwargs }).choices[0].text;
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
async function createAndRun(messages, asst_id, model="gpt-4-1106-preview", tools=null, instructions=null) {
    const run = await openai.beta.threads.createAndRun({
        assistant_id: asst_id,
        thread: { messages: messages },
        model: model,
        tools: tools,
        instructions: instructions,
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
    
    await punchcard(job, "working", {
        type: "debug",
        tldr: `> ${job.id}`,
        message: `working on job:: ${job.tldr}`,
        json: {},
    });
    
    // if (job.tldr.includes("{{")) {
    //     let [action, tldr] = job.tldr.split("{{")[1].split("}}");
    //     let actions = (await db.query("SELECT * FROM actions")).rows.map((action) => action.tldr);

    //     if (action in actions) {
    //         await punchcard(job, null,
    //         record={
    //             type: "action_input",
    //             tldr: ``,
    //             message: `found action:: ${action}`,
    //             json: {
    //                 action: action,
    //                 input: tldr,
    //             },
    //         });
    //         await db.query(`INSERT INTO jobs (id, tldr, status, parent_id) VALUES ($1, $2, $3, $4)`, [
    //             generateId("job"),
    //             tldr,
    //             "pending",
    //             job.id,
    //         ]); 
    //     }
    // }

    let threadId;

    let history = (
        await db.query(`
            SELECT tldr, message FROM records
            INNER JOIN job_records ON job_records.record_id = records.id
            WHERE job_records.job_id = $1 AND type != 'debug'
            ORDER BY datetime DESC
            LIMIT 10
        `, [job.id]))
        .rows
        .slice(0,10)
        .map((row) => `##${row.tldr}\n${row.message}`)

    let goals = (
        await db.query(`
            SELECT tldr FROM goals
            INNER JOIN job_goals ON job_goals.goal_id = goals.id
            WHERE job_goals.job_id = $1
        `, [job.id]))
        .rows
        .map((row) => `- ${row.tldr}`)

    let actions = (
        await db.query(`
            SELECT id, tldr FROM actions
        `))
        .rows
        .map((row, i) => `${i}. ${row.id} (${row.tldr})`)

    let prompt = ""
    prompt += `# Current job:\n${job.tldr}\n\n`
    prompt += `${ history.length > 0 ? `# Job history:\n${history.join("\n")}\n\n` : "" }`
    prompt += `${ goals.length > 0 ? `# Overarching goals:\n${goals.join("\n")}\n\n` : "" }`
    prompt += `${ actions.length > 0 ? `# Actions:\n${actions.join("\n")}\n\n` : "" }`
    prompt += `# Return value:\n`
    prompt += `Call a function or brainstorm\n`

    let run = (await createAndRun(
        [{ role: "user", content: prompt }],
        "asst_rhmXsyeXVrfisVnu34zd2AsD",
        "gpt-4-1106-preview",
        utilities,
    ))

    const runId = run.id
    threadId = run.thread_id

    console.log(threadId)
    run = await waitOnRun(threadId, runId)
    log(`>>> ${run.id} finished with status ${run.status}`)
    if (run.status == "requires_action") {
        console.log(">> requires action")
        for (let call of run.required_action.submit_tool_outputs.tool_calls) {
            console.log(`>> ${call.id}`)
            console.log(JSON.stringify(call, null, 2))
            if (call.type == "function") {
                console.log(`calling ${call.function.name}`)
                await handoff(call.function.name, {
                    ...JSON.parse(call.function.arguments),
                    job: job,
                    call_id: call.id
                })
            }
        }
    }

    let reply = await latestMessage(threadId)
    console.log(reply)
    const messagesList = (await listMessages(threadId))["data"]
    for (let message of messagesList) {
        console.log(message.content)
    }
    return
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
    for (let job of (await db.query("SELECT * FROM jobs WHERE status = 'pending' AND parent IS NULL")).rows) {
        setTimeout(async () => await work(job), 100)
    }
    await logRecords();
    await sleep(10000);
}































