import gTTS from 'gtts';

let text = 'China is coming. China is coming..';
const audioPath = `speech____${Math.floor(Date.now()/1000)}.mp3`

console.log(`process.argv[0]: ${process.argv[0]}`)
console.log(`process.argv[1]: ${process.argv[1]}`)

const gtts = new gTTS(text, 'en');
gtts.save(audioPath, function (err, result){
    if(err) console.error(err)
    console.log("Text to speech converted!");
});

async function wait(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
