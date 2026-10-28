import test from 'node:test';
import assert from 'node:assert/strict';
import { createHeritageMusic, HERITAGE_SCORE } from '../memoria/music.js';
import { createAudioController } from '../memoria/audio.js';

function fixture() {
  let ctx, tick, cleared = 0;
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime(value) { this.value = value; } });
  class Context {
    constructor() { ctx = this; this.state = 'suspended'; this.currentTime = 0; this.notes = []; this.destination = {}; }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    createOscillator() {
      const node = { frequency: param(), connect() {}, disconnect() {}, start(time) { this.startTime = time; }, stop(time) { this.stopTime = time; } };
      this.notes.push(node); return node;
    }
  }
  const player = createHeritageMusic({ AudioContextClass: Context, setTimer: callback => { tick = callback; return 1; }, clearTimer: () => cleared++ });
  return { player, context: () => ctx, tick: () => tick(), cleared: () => cleared };
}

test('score creates no audio context until interaction, schedules gentle valid notes and stops every voice', async () => {
  const { player, context, tick, cleared } = fixture();
  assert.equal(context(), undefined);
  await player.unlock(); assert.equal(context().notes.length, 0);
  await player.start(); assert.equal(player.getState().playing, true);
  assert.equal(context().notes.length, 12);
  for (const note of context().notes) {
    assert.ok(note.frequency.value > 30 && note.frequency.value < 1500);
    assert.ok(note.startTime >= .06 && note.stopTime > note.startTime);
  }
  context().currentTime = 20; tick();
  assert.equal(context().notes.length, 24, 'background throttling never replays missed bars');
  assert.ok(context().notes.slice(12).every(note => note.startTime >= 20));
  player.stop(); assert.equal(cleared(), 1); assert.equal(context().state, 'suspended');
  assert.equal(player.getState().playing, false);
  assert.ok(context().notes.every(note => note.stopTime === undefined));
  assert.equal(HERITAGE_SCORE.chords.length, 4);
});

test('a delayed audio permission cannot restart the score after exit', async () => {
  const { player, context } = fixture();
  await player.unlock(); let resolve;
  context().resume = () => new Promise(done => { resolve = done; });
  const starting = player.start(); player.stop(); resolve();
  assert.equal(await starting, false); assert.equal(player.getState().playing, false);
  assert.equal(context().notes.length, 0);
});

test('unsupported Web Audio is reported without breaking transcripts', async () => {
  const player = createHeritageMusic({ AudioContextClass: null });
  await assert.rejects(player.start(), /son n’est pas disponible/);
  player.stop(); assert.equal(player.getState().playing, false);
});

test('original music ducks under narration and is fully stopped on exit', async () => {
  let options, level = 0, stopped = 0;
  const score = { unlock: async () => {}, start: async () => { options.onChange({ playing: true }); return true; }, stop: () => { stopped++; options.onChange({ playing: false }); }, setVolume: value => { level = value; } };
  const audio = createAudioController({ MusicFactory: args => { options = args; return score; }, speech: { speak() {}, cancel() {}, resume() {}, pause() {} }, Utterance: class {} });
  await audio.playMusic({ kind: 'original-score', title: 'Petra' });
  assert.equal(audio.getState().musicPlaying, true); assert.ok(Math.abs(level - .176) < 1e-9);
  await audio.play({ title: 'Récit', text: 'Une histoire' }, { synthetic: true });
  assert.ok(Math.abs(level - .04) < 1e-9);
  audio.pause(); assert.ok(Math.abs(level - .176) < 1e-9);
  audio.stopAll(); assert.equal(audio.getState().musicPlaying, false); assert.ok(stopped >= 2);
});
