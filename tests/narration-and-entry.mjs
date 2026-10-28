import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { chooseFrenchVoice, createAudioController } from '../memoria/audio.js';
import { IUT_STEP, mediaReady } from '../content/iut.js';
import { POINT_VISUALS } from '../content/point-visuals.js';

test('each story has a generated French audio file matching its unchanged transcript', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../assets/audio/narrations.json', import.meta.url)));
  const tracks = [...Object.values(IUT_STEP.narrations), ...IUT_STEP.points.map(point => ({ id: point.id, text: point.transcript, audio: point.audio }))];
  const hash = input => createHash('sha256').update(input).digest('hex');
  assert.equal(Object.keys(manifest.tracks).length, 7);
  assert.equal(manifest.phonemeVersion, 'fr-utf8-2');
  for (const track of tracks) {
    const entry = manifest.tracks[track.id], bytes = fs.readFileSync(new URL('../' + entry.src, import.meta.url));
    assert.equal(entry.textHash, hash(track.text)); assert.equal(entry.sha256, hash(bytes));
    assert.equal(entry.bytes, bytes.length); assert.ok(entry.duration > 5 && entry.duration < 150);
    assert.ok(entry.rms > .005 && entry.peak <= 1); assert.equal(mediaReady(track.audio), true);
    assert.equal(track.audio.kind, 'ai-narration'); assert.equal(track.audio.duration, entry.duration);
    assert.match(track.audio.src, /\?v=[a-f0-9]{12}$/);
    assert.ok(entry.phonemes?.length);
    for (const sentence of entry.phonemes) {
      assert.doesNotMatch(sentence.phonemes.replace(/[ˈˌ]/gu,''), /kɒpɪɹaɪt|(?:^| )atild(?: |$)/u);
      assert.doesNotMatch(sentence.spoken, /copyright|voix IA naturelle|Apache-2\.0/iu);
    }
  }
});

test('five preparation cards have different relevant local visuals, with photos distinguished from illustration', () => {
  assert.equal(new Set(Object.values(POINT_VISUALS).map(asset => asset.src)).size, 5);
  for (const asset of Object.values(POINT_VISUALS)) {
    assert.ok(asset.alt && asset.label); assert.ok(fs.existsSync(new URL('../' + asset.src, import.meta.url)));
    if (asset.src.endsWith('.jpg')) assert.ok(asset.author && asset.source && asset.license);
    else assert.match(asset.label, /Illustration/);
  }
});

test('French fallback selects the preferred voice or a higher quality French voice, never an English voice', () => {
  const basic = { lang: 'fr-FR', name: 'Basique', voiceURI: 'basic' };
  const natural = { lang: 'fr-FR', name: 'French Natural', voiceURI: 'natural' };
  const english = { lang: 'en-US', name: 'English Natural Premium', voiceURI: 'en' };
  assert.equal(chooseFrenchVoice([english,basic,natural]), natural);
  assert.equal(chooseFrenchVoice([english,basic,natural], 'basic'), basic);
  assert.equal(chooseFrenchVoice([english]), null);
});

test('file narration exposes its AI source, supports rhythm/pause/resume and reports loading failure', async () => {
  const files = []; class Audio {
    constructor(src) { this.src = src; files.push(this); }
    async play() {} pause() { this.paused = true; }
  }
  const audio = createAudioController({ AudioClass: Audio });
  audio.setRate(1.15); await audio.play({ title: 'Test', text: 'Récit', audio: { src: 'voice.mp3', kind: 'ai-narration', duration: 24, rights: { status: 'autorise' } } });
  assert.equal(files[0].playbackRate, 1.15); assert.match(audio.getState().source, /Voix IA naturelle/);
  assert.equal(audio.getState().duration,24); assert.equal(audio.getState().loading,false);
  files[0].currentTime = 4; files[0].ontimeupdate(); assert.equal(audio.getState().currentTime,4);
  audio.pause(); assert.equal(audio.getState().paused,true); await audio.resume(); assert.equal(audio.getState().paused,false);
  files[0].onerror(); assert.equal(audio.getState().playing,false); assert.match(audio.getState().message,/voix de cet appareil/);
  audio.stopAll(); assert.equal(audio.getState().duration,0); assert.equal(audio.getState().loading,false);
});
