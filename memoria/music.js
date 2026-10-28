// Original Memoria Corti score: soft plucked strings and a quiet sustained chord.
// No recording, network request or third-party musical work is used.
export const HERITAGE_SCORE = {
  title: 'Petra · Memoria Corti', bpm: 72, beats: 4,
  chords: [[50,57,60,64,69], [46,53,57,60,65], [48,55,57,60,64], [45,52,55,59,64]],
  melody: [69,72,76,74, 65,69,72,69, 67,72,76,72, 64,67,71,69]
};

export function createHeritageMusic({ AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
  onChange = () => {}, setTimer = globalThis.setInterval, clearTimer = globalThis.clearInterval } = {}) {
  let context = null, output = null, timer = null, generation = 0, playing = false, nextBar = 0, bar = 0, volume = .2;
  const voices = new Set();
  const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
  const state = () => ({ playing, supported: !!AudioContextClass });
  function ensureContext() {
    if (!AudioContextClass) throw Error('Le son n’est pas disponible dans ce navigateur.');
    if (!context || context.state === 'closed') {
      context = new AudioContextClass(); output = context.createGain();
      output.gain.value = volume; output.connect(context.destination);
    }
    return context;
  }
  // Called synchronously during the original AR/toggle click on mobile browsers.
  async function unlock() { const ctx = ensureContext(); await ctx.resume(); }
  function note(midi, time, duration, level, plucked = true) {
    const oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.type = plucked ? 'triangle' : 'sine'; oscillator.frequency.value = frequency(midi);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + (plucked ? .018 : .55));
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(envelope); envelope.connect(output); voices.add(oscillator);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); voices.delete(oscillator); };
    oscillator.start(time); oscillator.stop(time + duration + .03);
  }
  function schedule() {
    if (!playing || context.state !== 'running') return;
    const beat = 60 / HERITAGE_SCORE.bpm, length = beat * HERITAGE_SCORE.beats;
    // Resuming a throttled tab never schedules a burst of missed notes.
    if (nextBar < context.currentTime) nextBar = context.currentTime + .05;
    while (nextBar < context.currentTime + .3) {
      const chord = HERITAGE_SCORE.chords[bar % 4];
      chord.slice(0, 4).forEach(midi => note(midi - 12, nextBar, length * .98, .026, false));
      [0,2,3,4,2,3].forEach((index, i) => note(chord[index], nextBar + i * beat / 2, beat * 1.7, .11));
      [0,1].forEach(i => note(HERITAGE_SCORE.melody[(bar * 2 + i) % 16], nextBar + (i * 2 + .5) * beat, beat * 1.8, .055));
      nextBar += length; bar++;
    }
  }
  async function start() {
    const token = ++generation;
    await unlock();
    if (token !== generation) return false;
    if (!playing) {
      playing = true; nextBar = context.currentTime + .06; bar = 0;
      schedule(); timer = setTimer(schedule, 150); onChange(state());
    }
    return true;
  }
  function stop() {
    generation++; playing = false;
    if (timer !== null) clearTimer(timer); timer = null;
    for (const voice of voices) { try { voice.stop(); } catch {} }
    voices.clear();
    // A suspended context conserves phone battery and cannot restart itself.
    if (context?.state === 'running') context.suspend().catch(() => {});
    onChange(state());
  }
  function setVolume(value) {
    volume = Math.max(0, Math.min(.4, Number(value) || 0));
    if (output) output.gain.setTargetAtTime(volume, context.currentTime, .18);
  }
  return { unlock, start, stop, setVolume, getState: state };
}
