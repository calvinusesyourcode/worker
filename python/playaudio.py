import sys
import wave
import pyaudio

def log_to_file(message):
    with open('log.txt', 'a') as log_file:
        log_file.write(message + '\n')

def play_wav(file_path):
    chunk = 1024
    wf = wave.open(file_path, 'rb')
    p = pyaudio.PyAudio()

    stream = p.open(format=p.get_format_from_width(wf.getsampwidth()),
                    channels=wf.getnchannels(),
                    rate=wf.getframerate(),
                    output=True)

    data = wf.readframes(chunk)
    while data:
        stream.write(data)
        data = wf.readframes(chunk)

    stream.stop_stream()
    stream.close()
    p.terminate()

# if __name__ == "__main__":
log_to_file("Starting the program")
if len(sys.argv) < 2:
    print("Usage: python main.py <file_path>")
    log_to_file("No file path provided. Exiting.")
    sys.exit(1)

file_path = sys.argv[1]
if file_path.lower().endswith('.wav'):
    log_to_file("Playing WAV file")
    play_wav(file_path)
else:
    print("Unsupported file format. Please use a WAV or MP3 file.")
