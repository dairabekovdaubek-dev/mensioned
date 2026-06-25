import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const sourcePath = join(root, 'public', 'presentation', 'qasqyr-slide5-source.mp4');
const gameplayPath = join(root, 'tmp', 'slide5-gameplay-capture.webm');
const outPath = join(root, 'public', 'presentation', 'qasqyr-gameplay-recording.webm');
const tmpDir = join(root, 'tmp');
const audioPath = join(tmpDir, 'slide5-original-synthpop.wav');
const durationSeconds = 45;
const gameplayStartSeconds = 60;
const sampleRate = 48000;

mkdirSync(tmpDir, { recursive: true });

function clamp(value, min = -1, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function noteToHz(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function adsr(time, start, length, attack, release) {
  const local = time - start;
  if (local < 0 || local > length) return 0;
  if (local < attack) return local / attack;
  if (local > length - release) return Math.max(0, (length - local) / release);
  return 1;
}

function saw(phase) {
  return 2 * (phase - Math.floor(phase + 0.5));
}

function noise(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return (x - Math.floor(x)) * 2 - 1;
}

function writeWav(path) {
  const channels = 2;
  const frames = durationSeconds * sampleRate;
  const dataBytes = frames * channels * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * 2, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);

  const bpm = 96;
  const beat = 60 / bpm;
  const chordLength = beat * 4;
  const chords = [
    [55, 58, 62, 65],
    [51, 55, 58, 63],
    [46, 50, 53, 58],
    [53, 57, 60, 65],
  ];

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const beatIndex = Math.floor(t / beat);
    const beatTime = t - beatIndex * beat;
    const chordIndex = Math.floor(t / chordLength) % chords.length;
    const chordStart = Math.floor(t / chordLength) * chordLength;
    const chord = chords[chordIndex];

    let sample = 0;

    const padEnv = adsr(t, chordStart, chordLength * 0.95, 0.35, 0.8);
    for (const note of chord) {
      const hz = noteToHz(note);
      sample += saw(t * hz) * 0.035 * padEnv;
      sample += Math.sin(2 * Math.PI * t * (hz * 2.01)) * 0.018 * padEnv;
    }

    const bassHz = noteToHz(chord[0] - 12);
    const bassEnv = adsr(t, beatIndex * beat, beat * 0.72, 0.01, 0.16);
    sample += Math.sin(2 * Math.PI * t * bassHz) * 0.16 * bassEnv;

    const kickEnv = Math.exp(-beatTime * 18);
    sample += Math.sin(2 * Math.PI * t * (42 + 52 * kickEnv)) * kickEnv * 0.46;

    if (beatIndex % 2 === 1) {
      const snareTime = beatTime;
      const snareEnv = Math.exp(-snareTime * 22);
      sample += noise(i) * snareEnv * 0.16;
      sample += Math.sin(2 * Math.PI * t * 185) * snareEnv * 0.08;
    }

    const hatTime = (t % (beat / 2));
    const hatEnv = Math.exp(-hatTime * 70);
    sample += noise(i * 3.7) * hatEnv * 0.055;

    const leadStart = Math.floor(t / (beat * 2)) * beat * 2 + beat * 0.25;
    const leadEnv = adsr(t, leadStart, beat * 1.4, 0.03, 0.35);
    const leadNotes = [70, 72, 74, 77, 74, 72, 70, 67];
    const leadHz = noteToHz(leadNotes[Math.floor(t / (beat * 2)) % leadNotes.length]);
    sample += Math.sin(2 * Math.PI * t * leadHz) * leadEnv * 0.055;
    sample += saw(t * leadHz * 0.5) * leadEnv * 0.025;

    const introFade = Math.min(1, t / 2);
    const outroFade = Math.min(1, (durationSeconds - t) / 2);
    sample = clamp(sample * 0.72 * introFade * outroFade);

    const left = Math.round(sample * 32767);
    const right = Math.round(clamp(sample * 0.96 + Math.sin(2 * Math.PI * t * 0.18) * 0.01) * 32767);
    buffer.writeInt16LE(left, offset);
    buffer.writeInt16LE(right, offset + 2);
    offset += 4;
  }

  writeFileSync(path, buffer);
}

writeWav(audioPath);

const commonVideo = 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,eq=contrast=1.16:saturation=1.22:brightness=-0.025:gamma=0.96,vignette=PI/5,fps=30,format=yuv420p';
const hasGameplay = existsSync(gameplayPath);
const args = hasGameplay
  ? [
      '-y',
      '-ss', String(gameplayStartSeconds),
      '-i', gameplayPath,
      '-i', audioPath,
      '-filter_complex',
      `[0:v]${commonVideo},tpad=stop_mode=clone:stop_duration=${durationSeconds},trim=0:${durationSeconds},setpts=PTS-STARTPTS[v]`,
      '-map', '[v]',
      '-map', '1:a:0',
      '-t', String(durationSeconds),
      '-c:v', 'libvpx-vp9',
      '-b:v', '3200k',
      '-crf', '31',
      '-row-mt', '1',
      '-deadline', 'good',
      '-c:a', 'libopus',
      '-b:a', '128k',
      '-shortest',
      outPath,
    ]
  : [
      '-y',
      '-i', sourcePath,
      '-i', audioPath,
      '-t', String(durationSeconds),
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-vf', commonVideo,
      '-c:v', 'libvpx-vp9',
      '-b:v', '3200k',
      '-crf', '31',
      '-row-mt', '1',
      '-deadline', 'good',
      '-c:a', 'libopus',
      '-b:a', '128k',
      '-shortest',
      outPath,
    ];

const result = spawnSync(ffmpeg.path, args, { stdio: 'inherit' });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Wrote ${outPath} (${durationSeconds}s, gameplay=${hasGameplay ? 'yes' : 'no'})`);
