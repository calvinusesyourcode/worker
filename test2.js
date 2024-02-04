
import { db, get, set, punchcard, exec } from './app.js';
import path from 'path';
import {
    get_instagram,
    is_ig_access_token_valid,
    post_image_to_instagram,
    post_reel_to_instagram,
    post_story_to_instagram,
} from './_facebook.js';



const obj = {
    key: "value",
    key2: "value2",
}

console.log(Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('&'));
