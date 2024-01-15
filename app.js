// import 
import OpenAI from "openai";
import { customAlphabet } from "nanoid";
import dotenv from 'dotenv';

dotenv.config();
const openai = new OpenAI(process.env.OPENAI_API_KEY);
let data = { jobs:[], records:[], threads:[] }

sleep(1000)

// helpers
function log(message) {
    console.log(message);
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function addJob(description) {
    data["jobs"].push({
        id: generateId("job"),
        description: description,
        status: "pending",
    });
    return 1;
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

// functions
async function work(job) {
    log(`>>> working on "${job["description"]}"`)

    const prompt = `Return a pseudocode plan for this job: "${job["description"]}"\n\n`;

    let run = (await createAndRun([{ role: "user", content: prompt }]))
    let runId = run["id"]
    let threadId = run["thread_id"]

    run = await waitOnRun(threadId, runId)
    log(`>>> ${runId} finished with status ${run["status"]}`)
    let reply = await latestMessage(threadId)
    console.log(reply)
}

// first pass
data["jobs"].push({
    id: generateId("job"),
    description: "write an html canvas pong game",
    status: "pending",
    parent: null,
});


// main
while (true) {
    log("> checking for new jobs")
    for (let job of data["jobs"]) {
        if (job["status"] === "pending" && job["parent"] === null) {
            job["status"] = "working";
            log(`>> starting ${job["id"]}: "${job["description"]}"`)
            setTimeout(() => work(job), 100);
        }
    }
    await sleep(10000);
}

// const threadId = "thread_6tzIb3gduz8c0qutilFu4kEI"
// const runId = "run_hb0pVEkdDMLeSG7W9Qxl6Qu4"
// const messagesList = (await listMessages(threadId))["data"]
// const messages = messagesList.sort((a, b) => a["created_at"] - b["created_at"]).map((msg) => msg["content"].map((content) => content["text"]["value"])).flat()
// for (let message of messages) {
//     console.log(message)
// }