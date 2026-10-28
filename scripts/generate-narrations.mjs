// Build-time only. The deployed site needs neither the model nor these packages.
// npm install --prefix .tools/narration @huggingface/transformers@3.8.1 espeak-ng@1.0.2 @breezystack/lamejs@1.2.7
// node --use-system-ca scripts/generate-narrations.mjs [--only=accueil]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { IUT_STEP } from '../content/iut.js';
import { createFrenchPhonemizer, PHONEME_VERSION } from './french-phonemes.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const { env, AutoTokenizer, StyleTextToSpeech2Model, Tensor } = await import(new URL('../.tools/narration/node_modules/@huggingface/transformers/dist/transformers.node.mjs', import.meta.url));
const phonemize = await createFrenchPhonemizer();
const lameModule = await import(new URL('../.tools/narration/node_modules/@breezystack/lamejs/dist/lamejs.js', import.meta.url));
const lame = lameModule.Mp3Encoder ? lameModule : lameModule.default;
const modelId = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const voice = 'ff_siwis', sampleRate = 24000;
env.cacheDir = path.join(root, '.tools/narration/cache');
const output = path.join(root, 'assets/audio'); await fs.mkdir(output, { recursive: true });
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const digest = value => createHash('sha256').update(value).digest('hex');
const voiceFile = path.join(root, '.tools/narration', voice + '.bin');
let data;
try { data = await fs.readFile(voiceFile); }
catch {
  const response = await fetch(`https://huggingface.co/${modelId}/resolve/main/voices/${voice}.bin`, { signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw Error('Voice download failed: ' + response.status);
  data = Buffer.from(await response.arrayBuffer()); await fs.writeFile(voiceFile, data);
}
if (data.length !== 510 * 256 * 4) throw Error('Unexpected voice style file size: ' + data.length);
const styles = new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
console.log('Loading Kokoro French voice on CPU…');
const [model, tokenizer] = await Promise.all([
  StyleTextToSpeech2Model.from_pretrained(modelId, { dtype: 'q8', device: 'cpu', session_options: { intra_op_num_threads: 4, inter_op_num_threads: 1 } }),
  AutoTokenizer.from_pretrained(modelId)
]);
const entries = [...Object.values(IUT_STEP.narrations), ...IUT_STEP.points.map(point => ({ id: point.id, title: point.title, text: point.transcript }))];
const manifest = { model: modelId, voice, type: 'ai-narration', language: 'fr-FR', sampleRate, license: 'Apache-2.0', phonemeVersion: PHONEME_VERSION, tracks: {} };
let previous = null;
try { previous = JSON.parse(await fs.readFile(path.join(output, 'narrations.json'), 'utf8')); if (only) Object.assign(manifest.tracks,previous.tracks); } catch {}

for (const track of entries.filter(track => !only || only === track.id)) {
  const cached = previous?.tracks?.[track.id];
  if (previous?.phonemeVersion === PHONEME_VERSION && cached?.textHash === digest(track.text) && cached.phonemes?.length) {
    try {
      if (digest(await fs.readFile(path.join(root,cached.file))) === cached.sha256) {
        manifest.tracks[track.id] = cached; console.log(track.id + ' · corrected audio already current'); continue;
      }
    } catch {}
  }
  const sentences = track.text.match(/[^.!?]+[.!?]+|[^.!?]+$/gu).map(text => text.trim()).filter(Boolean);
  const segments = [], phonemeAudit = [];
  for (const sentence of sentences) {
    const { spoken, phonemes } = await phonemize(sentence);
    phonemeAudit.push({ text: sentence, spoken, phonemes });
    const { input_ids } = tokenizer(phonemes, { truncation: false });
    const length = input_ids.dims.at(-1) - 2;
    if (length > 509) throw Error('Sentence too long, refusing truncation: ' + track.id);
    const style = styles.slice(Math.max(0, length) * 256, (Math.max(0, length) + 1) * 256);
    const { waveform } = await model({ input_ids, style: new Tensor('float32', style, [1,256]), speed: new Tensor('float32', [1], [1]) });
    const samples = Float32Array.from(waveform.data);
    if (!samples.length || samples.some(sample => !Number.isFinite(sample))) throw Error('Invalid audio: ' + track.id);
    segments.push(samples, new Float32Array(Math.round(sampleRate * .22)));
  }
  const total = segments.reduce((size, samples) => size + samples.length, 0), pcm = new Int16Array(total);
  let offset = 0, peak = 0, energy = 0;
  for (const segment of segments) for (const sample of segment) {
    const value = Math.max(-1, Math.min(1, sample));
    peak = Math.max(peak, Math.abs(value)); energy += value * value; pcm[offset++] = Math.round(value * 32767);
  }
  if (peak < .05 || Math.sqrt(energy / total) < .005) throw Error('Silent audio: ' + track.id);
  const encoder = new lame.Mp3Encoder(1, sampleRate, 64), chunks = [];
  for (let i = 0; i < pcm.length; i += 1152) chunks.push(Buffer.from(encoder.encodeBuffer(pcm.subarray(i, i + 1152))));
  chunks.push(Buffer.from(encoder.flush()));
  const mp3 = Buffer.concat(chunks); await fs.writeFile(path.join(output, track.id + '.mp3'), mp3);
  const audioHash = digest(mp3);
  manifest.tracks[track.id] = { title: track.title, src: `assets/audio/${track.id}.mp3?v=${audioHash.slice(0,12)}`, file: `assets/audio/${track.id}.mp3`, duration: Math.round(total / sampleRate * 100) / 100, textHash: digest(track.text), sha256: audioHash, bytes: mp3.length, peak, rms: Math.sqrt(energy / total), phonemes: phonemeAudit };
  console.log(track.id, manifest.tracks[track.id].duration + ' s', mp3.length + ' bytes');
  await fs.writeFile(path.join(output, 'narrations.json'), JSON.stringify(manifest, null, 2) + '\n');
}
await model.dispose();
await fs.writeFile(path.join(output, 'narrations.json'), JSON.stringify(manifest, null, 2) + '\n');
const assets = Object.fromEntries(Object.entries(manifest.tracks).map(([id, track]) => [id, {
  src: track.src, kind: 'ai-narration', duration: track.duration,
  credit: 'Kokoro · ff_siwis · narration française créée pour Memoria Corti',
  rights: { status: 'autorise', label: 'Création pour Memoria Corti · modèle ouvert Apache-2.0' }
}]));
await fs.writeFile(path.join(root, 'content/narrations.js'), '// Generated by scripts/generate-narrations.mjs; do not edit paths or durations manually.\nexport const NARRATION_ASSETS = ' + JSON.stringify(assets, null, 2) + ';\n');
