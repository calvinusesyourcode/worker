
import { db, get, set, punchcard, exec } from './app.js';
import path from 'path';
// import {
//     get_instagram,
//     is_ig_access_token_valid,
//     post_image_to_instagram,
//     post_reel_to_instagram,
//     post_story_to_instagram,
// } from './_facebook.js';


export async function main() {

    // await db.none(
    //     `INSERT INTO orgs (id) VALUES ('upnorth') ON CONFLICT DO NOTHING;`
    // )
    console.log(await get("instagram_business_account_id", 'upnorth'));

    process.exit(0);
}

main();