const openai_key = env("OPENAI_API_KEY")
const assistant_id = env("DEFAULT_ASST_ID")
const f_datetime = Utilities.formatDate(new Date(), "America/Vancouver", "yyyy/MM/dd H:mm:ss")
const init_time = new Date().valueOf()
const headers = 1

const header_titles = {
  ".threads": ["init", "last_msg", "phone_number", "name", "thread_id"],
  "pending-msgs": ["date", "phone_number", "name", "thread_id", "response"],
  "msg-fixes": ["thread_id", "old_msg", "new_msg"],
}

const ignored_prefixes = [
  `​❤️​ to “`,
  `👍​ to “`,
]

const applog = full_sheet_setup(".applog",env("DEFAULT_SHEET_ID"))

function temptest(){
  const id = "thread_c4ItLrqYLHhqjFCLUEfYrDxB"
  const t = full_sheet_setup(id.replace('_','-'), env('DEFAULT_SHEET_ID'))
  let rows = get_thread_messages(id).data
    .sort((a,b) => a.created_at < b.created_at ? -1 : 1)
    .map((item) => {return {
      time: Utilities.formatDate(new Date(item.created_at*1000), "America/Vancouver", "yyyy/MM/dd H:mm:ss"),
      from: item.role,
      msg: item.content[0].text.value
    }})
    .map((item) => {return Object.values(item)})
  // Logger.log(JSON.stringify(data, null, 4))
  rows.forEach(row => t.appendRow(row))
}

// main
function doGet(e) {
  const ss = full_sheet_setup(".applog",env("DEFAULT_SHEET_ID"))
  ss.appendRow([f_datetime, JSON.stringify(e, null, 4)])

  let data = {}
  if (e.parameter) { // get URL-encoded params
    Object.keys(e.parameter).forEach((key) => {
      data[key] = e.parameter[key]
    })
  }

  /*=== linkedin ===*/
  if (data.state == env("LINKEDIN_STATE")) {
    if (!data.code) {
      throw("ERROR: !data.code")
    }

    let response = null
    let payload = {
      "grant_type": "authorization_code",
      "code": data.code,
      "client_id": env("LINKEDIN_CLIENTID"),
      "client_secret": env("LINKEDIN_CLIENTSECRET"),
      "redirect_uri": encodeURIComponent(env("LINKEDIN_REDIRECT")),
    }

    try {
      response = UrlFetchApp.fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        payload: Object.keys(payload).map(key => `${key}=${payload[key]}`).join('&'),
      })
    } catch (error) {
      ss.appendRow([f_datetime, "ERROR", error])
      throw(error)
    }

    const access_token = JSON.parse(response)["access_token"]
    if (access_token) {
      set_secret("LINKEDIN_ACCESS", access_token)
      return ContentService.createTextOutput("> successfully updated access token")
    }
  }
  /*=== twitter ====*/
  if (data.state == env("TWITTER_STATE")) {
    if (!data.code) {
      throw("ERROR: !data.code")
    }

    let response = null
    let payload = {
      "grant_type": "authorization_code",
      "code": data.code,
      // "client_id": env("TWITTER_CLIENTID"),
      // "client_secret": env("TWITTER_CLIENTSECRET"),
      "redirect_uri": env("TWITTER_REDIRECT"),
      "code_verifier": "challengetoyourdeath"
    }

    try { // fetch
      response = UrlFetchApp.fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${Utilities.base64Encode(`${env("TWITTER_CLIENTID")}:${env("TWITTER_CLIENTSECRET")}`)}`
          },
        payload: Object.keys(payload).map(key => `${key}=${payload[key]}`).join('&'),
      })
    } catch (error) {
      ss.appendRow([f_datetime, "ERROR", error])
      throw(error)
    }

    ss.appendRow([f_datetime, "DEBUG", response.getContentText()])

    try { // parse response and store variables
        const responseData = JSON.parse(response.getContentText());
        set_secret("TWITTER_ACCESS", responseData["access_token"]);
        set_secret("TWITTER_REFRESH", responseData["refresh_token"]);
        set_secret("TWITTER_TOKEN_TIME", (Math.floor(Date.now()/1000) + responseData["expires_in"]).toString());
        applog.appendRow([f_datetime, "DEBUG", "Successfully updated twitter refresh & access token & token time"]);
        return ContentService.createTextOutput("> successfully updated tokens!");
    } catch (error) {
        applog.appendRow([f_datetime, "DEBUG", "Failed to parse token response object..."]);
        applog.appendRow([f_datetime, "ERROR", error.toString()]);
        throw error;
    }
  }

  if (e.pathInfo == "auth") {
    const urls = {
      "linkedin": `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${env("LINKEDIN_CLIENTID")}&redirect_uri=${env("LINKEDIN_REDIRECT")}&state=${env("LINKEDIN_STATE")}&scope=${encodeURIComponent(env("LINKEDIN_SCOPES"))}`,
      "twitter": `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${env("TWITTER_CLIENTID")}&redirect_uri=${env("TWITTER_REDIRECT")}&scope=${encodeURIComponent(env("TWITTER_SCOPES"))}&state=${env("TWITTER_STATE")}&code_challenge=challengetoyourdeath&code_challenge_method=plain`,
    }
    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_top">
        </head>
        <body>
          <div style="padding: 4rem; font-size: 20px; display: flex; flex-direction: column; gap: 1rem">
            <a href="${urls["linkedin"]}">linkedin</a>
            <a href="${urls["twitter"]}">twitter</a>
          </div>
        </body>
      </html>
    `)
  }

  if (e.pathInfo == "index") return HtmlService.createHtmlOutputFromFile("index")

  return ContentService.createTextOutput("Beep boop.")
}
function doPost(e) {
  let data = {}
  

  if (e.postData) { // get postData.contents
    try {
      data = JSON.parse(e.postData.contents);
    } catch {
      if (e.postData.type == "application/x-www-form-urlencoded") {
        Logger.log("INFO: Skipped e.postData.contents")
      } else {
        Logger.log("ERROR: !e.postData")
      }
    }
  }

  if (e.parameter) { // get URL-encoded params
    Object.keys(e.parameter).forEach((key) => {
      data[key] = e.parameter[key]
    })
  }

  if (!data.sheet_id) {
    throw("ERROR: !data.sheet_id")
  }
  if (!data.fn) {
    throw("ERROR: !data.fn")
  }
  if (data.pass != env("PASS")) {
    throw("ERROR: server failure 21")
  }
  applog.appendRow([f_datetime, "INFO", JSON.stringify(data, null, 4)])
  let date;
  if (data.date === undefined || data.date == "") {data.date = f_datetime}
  else {data.date = Utilities.formatDate(new Date(data.date), "America/Vancouver", "yyyy/MM/dd H:mm:ss")}

  if (data.fn == "msg_assistant") {
    if (!data.direction) {
      throw new Error("ERROR: !data.direction")
    }
    const ss = full_sheet_setup('pending-msgs', data.sheet_id)
    if (data.direction === 'in') {
      if (!data.message || !data.phone_number || !data.name) {
        throw new Error("ERROR: !data.message OR !data.phone_number OR !data.name")
      }
      if (ignored_prefixes.some(prefix => data.message.slice(0,14).includes(prefix))) {
        applog.appendRow([f_datetime, "INFO", `message_send (in)`])
        applog.appendRow([f_datetime, "INFO", "IGNORED MSG REACTION"])
        return ContentService.createTextOutput("SUCCESS")
      }
      const [thread_id, response] = msg_assistant(data.sheet_id, data.message, data.phone_number, data.name)
      ss.appendRow([data.date, data.phone_number, data.name, thread_id, response])
      applog.appendRow([f_datetime, "INFO", `message_send (in)`])
      applog.appendRow([f_datetime, "INFO", "SUCCESS"])
      return ContentService.createTextOutput("SUCCESS")
    }
    else if (data.direction === 'inandout') {
      if (!data.message || !data.phone_number || !data.name) {
        throw new Error("ERROR: !data.message OR !data.phone_number OR !data.name")
      }
      if (ignored_prefixes.some(prefix => data.message.slice(0,14).includes(prefix))) {
        applog.appendRow([f_datetime, "INFO", `message_send (inandout)`])
        applog.appendRow([f_datetime, "INFO", "IGNORED MSG REACTION"])
        return ContentService.createTextOutput("<TODO: fix>")
      }
      const [thread_id, response] = msg_assistant(data.sheet_id, data.message, data.phone_number, data.name)
      applog.appendRow([f_datetime, "INFO", `message_send (inandout)`])
      applog.appendRow([f_datetime, "INFO", `${data.phone_number}::${thread_id}::${response}`])
      return ContentService.createTextOutput(`${data.phone_number}::${thread_id}::${response}`)
    }
    else if (data.direction === 'out') {
      const messageData = unshift('pending-msgs', data.sheet_id)
      if (!messageData.response || messageData.response.length < 1) {
        return ContentService.createTextOutput("DONE")
      }
      applog.appendRow([f_datetime, "INFO", `message_send (out)`])
        applog.appendRow([f_datetime, "INFO", `${messageData.phone_number}::${messageData.thread_id}::${messageData.response}`])
      return ContentService.createTextOutput(`${messageData.phone_number}::${messageData.thread_id}::${messageData.response}`)
    }
    else if (data.direction === 'edit') {
      if (!data.old_msg || !data.new_msg || !data.thread_id) {
        throw new Error("ERROR: !data.old_msg OR !data.new_msg OR !data.thread_id")
      }
      full_sheet_setup('msg-fixes', data.sheet_id).appendRow([data.thread_id, data.old_msg, data.new_msg])
      applog.appendRow([f_datetime, "INFO", `message_edit`])
      return ContentService.createTextOutput("SUCCESS")
    }
    else if (data.direction === 'count') {
      const count = ss.getLastRow()-1
      return ContentService.createTextOutput(count == 0 ? "NONE" : Array(count).fill(count).join("::"))
    }
  }

  if (data.fn == "say_to_the_world") {
    if (!data.message) {
      throw new Error("ERROR: !data.message")
    }
    return ContentService.createTextOutput(say_to_the_world(data.message))
  }

  if (data.fn == "post_to_youtube") {
    if (!data.video_url) {
        applog.appendRow([f_datetime, "ERROR", "!data.video_url"])
        throw new Error("ERROR: !data.video_url")
    }
    if (!data.short_description) {
        applog.appendRow([f_datetime, "ERROR", "!data.short_description"])
        throw new Error("ERROR: !data.short_description")
    }
    if (data.video_type != "shorts") {
        applog.appendRow([f_datetime, "ERROR", "only 'shorts' is supported right now"])
        throw new Error("ERROR: !data.video_type")
    }
    upload_to_youtube(data.video_url, data.short_description)
    return ContentService.createTextOutput("success")
  }

  return ContentService.createTextOutput("ERROR? Nothing happened...\n"+JSON.stringify(data))
}
function msg_assistant(sheet_id, input_message, phone_number, name) {
  if (!header_titles[".threads"]) {
    throw('ERROR: !header_titles[".threads"]')
  }
  const sheetname = sheet_setup(".threads",sheet_id)
  const ss = SpreadsheetApp.openById(sheet_id).getSheetByName(sheetname)
  phone_number = fix_number(phone_number)

  const existing_thread_data = ss.getRange(headers+1,1,ss.getLastRow(),ss.getLastColumn()).getValues()
  .map(row => Object.fromEntries(header_titles[".threads"].map((key, index) => [key, row[index]])));
  let existing_user_thread = null
  let thread_id = null
  let thread_row_number = null
  let last_row = ss.getLastRow()
  for (let i = 0, l = ss.getLastRow(); i < l; i++) {
    if (existing_thread_data[i]["phone_number"] == phone_number) {
      existing_user_thread = existing_thread_data[i]
      thread_row_number = i+1+headers
    }
  }
  if (!existing_user_thread) {
    thread_id = create_new_thread_with_messages([input_message]).id
    ss.appendRow([f_datetime, f_datetime, phone_number, name, thread_id]) 
  } else {
    thread_id = existing_user_thread["thread_id"]
    ss.getRange(thread_row_number,header_titles[".threads"].indexOf("last_msg")+1).setValue(Utilities.formatDate(new Date(), "America/Vancouver", "yyyy/MM/dd H:mm:ss"))
    console.log(append_message_to_thread(thread_id, input_message))
  }
  let run = wait_on_run(assistant_id, thread_id)
  const messages = get_thread_messages(thread_id).data.map((msg)=>msg.id)
  const reply = read_message(thread_id, messages[0]).content[0].text.value
  const thread_log = sheet_setup(".thread_log",sheet_id)
  SpreadsheetApp.openById(sheet_id).getSheetByName(thread_log).appendRow([thread_id, reply])
  spend_time_typing(reply)
  return [thread_id, reply]
}
function unshift(sheet_name, sheet_id) {
  let keys = header_titles[sheet_name]
  if (!keys) throw new Error("function unshift error :: !header_titles[sheet_name]")
  const ss = full_sheet_setup(sheet_name, sheet_id)
  for (let i = 1; i < 1000; i++) {
    const row = ss.getRange(i,1,1,ss.getLastColumn()).getValues()[0]
    if (row.join("") != header_titles[sheet_name].join("")) {
      ss.deleteRow(i)
      return row.reduce((obj, item, j) => ({ ...obj, [keys[j]]: item }), {});
    }
  }
}
function say_to_the_world(text) {
  
  let errors = 0

  try {
    share_text_on_linkedin(text)
  } catch (error) {
    applog.appendRow([f_datetime,"ERROR",error])
    errors++
  }

  try {
    tweet(text)
  } catch (error) {
    applog.appendRow([f_datetime, "ERROR", error])
    errors++
  }

  return errors == 0 ? "> success" : `${errors} error(s)`
}

// sheet helpers
function sheet_to_dictionary(sheet_name, sheet_id) {
  let data = {}
  const ss = full_sheet_setup(sheet_name, sheet_id)
  ss.getRange(1,1,ss.getLastRow(),2).getValues().forEach((row) => {
    data[row[0]] = row[1] 
  })
  return data
}
function update_sheet_dictionary(sheet_name, sheet_id, dict) {
  const ss = full_sheet_setup(sheet_name, sheet_id);
  const lastRow = ss.getLastRow();
  const range = ss.getRange(1, 1, lastRow, 2);
  const values = range.getValues();

  let notFoundKeys = {...dict};

  for (let i = 0; i < values.length; i++) {
    const key = values[i][0];
    if (dict.hasOwnProperty(key)) {
      ss.getRange(i + 1, 2).setValue(dict[key]);
      delete notFoundKeys[key];
    }
  }

  for (const key in notFoundKeys) {
    ss.appendRow([key, notFoundKeys[key]]);
  }
}
function sheet_setup(app, sheet_id) {
  const sheetname = app.includes("_") ? app.slice(0,app.indexOf("_")) : app;
  if (!sheet_id) {
    throw("ERROR: no sheet_id");
  }
  if (SpreadsheetApp.openById(sheet_id).getSheetByName(sheetname) === null) {
    SpreadsheetApp.openById(sheet_id).insertSheet().setName(sheetname);
    if (Object.keys(header_titles).includes(sheetname)) {
      SpreadsheetApp.openById(sheet_id).getSheetByName(sheetname).getRange(1,1,1,header_titles[sheetname].length).setValues([header_titles[sheetname]])
    }
  }
  return sheetname
}
function full_sheet_setup(app, sheet_id) {
  const sheetname = sheet_setup(app, sheet_id)
  return SpreadsheetApp.openById(sheet_id).getSheetByName(sheetname)
}
function env(key) {
  return PropertiesService.getScriptProperties().getProperty(key)
}
function set_secret(key, value) {
  return PropertiesService.getScriptProperties().setProperty(key, value)
}


// linkedin
function test_linkedin() {

  Logger.log(share_text_on_linkedin(
    "Your emotions are signals from your body. Pay attention.",
  ))
}
function share_text_on_linkedin(text) {

  const payload = {
    "author": `urn:li:person:${env("LINKEDIN_SUB")}`,
    "lifecycleState": "PUBLISHED",
    "specificContent": {
        "com.linkedin.ugc.ShareContent": {
            "shareCommentary": {
                "text": text,
            },
            "shareMediaCategory": "NONE"
        }
    },
    "visibility": {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
    }
  }

  const response = UrlFetchApp.fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env("LINKEDIN_ACCESS")}`,
    },
    payload: JSON.stringify(payload),
  })

  let returnvalue = null
  try {
    returnvalue = JSON.parse(response)
    applog.appendRow([f_datetime, "INFO", `posted to linkedin: ${text}`])
  } catch (error) {
    returnvalue = response
  }
  return returnvalue
}

function test12() {
  tweet("When you feel stressed, take 10 deep breathes and move to a new activity. It works like magic.")
}
// twitter
function refresh_twitter_token() {
  applog.appendRow([f_datetime, "DEBUG", "Refreshing token..."]);
  let refresh_token = env("TWITTER_REFRESH");

  let headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    "Authorization": `Basic ${Utilities.base64Encode(`${env("TWITTER_CLIENTID")}:${env("TWITTER_CLIENTSECRET")}`)}`
  };
  let payload = {
    "refresh_token": refresh_token,
    "grant_type": "refresh_token"
  };

  let response;
  Logger.log(Object.keys(payload).map(key => `${key}=${payload[key]}`).join('&'));

  try {
    response = UrlFetchApp.fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: headers,
      payload: Object.keys(payload).map(key => `${key}=${payload[key]}`).join('&'),
    });
  } catch (error) {
    applog.appendRow([f_datetime, "DEBUG", "Failed to refresh token..."]);
    applog.appendRow([f_datetime, "ERROR", error.toString()]);
    throw error;
  }

  try {
    let parsedResponse = JSON.parse(response.getContentText());

    set_secret("TWITTER_ACCESS", parsedResponse["access_token"]);
    set_secret("TWITTER_REFRESH", parsedResponse["refresh_token"]);
    set_secret("TWITTER_TOKEN_TIME", (Math.floor(Date.now()/1000) + parsedResponse["expires_in"]).toString());

    applog.appendRow([f_datetime, "DEBUG", "Successfully updated twitter refresh & access token & token time"]);
    return true;
  } catch (error) {
    applog.appendRow([f_datetime, "DEBUG", "Failed to parse token response object..."]);
    applog.appendRow([f_datetime, "ERROR", error.toString()]);
    throw error;
  }
}
function test_twitter() {
  // Logger.log(tweet("Being truthful is the first step to be able to create peace within your day to day."))
  refresh_twitter_token()
}
function tweet(text) {

  if ((Date.now()/1000) > ((parseInt(env("TWITTER_TOKEN_TIME"), 10) - 3*60))) { // 3 minutes before expiration
    applog.appendRow([f_datetime, "DEBUG", "Token close to expiration, refreshing..."]);
    if (!refresh_twitter_token()) {
        applog.appendRow([f_datetime, "ERROR", "Failed to refresh Twitter token"]);
        throw new Error("Failed to refresh Twitter token");
    }
  }

  let response;

  try {
    response = UrlFetchApp.fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env("TWITTER_ACCESS")}`,
      },
      payload: JSON.stringify({"text": text}),
    })
    try {
      const id = JSON.parse(response)["data"]["id"]
      applog.appendRow([f_datetime, "INFO", `Tweeted: ${text}`])
      return `https://x.com/upnorthathletic/status/${id}`
    } catch (error) {
      ss.appendRow([f_datetime, "ERROR0", error])
      throw(error)
    }
  } catch (error) {
    applog.appendRow([f_datetime, "ERROR1", error.toString()])
    applog.appendRow([f_datetime, "DEBUG", "Gonna try refreshing the token..."])
    try {
      if (refresh_twitter_token()) {
        applog.appendRow([f_datetime, "DEBUG", "Token refreshed!"])
      }
    } catch (error) {
      applog.appendRow([f_datetime, "ERROR2", error.toString()])
      applog.appendRow([f_datetime, "DEBUG", "Could not refresh..."])
      throw(error)
    }
    tweet(text)
  }
  
  

}


// youtube
function get_youtube_categories() {
  YouTube.VideoCategories.list(["snippet"], { regionCode: "CA"})
    .items.forEach((item) => {
      Logger.log(`${item.id}: ${item.snippet.title}`)
    })
}
function upload_to_youtube(video_url, short_description) {

  const blob = UrlFetchApp.fetch(video_url).getBlob() 

  const video_resource = {
    snippet: {
      title: short_description,
      description: `${short_description} #shorts`,
      tags: ["fitness","nutrition", "workoutmotivation", "movivation", "workout"],
      categoryId: "17",
    },
    status: {
      privacyStatus: "public"
    },
  }

  Logger.log("trial")
  const new_video = YouTube.Videos.insert(video_resource, "snippet,status,id", blob)
  Logger.log(JSON.stringify(new_video, null, 4))
}


// openai helpers
function start_run(assistant_id, thread_id) {
  const body = JSON.stringify({"assistant_id":assistant_id})
  console.log(body)

  return JSON.parse(UrlFetchApp.fetch(`https://api.openai.com/v1/threads/${thread_id}/runs`, {
    // muteHttpExceptions: true,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openai_key}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v1'
    },
    payload: JSON.stringify({"assistant_id":assistant_id}),
  }))
}
function fetch_run_status(thread_id, run_id) {
  return JSON.parse(UrlFetchApp.fetch(`https://api.openai.com/v1/threads/${thread_id}/runs/${run_id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${openai_key}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v1'
    },
  }))
}
function wait_on_run(assistant_id, thread_id) {
  let run = start_run(assistant_id, thread_id)
  let waited = 0
  while (run.status === "queued" || run.status === "in_progress") {
    Utilities.sleep(waited <= 6000 ? 2000 : 500);
    run = fetch_run_status(thread_id, run.id)
    console.log(run)
  }
  return run;
}
function create_new_thread_with_messages(initial_messages) {
  try {
    return JSON.parse(UrlFetchApp.fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${openai_key}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v1'
      },
      payload: JSON.stringify({
          messages: initial_messages.map(message => ({
              role: "user",
              content: message,
          }))
      })
    }))
  } catch (error) {
      console.error('Error creating new thread:', error);
      throw error;
  }
}
function append_message_to_thread(thread_id, new_message) {
  try {
    return JSON.parse(UrlFetchApp.fetch(`https://api.openai.com/v1/threads/${thread_id}/messages`, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${openai_key}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v1'
      },
      payload: JSON.stringify({
        role: "user",
        content: new_message,
      })
    }))
  } catch (error) {
      console.error('Error creating new thread:', error);
      throw error;
  }
}
function get_thread_messages(thread_id) {
  try {
    return JSON.parse(UrlFetchApp.fetch(`https://api.openai.com/v1/threads/${thread_id}/messages`, {
      method: 'GET',
      headers: {
          'Authorization': `Bearer ${openai_key}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v1'
      },
    }))
  } catch (error) {
      console.error('Error reading thread:', error);
      throw error;
  }
}
function read_message(thread_id, message_id) {
  try {
    return JSON.parse(UrlFetchApp.fetch(`https://api.openai.com/v1/threads/${thread_id}/messages/${message_id}`, {
      method: 'GET',
      headers: {
          'Authorization': `Bearer ${openai_key}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v1'
      },
    }))
  } catch (error) {
      console.error('Error reading thread:', error);
      throw error;
  }
}
function test_msg_assistant() {
  console.log(msg_assistant(env("DEFAULT_SHEET_ID"),"Hello Jereymi!", "16042198248", "Calvin"))
}


// data helpers
function spend_time_typing(message) {
  const time_to_type = message.length * (60 + (40 * Math.random()))
  const estimated_extra_time = 3000
  const time_since = Date.now().valueOf()-init_time
  const time_to_wait = time_to_type - (estimated_extra_time + time_since)
  if (time_to_wait > 50) {
    console.log(`Waiting ${Math.floor(time_to_wait/1000)} seconds...`)
    Utilities.sleep(Math.floor(time_to_wait))
  }
  return true
}
function fix_number(string) {
  return string.replace(/\D/g, '');
}