var fDateTime = Utilities.formatDate(new Date(), "America/Vancouver", "yyyy/MM/dd H:mm:ss");
const f_datetime = fDateTime
const row_order = false;
const create_log = true;
const headers = 1;
const specialApps = ["labels_get_projects"];
const header_titles = {
  ".threads": ["init", "last_msg", "phone_number", "name", "thread_id"],
  "log": ["timestamp", "type", "dump"],
}

const globalsheetid = env("DEFAULT_SHEET_ID") 
const openai_key = env("OPENAI_API_KEY")
const assistant_id = env("OPENAI_ASST_ID")

var ss, log, log_values;
const applog = full_sheet_setup(".applog",env("DEFAULT_SHEET_ID"))



// main
function doGet(e) {
  var url = 'http://10.0.0.96:8080';
  var options = {
    'method': 'post'
  };

  var response = UrlFetchApp.fetch(url, options);

  console.log(response);
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

  if (!data.sheet_id) throw("ERROR: !data.sheet_id")
  if (!data.fn) throw("ERROR: !data.fn")
  if (data.sheet_id !== globalsheetid) throw("ERROR: wrong sheet_id")
  if (data.pass !== env("PASS")) throw("ERROR: server error 435")

  let date;
  if (data.date === undefined || data.date == "") {data.date = f_datetime}
  else {data.date = Utilities.formatDate(new Date(data.date), "America/Vancouver", "yyyy/MM/dd H:mm:ss")}

  if (data.fn === "dump") {
    if (!data.dump) throw("ERROR: !data.dump")
    ss = full_sheet_setup("log", globalsheetid)
    data.dump.split('\n').forEach((line) => {
      let [date, type, info] = line.split('::')
      date = Utilities.formatDate(new Date(date), "America/Vancouver", "yyyy/MM/dd H:mm:ss")
      ss.appendRow([date,type,info])
    })
    return ContentService.createTextOutput("> dumped")
  }
}



// helpers
function submitToForm(sheetname, sheetid, values) {
  var currentRow = row_order ? ss.getLastRow() : headers+1;

  if (sheetname == "done") {
    var currentActivity = SpreadsheetApp.openById(sheetid).getSheetByName("punchcard").getRange(currentRow,2).getValue();
    values.splice(1,0,currentActivity);
  }
  
  if (create_log) {
    log = SpreadsheetApp.openById(sheetid).getSheetByName("log");

    log_values = [...values]
    log_values.splice(1,0,sheetname);
  }

  if(row_order) {
    ss.getRange(ss.getLastRow()+1,1,1,values.length).setValues([values])
    if(sheetname !== "test" && create_log) {
      log.getRange(log.getLastRow()+1,1,1,log_values.length).setValues([log_values])
    }
  } else {
    ss.insertRowBefore(headers+1);
    ss.getRange(headers+1,1,1,values.length).setValues([values])
    if(sheetname !== "test" && create_log) {
      log.insertRowBefore(headers+1);
      log.getRange(headers+1,1,1,log_values.length).setValues([log_values]);
    }
  }
}
function sheetSetup(app, sheetid) {

  const sheetname = app.includes("_") ? app.slice(0,app.indexOf("_")) : app;

  if (sheetid) {
    if (SpreadsheetApp.openById(sheetid).getSheetByName(sheetname) === null) {
      SpreadsheetApp.openById(sheetid).insertSheet().setName(sheetname);
    }
    if (SpreadsheetApp.openById(sheetid).getSheetByName("log") === null) {
      SpreadsheetApp.openById(sheetid).insertSheet().setName("log");
    }
  } else {
    throw("no sheetid");
  }

  return sheetname
}
function handleWildcardData(sheetid, text) {
  const sheetname = sheetSetup(".metadata", sheetid)
  const ss = SpreadsheetApp.openById(sheetid).getSheetByName(sheetname)
  const knownSheets = ss.getRange(headers+1,1,ss.getLastRow()-headers).getValues().map((rowItem) => rowItem[0])

  console.log(`knownSheets: ${JSON.stringify(knownSheets)}`)
  let dataEntry = text
  let prompt = `The user has uploaded new data: "${dataEntry}". Please select a sheet for this data from their pre-existing sheets "${JSON.stringify(knownSheets)}" or suggest a new sheet name. RETURN ONLY A SHEET NAME, NOTHING ELSE.`
  const sheet = gpt3Call(prompt, 20)
  if (!knownSheets.includes(sheet)) {
    throw("New sheet selected")
  }
  const schema = ss.getRange(headers+1+knownSheets.indexOf(sheet),2).getValue()
  prompt = `The user has uploaded new data: "${dataEntry}". Please decide if the sheet "${sheet}" suits the data, given its schema {\n${schema}\n}. RETURN ONLY yes OR no, NOTHING ELSE.`
  let confirmation = gpt3Call(prompt,5)
  console.log(`confirmation: ${confirmation}`)
  if (confirmation == "no") {
    throw("Sheet schema didn't fit data")
  }
  prompt = `The user has uploaded new data: "${dataEntry}" to the sheet "${sheet}". Please reformat their entry to fit the sheet schema {\n${schema}\n}. RETURN ONLY A JSON DICTIONARY, NOTHING ELSE.`
  let reformattedData = JSON.parse(gpt3Call(prompt))
  let dataItems = Object.values(reformattedData)
  return {
    "sheetname": sheet,
    "dataItems": dataItems,
  }
}



// openai helpers
function startRun(assistant_id, thread_id) {
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
function fetchRunStatus(thread_id, run_id) {
  return JSON.parse(UrlFetchApp.fetch(`https://api.openai.com/v1/threads/${thread_id}/runs/${run_id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${openai_key}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v1'
    },
  }))
}
function waitOnRun(assistant_id, thread_id) {
  let run = startRun(assistant_id, thread_id)
  let waited = 0
  while (run.status === "queued" || run.status === "in_progress") {
    Utilities.sleep(waited <= 6000 ? 2000 : 500);
    run = fetchRunStatus(thread_id, run.id)
    console.log(run)
  }
  return run;
}
function createNewThread(initial_messages) {
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
              role: message.role,
              content: message.content,
          }))
      })
    }))
  } catch (error) {
      console.error('Error creating new thread:', error);
      throw error;
  }
}
function test_threads() {
  const messages = [
    {
      role: "user",
      content: "Hello."
    }
  ]
  const thread_id = "thread_t4zOmyJHSo4uCodlpzekNzEl"
  // const thread_id = createNewThread(messages).id
  const run = waitOnRun(assistant_id, thread_id)
  console.log("done",run)

}
function gpt3Call(prompt, max_tokens) {
  console.log(`prompt:\n${prompt}`)
  var endpoint = 'https://api.openai.com/v1/chat/completions'
  var key = openai_key

  var payload = {
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful data entry assistant."
      },
      {
        "role": "user",
        "content": prompt
      },
    ]
  };

  if (max_tokens) payload["max_tokens"] = max_tokens

  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'headers': {
      'Authorization': 'Bearer ' + key
    },
    'payload': JSON.stringify(payload)
  };

  try {
    const response = JSON.parse(UrlFetchApp.fetch(endpoint, options).getContentText());
    let reply = response['choices'][0]['message']['content']
    return reply
  } catch (error) {
    console.log('Error:', error.toString());
  }
}


// temp tests
function tempPedenTest() {

  const services = [
    {
      title: "land clearing",
      href: "https://www.pedenindustries.ca/land-clearing",
    },
    {
      title: "site grading",
      href: "https://www.pedenindustries.ca/site-grading",
    },
    {
      title: "drainage",
      href: "https://www.pedenindustries.ca/drainage",
    },
    { title: "**new** site cleanup" },
    { title: "backfilling" },
    { title: "custom" },
  ]

  const htmlBody = `Neil here,
    
    Back in 1980 I would have sent you a fax, today it's an email.
    
    But one thing hasn't changed: Reliable contractors are hard to come by.

    My name is Neil Smith, owner and operator of <a href="https://www.pedenindustries.ca">Peden Industries</a>, and I've been in business for over 50 years.

    If you need a quality subcontractor, to rent an operator and machine, or even just advice, shoot me an email.

    <ul>${services.map((s) => `<li>${s.href ? `<a href="${s.href}">` : ``}${s.title}${s.href ? `</a>` : ``}</li>`).join("")}</ul>

    - Neil`.split(/(?:\r\n|\r|\n)/g).map((line) => line.trim()).join("<br/>")

  MailApp.sendEmail({
    to: "nearlyneil42@gmail.com",
    subject: "[test] Contract opportunity",
    htmlBody: htmlBody
  })

  Logger.log(`Remaining email quota: ${MailApp.getRemainingDailyQuota()}`);
  Logger.log(htmlBody)
}
function tempTest() {
  var url = 'http://70.69.240.169:8080';
  var options = {
    'method': 'get',
    'validateHttpsCertificates': false,
    'muteHttpExceptions': true
  };

  var response = UrlFetchApp.fetch(url, options);

  const text = response.getContentText();
  console.log(text);
}
function tempTest32() {
  const sheetid = globalsheetid
  const sheets = SpreadsheetApp.openById(sheetid).getSheets().map((sheet) => {
    const name = sheet.getName()
    if (name.charAt(0) != ".") return name
    })
  console.log(sheets)
}



// helpers
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



