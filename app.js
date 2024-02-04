const init_time = Date.now();

import fs from 'fs';
import path from 'path';
import util from 'util';
import url from 'url';
import child_process from 'child_process';
import dotenv from 'dotenv';
import pg from 'pg';
import pgPromise from 'pg-promise';
import csv from 'fast-csv';
import { customAlphabet } from 'nanoid';
import OpenAI from 'openai';
import chalk from 'chalk';

const __filename = url.fileURLToPath(new URL(import.meta.url));
const __dirname = path.dirname(__filename);
const openai = new OpenAI(process.env.OPENAI_API_KEY);
export const exec = util.promisify(child_process.exec);

import { jumpToCloud } from './_firebase.js';
import { post_reel_to_instagram } from './_facebook.js';



/*
*  
*      A distant planet beckons you... 
* 
*      Find the future and yourself..
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
*       v0.0.22--broken
*        
*       CHANGELOG:
*       - imports :: pg => pgPromise
* 
* 
* 
*/

dotenv.config();
const test = true;
let pause = false;

const SUPERVISOR_SLEEP = 1000*10;
const LOGGER_SLEEP = 1000*60*60*2;
const MANAGER_SLEEP = 1000*60*30;



export const db = pgPromise()({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
});

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
export async function punchcard(job, new_status, { type, tldr, message, json }) {
    log('info', `PUNCH :: ${job.id} :: ${job.status} => ${new_status} :: ${tldr} :: ${message} :: ${JSON.stringify(json)}`)
    const record_id = generateId('txt');
    await db.tx(async t => {
        await t.none(
            `INSERT INTO records (id, datetime, type, tldr, message, json, job_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [record_id, Date.now(), type, tldr, message, JSON.stringify(json), job.id]
        );
        if (new_status) {
            await t.none(
                `UPDATE jobs SET status = $1 WHERE id = $2`,
                [new_status, job.id]
            );
        };
    });
    return record_id;
}
export async function punch(job, new_status, level, message) {
    log(level, `PUNCH :: ${job.id} :: ${job.status} => ${new_status} :: ${message}`)
    await db.tx(async t => {

        await t.none(
            `INSERT INTO records (id, datetime, type, message, job_id)
            VALUES ($[id], $[datetime], $[type], $[message], $[job_id])`, {
                id: generateId('txt'),
                datetime: Date.now(),
                type: level,
                message: message,
                job_id: job.id
        });

        await t.none(
            `INSERT INTO records (id, datetime, type, message, job_id)
            VALUES ($1, $2, $3, $4, $5)`, [
                generateId('txt'),
                Date.now(),
                level,
                message,
                job.id
        ]);

        await t.none(`INSERT INTO records (id, datetime, type, message, job_id)
            VALUES ($1, $2, $3, $4, $5)`, [generateId('txt'), Date.now(), level, message, job.id]
        );




        if (new_status) {
            await t.none(
                `UPDATE jobs SET status = $1 WHERE id = $2`,
                [new_status, job.id]
            );
        };
    });
    return record_id;
}





// helpers
function log(level, message) {
    const colors = {
        debug: 'white',
        info: 'blue',
        error: 'red',
        success: 'green',
        warning: 'yellow',
    }
    const colorFunction = chalk[colors[level] || level] || chalk.white;
    console.log(colorFunction(message));
}
async function logRecords() {
    const records = (await db.any('SELECT * FROM records'));
    for (let record of records) {
        for (let key in record) {
            if (typeof record[key] === 'object') {
                record[key] = JSON.stringify(record[key]);
            }
        }
    }
    
    const csvStream = csv.format({ headers: true });
    const writableStream = fs.createWriteStream('records.csv');

    csvStream.pipe(writableStream);
    records.forEach(record => csvStream.write(record));
    csvStream.end();
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// TODO: replace
// function addJob(tldr) {
//     data['jobs'].push({
//         id: generateId('job'),
//         tldr: tldr,
//         status: 'pending',
//     });
// }
export function generateId(prefix, length=16) {
    const nanoid = customAlphabet('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz');
    return [prefix, nanoid(16)].join('_');
}
export async function set(key, value, org_id) {
    await db.none(
        `INSERT INTO variables (id, value, org_id)
        VALUES ($[id], $[value], $[org_id])
        ON CONFLICT (id, org_id) DO UPDATE SET value = $[value]`, {
            id: key,
            value: value,
            org_id: org_id,
    });
    return true
}
export async function get(key, org_id) {
    const result = (await db.oneOrNone(
        `SELECT value FROM variables WHERE id = $[id] AND org_id = $[org_id]`, {
            id: key,
            org_id: org_id,
    }))
    return result ? result.value : null
}




// openai helpers
async function waitOnRun(threadId, runId) {
    let run = (await openai.beta.threads.runs.retrieve(threadId, runId))
    while (run.status === 'queued' || run.status === 'in_progress') {
        await sleep(3000);
        run = (await openai.beta.threads.runs.retrieve(threadId, runId))
    }
    return run
}
async function listMessages(threadId) {
    return (await openai.beta.threads.messages.list(threadId))
}
async function latestMessage(threadId) {
    const messagesList = (await listMessages(threadId))['data']
    const messages = messagesList.sort((a, b) => a['created_at'] - b['created_at']).map((msg) => msg['content'].map((content) => content['text']['value'])).flat()
    return messages[messages.length - 1]
}
async function createThread(messages) {
    return (await openai.beta.threads.create({ messages: messages }))
}
async function startRun(threadId) {
    return (await openai.beta.threads.runs.create(threadId, { assistant_id: process.env.OPENAI_ASSISTANT_ID }))
}
async function createAndRun(messages, asst_id, model='gpt-4-1106-preview', tools=null, instructions=null) {
    const run = await openai.beta.threads.createAndRun({
        assistant_id: asst_id,
        thread: { messages: messages },
        model: model,
        tools: tools,
        instructions: instructions,
    })
    return run
}





async function supervisor() {
    while (true) {
        log('debug', '> checking for pending jobs');
        for (let job of (await db.any("SELECT * FROM jobs WHERE status = 'pending'"))) {
            await punchcard(job, 'working', {
                type: 'debug',
                tldr: `> ${job.id}`,
                message: `starting job :: ${job.tldr}`,
                json: {},
            });
            job.status = 'working';
            setTimeout(async () => log('info', await work(job)), 100);
        }
        await sleep(SUPERVISOR_SLEEP);
    }
}
async function manager() {
    while (true) {
        log('debug', '> checking for scheduled jobs');
        for (let job of (await db.any("SELECT * FROM jobs WHERE status = 'scheduled' AND start_time > $1 AND start_time < $2", [Date.now()/1000 - MANAGER_SLEEP, Date.now()/1000 + MANAGER_SLEEP]))) {
            const wait = job.start_time - Date.now()/1000;
            await punchcard(job, 'queued', {
                type: 'debug',
                tldr: `${job.tldr}`,
                message: ``,
                json: {},
            });
            job.status = 'queued';
            console.log(`> starting ${job.id} in ${Math.floor(wait)} seconds`);
            setTimeout(async () => {
                await punchcard(job, 'pending', {
                    type: 'debug',
                    tldr: `${job.tldr}`,
                    message: ``,
                    json: {},
                });
            }, wait*1000);
        }
        await sleep(MANAGER_SLEEP);
    }
}
async function logger() {
    while (true) {
        log('debug', '> logging records');
        await logRecords();
        await sleep(LOGGER_SLEEP);
    }
}
async function specialist(function_name, kwargs) {
    const { job, call_id } = kwargs
    await punchcard(job, 'waiting', {
        type: 'debug',
        tldr: `${job.id} => ${call_id}`,
        message: `${function_name}`,
        json: {},
    });
    switch (function_name) {

        case 'create_video':

            const pythonFile = 'C:/Users/calvi/3D Objects/pipe/main.py';
            const { project, prompt } = kwargs;

            if (!project || !prompt) {
                await punchcard(job, null, {
                    type: 'error',
                    tldr: `${function_name} failed`,
                    message: `missing ${(!project && !prompt) ? 'both args' ? project : 'project' : 'prompt' } for ${call.function.name}`,
                    json: {},
                });
                return;
            }
            let videoPath;
            try {
                const { stdout, stderr } = await exec(
                    `python "${pythonFile}" --prompt "${prompt}"`,
                    {cwd: path.dirname(pythonFile), stdio: 'inherit'}
                );
                
                if (stdout.includes('OUTPUT==')) {
                    console.log('OUTPUT FOUND');
                    videoPath = stdout.split('OUTPUT==')[1].split('==OUTPUT')[0].trim();
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

                let accessToken = await get('instagram_access_token', 'upnorth');
                let ig_id = await get('instagram_business_account_id', 'upnorth');
                
                if (!accessToken || !(await is_ig_access_token_valid(accessToken))) {
                    
                    try {
                        const pythonFile = 'C:/Users/calvi/3D Objects/gui/main.py'
                        const { stdout, stderr } = await exec(
                            `python "${pythonFile}"`,
                            {cwd: path.dirname(pythonFile), stdio: 'inherit'}
                        );
                        if (!stdout.includes('OUTPUT==')) throw new Error('python script did not return an access token')
                        accessToken = stdout.split('OUTPUT==')[1].split('==OUTPUT')[0].trim();

                    } catch (error) {
                        log('error', error);
                        await punchcard(job, null, {
                            type: 'error',
                            tldr: `${function_name} failed`,
                            message: `error running ${pythonFile}: ${error}`,
                            json: {},
                        });
                    }
                }
                
                await post_reel_to_instagram(accessToken, ig_id, url, caption);
            }
            if (youtube) {
                if (caption.length > 40) {
                    caption = one_shot(
                        `Return this caption "${caption}" modified to be less than 40 characters. NOTHING ELSE. NO EXTRA SYNTAX. JUST THE UPDATED CAPTION.`,
                        {model: 'gpt-4-1106-preview', max_tokens: 30, temperature: 0.5}
                    )
                }
                try {
                    fetch(
                        `https://script.google.com/macros/s/${process.env.GSCRIPT_ENDPOINT}/exec`,
                        {
                            method: 'POST',
                            body: JSON.stringify({
                                video_url: url,
                                short_description: caption,
                            }),
                        }
                    )
                } catch (error) {
                    console.error(error);
                    await punchcard(job, null, {
                        type: 'error',
                        tldr: `${function_name} failed`,
                        message: `error posting to youtube: ${error}`,
                        json: {},
                    });
                }
            }

            break
        
        default:
            await punchcard(job, null, {
                type: 'error',
                tldr: `${function_name} failed`,
                message: `function ${function_name} not found`,
                json: {},
            });
            return;
    }
    await punchcard(job, null, {
        type: 'debug',
        tldr: `${function_name} completed`,
        message: `of ${job.id} => ${call_id}`,
        json: {},
    });
}
function one_shot(prompt, kwargs={model: 'gpt-4-1106-preview', max_tokens: 64, temperature: 0.5}) {
    return openai.chat.completions.create({ prompt: prompt, ...kwargs }).choices[0].text;
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


    if (job.tldr.includes(process.env.JOB_SPECIAL_PREFIX) && job.tldr.length < 1000) {
        job.tldr = job.tldr.replace(process.env.JOB_SPECIAL_PREFIX, '')
        const [function_name, ...args] = job.tldr.split('?')
        log('info', JSON.stringify({job, call_id: job.id, ...Object.fromEntries(args.map((arg) => arg.split('=')))}))
        // await specialist(function_name, {job, call_id: job.id, ...Object.fromEntries(args.map((arg) => arg.split('=')))})
        return 'JOB COMPLETE'
    }



    let threadId;

    let history = (await db.any(`
            SELECT tldr, message FROM records
            INNER JOIN job_records ON job_records.record_id = records.id
            WHERE job_records.job_id = $1 AND type != 'debug'
            ORDER BY datetime DESC
            LIMIT 10
        `, [job.id]))
        .slice(0,10)
        .map((row) => `##${row.tldr}\n${row.message}`)

    let goals = (await db.any(`
            SELECT tldr FROM goals
            INNER JOIN job_goals ON job_goals.goal_id = goals.id
            WHERE job_goals.job_id = $1
        `, [job.id]))
        .map((row) => `- ${row.tldr}`)

    let actions = (
        await db.any(`
            SELECT id, tldr FROM actions
        `))
        .map((row, i) => `${i}. ${row.id} (${row.tldr})`)

    let prompt = ''
    prompt += `# Current job:\n${job.tldr}\n\n`
    prompt += `${ history.length > 0 ? `# Job history:\n${history.join('\n')}\n\n` : '' }`
    prompt += `${ goals.length > 0 ? `# Overarching goals:\n${goals.join('\n')}\n\n` : '' }`
    prompt += `${ actions.length > 0 ? `# Actions:\n${actions.join('\n')}\n\n` : '' }`
    prompt += `# Return value:\n`
    prompt += `Call a function or brainstorm\n`

    let run = (await createAndRun(
        [{ role: 'user', content: prompt }],
        'asst_rhmXsyeXVrfisVnu34zd2AsD',
        'gpt-4-1106-preview',
        utilities,
    ))

    const runId = run.id
    threadId = run.thread_id

    console.log(threadId)
    run = await waitOnRun(threadId, runId)
    log('debug', `>>> ${run.id} finished with status ${run.status}`)
    if (run.status == 'requires_action') {
        for (let call of run.required_action.submit_tool_outputs.tool_calls) {
            if (call.type == 'function') {
                log('debug', `>>> calling ${call.function.name}`)
                work({
                    id: job.id,
                    tldr: `${process.env.JOB_SPECIAL_PREFIX}${call.function.name}?${Object.entries({...JSON.parse(call.function.arguments)}).map(([k, v]) => `${k}=${v}`).join('&')}`,
                    status: 'working',
                    parent_id: job.id,
                    project_id: job.project_id || null,
                    org_id: job.org_id || null,
                })
                return 'JOB COMPLETE'
            }
        }
    }

    // let reply = await latestMessage(threadId)
    // console.log(reply)
    // const messagesList = (await listMessages(threadId))['data']
    // for (let message of messagesList) {
    //     console.log(message.content)
    // }
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
async function main() {
    supervisor();
    manager();
    logger();
}








console.log(`process.argv[0]: ${process.argv[0]}`)
console.log(`process.argv[1]: ${process.argv[1]}`)
if (path.basename(process.argv[1]) === path.basename(__filename)) {
    main().catch(console.error);
}
