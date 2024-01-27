import fs from 'fs/promises';
import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import path from 'path';

const firebaseConfig = {
  apiKey: "AIzaSyDoSyb4mYfHD-CxdYEJN4nSYkhFfHNXDAg",
  authDomain: "up-north-789ad.firebaseapp.com",
  projectId: "up-north-789ad",
  storageBucket: "up-north-789ad.appspot.com",
  messagingSenderId: "93487799258",
  appId: "1:93487799258:web:8eee31dfdc7a9d16f0fee3",
  measurementId: "G-J2F3JH9Z6M"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage();

const contentTypes = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".webp": "image/webp",
}

export async function jumpToCloud(filepath, prettyName=null, metadata=null) {
    if (!metadata && !contentTypes[path.extname(filepath)]) throw new Error(`No content type found for ${path.extname(filepath)}`)
    const data = await fs.readFile(filepath)
    const filename = prettyName || path.basename(filepath)
    metadata = metadata || {contentType: contentTypes[path.extname(filepath)]}
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, filepath);
        const uploadTask = uploadBytesResumable(ref(storage, filename), data, metadata);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                console.log(`> uploading ${filename} :: ${(snapshot.bytesTransferred == 0 ? 0 : snapshot.bytesTransferred / snapshot.totalBytes) * 100}%`);
                switch (snapshot.state) {
                case 'paused':
                    console.log(`> paused upload :: ${filename}`);
                    break;
                case 'running':
                    // console.log('Upload is running');
                    break;
                }
            }, 
            (error) => { // https://firebase.google.com/docs/storage/web/handle-errors
                switch (error.code) {
                case 'storage/unauthorized':
                    reject("User doesn't have permission to access the object");
                    break;
                case 'storage/canceled':
                    reject("User canceled the upload");
                    break;
                case 'storage/unknown':
                    reject("Unknown error occurred, inspect error.serverResponse");
                    break;
                }
            }, 
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                    resolve(downloadURL);
                });
            }
        );
    })
}
