
import { db, get, set, punchcard, exec } from './app.js';
import path from 'path';
import {
    get_instagram,
    is_ig_access_token_valid,
    post_image_to_instagram,
    post_reel_to_instagram,
    post_story_to_instagram,
} from './_facebook.js';



// export async function main() {

//     await db.none(
//         `INSERT INTO orgs ()`
//     )

//     await set('test', 'test', 'saturn');
// }
