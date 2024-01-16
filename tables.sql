CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY NOT NULL, --prefix with "txt"
    datetime BIGINT, -- Epoch time in milliseconds
    type TEXT,
    tldr TEXT,
    message TEXT,
    json JSON
);
---table_separator---
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY NOT NULL, --prefix with "file"
    type TEXT NOT NULL,
    extension TEXT NOT NULL,
    basename TEXT NOT NULL,
    folder_id TEXT NOT NULL,
    visibility TEXT NOT NULL,
    FOREIGN KEY (folder_id) REFERENCES folders(id)
);
---table_separator---
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY NOT NULL, --prefix with "fldr"
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    cloud BOOLEAN NOT NULL,
    root TEXT NOT NULL -- starting point, e.g. "C:/Users/username/3D Objects" or "./"
);
---table_separator---
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL, --prefix with "usr"
    role TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE
);
---table_separator---
CREATE TABLE IF NOT EXISTS user_social_usernames (
    user_id TEXT NOT NULL, -- Change to TEXT to match users.id
    instagram TEXT,
    twitter TEXT,
    gmail TEXT,
    facebook TEXT,
    linkedin TEXT,
    github TEXT,
    tiktok TEXT,
    PRIMARY KEY (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
---table_separator---
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY NOT NULL, --prefix with "agt"
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    role TEXT NOT NULL
);
---table_separator---
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY NOT NULL, --prefix with "job"
    tldr TEXT NOT NULL,
    status TEXT NOT NULL,
    parent_id TEXT, -- Change to TEXT to match jobs.id
    FOREIGN KEY (parent_id) REFERENCES jobs(id)
);
---table_separator---
CREATE TABLE IF NOT EXISTS features (
    id TEXT PRIMARY KEY NOT NULL, --prefix with "ftr"
    status TEXT NOT NULL,
    tldr TEXT NOT NULL
);
---table_separator---
CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY NOT NULL, --prefix with "modul"
    name TEXT NOT NULL,
    description TEXT NOT NULL
);
---table_separator---
CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY NOT NULL, --prefix with "bizz"
    nickname TEXT NOT NULL,
    owner_id TEXT NOT NULL, -- Change to TEXT to match users.id
    FOREIGN KEY (owner_id) REFERENCES users(id)
);
---table_separator---
CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY NOT NULL, --prefix with "goal"
    tldr TEXT NOT NULL,
    business_id TEXT NOT NULL, -- Change to TEXT to match businesses.id
    FOREIGN KEY (business_id) REFERENCES businesses(id)
);
---table_separator---
CREATE TABLE IF NOT EXISTS feature_goals (
    feature_id TEXT NOT NULL, -- Change to TEXT to match features.id
    goal_id TEXT NOT NULL, -- Change to TEXT to match goals.id
    PRIMARY KEY (feature_id, goal_id),
    FOREIGN KEY (feature_id) REFERENCES features(id),
    FOREIGN KEY (goal_id) REFERENCES goals(id)
);
---table_separator---
CREATE TABLE IF NOT EXISTS module_features (
    module_id TEXT NOT NULL, -- Change to TEXT to match modules.id
    feature_id TEXT NOT NULL, -- Change to TEXT to match features.id
    PRIMARY KEY (module_id, feature_id),
    FOREIGN KEY (module_id) REFERENCES modules(id),
    FOREIGN KEY (feature_id) REFERENCES features(id)
);
---table_separator---
CREATE TABLE IF NOT EXISTS feature_jobs (
    feature_id TEXT NOT NULL, -- Change to TEXT to match features.id
job_id TEXT NOT NULL, -- Change to TEXT to match jobs.id
PRIMARY KEY (feature_id, job_id),
FOREIGN KEY (feature_id) REFERENCES features(id),
FOREIGN KEY (job_id) REFERENCES jobs(id)
);
---table_separator---
CREATE TABLE IF NOT EXISTS job_calendar (
id TEXT PRIMARY KEY NOT NULL,
job_id TEXT NOT NULL, -- Change to TEXT to match jobs.id
start_time BIGINT NOT NULL, -- Epoch time in milliseconds
end_time BIGINT NOT NULL, -- Epoch time in milliseconds
FOREIGN KEY (job_id) REFERENCES jobs(id)
);
---table_separator---
CREATE TABLE IF NOT EXISTS job_records (
job_id TEXT NOT NULL, -- Change to TEXT to match jobs.id
record_id TEXT NOT NULL, -- Change to TEXT to match records.id
PRIMARY KEY (job_id, record_id),
FOREIGN KEY (job_id) REFERENCES jobs(id),
FOREIGN KEY (record_id) REFERENCES records(id)
);
---table_separator---
CREATE TABLE IF NOT EXISTS file_records (
file_id TEXT NOT NULL, -- Change to TEXT to match files.id
record_id TEXT NOT NULL, -- Change to TEXT to match records.id
PRIMARY KEY (file_id, record_id),
FOREIGN KEY (file_id) REFERENCES files(id),
FOREIGN KEY (record_id) REFERENCES records(id)
);
---table_separator---
CREATE TABLE IF NOT EXISTS business_records (
business_id TEXT NOT NULL, -- Change to TEXT to match businesses.id
record_id TEXT NOT NULL, -- Change to TEXT to match records.id
PRIMARY KEY (business_id, record_id),
FOREIGN KEY (business_id) REFERENCES businesses(id),
FOREIGN KEY (record_id) REFERENCES records(id)
);
---table_separator---
CREATE TABLE IF NOT EXISTS user_file_roles (
user_id TEXT NOT NULL, -- Change to TEXT to match users.id
file_id TEXT NOT NULL, -- Change to TEXT to match files.id
role TEXT NOT NULL,
PRIMARY KEY (user_id, file_id),
FOREIGN KEY (user_id) REFERENCES users(id),
FOREIGN KEY (file_id) REFERENCES files(id)
);