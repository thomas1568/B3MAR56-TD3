// One narration at a time. Every playback method is called from a user action.
// No fabricated archive recording, commercial music or synthesized ambience.
export function createAudioController({ speech = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, AudioClass = globalThis.Audio, onChange = () => {} } = {}) {
  let generation = 0, narration = null, utterance = null, ambience = null, music = null;
  let volume = 0.8;
  const state = { title: '', text: '', playing: false, paused: false, source: '', message: 'Audio à fournir', ambience: 'Ambiances à fournir' };
  const ready = asset => !!asset?.src && asset.rights?.status === 'autorise';
  const emit = () => { duck(); onChange({ ...state, volume }); };
  function duck() {
    if (ambience) ambience.volume = volume * (state.playing && !state.paused ? 0.08 : 0.3);
    if (music) music.volume = volume * (state.playing && !state.paused ? 0.08 : 0.25);
  }
  function stopNarration() {
    generation++;
    narration?.pause(); narration = null;
    if (speech && utterance) { speech.cancel(); speech.resume(); }
    utterance = null; state.playing = false; state.paused = false;
    state.title = ''; state.text = ''; state.source = ''; state.message = ''; emit();
  }
  async function play(track, { synthetic = false } = {}) {
    stopNarration(); const token = generation;
    state.title = track.title; state.text = track.text || track.transcript || ''; state.message = '';
    if (synthetic) {
      state.source = 'Synthèse vocale — lecture du texte, pas un enregistrement historique';
      if (!speech || !Utterance) { state.message = 'Synthèse indisponible. Audio à fournir ; transcription accessible.'; emit(); return false; }
      utterance = new Utterance(state.text); utterance.lang = 'fr-FR'; utterance.rate = 0.95; utterance.volume = volume;
      utterance.onend = () => { if (token !== generation) return; state.playing = false; state.paused = false; emit(); };
      utterance.onerror = event => { if (token !== generation) return; state.playing = false; state.paused = false; state.message = 'Lecture vocale indisponible : ' + (event.error || 'erreur'); emit(); };
      state.playing = true; emit();
      try { speech.speak(utterance); return true; }
      catch (error) { state.playing = false; state.message = 'Lecture vocale indisponible : ' + error.message; emit(); return false; }
    }
    state.source = 'Enregistrement';
    if (!ready(track.audio) || !AudioClass) { state.message = 'Audio à fournir. Vous pouvez lire la transcription ou choisir la synthèse vocale.'; emit(); return false; }
    const audio = new AudioClass(track.audio.src); narration = audio; audio.volume = volume;
    audio.onended = () => { if (token !== generation) return; state.playing = false; state.paused = false; emit(); };
    audio.onerror = () => { if (token !== generation) return; state.playing = false; state.paused = false; state.message = 'Fichier audio indisponible.'; emit(); };
    try {
      await audio.play();
      if (token !== generation) { audio.pause(); return false; }
      state.playing = true; emit(); return true;
    } catch (error) { if (token === generation) { state.message = 'Lecture audio impossible : ' + error.message; emit(); } return false; }
  }
  function pause() {
    if (!state.playing || state.paused) return;
    narration?.pause(); if (utterance) speech.pause(); state.paused = true; emit();
  }
  async function resume() {
    if (!state.paused) return;
    const token = generation;
    try {
      const current = narration;
      if (current) await current.play(); else if (utterance) speech.resume();
      if (token !== generation) { current?.pause(); return; }
      state.paused = false; emit();
    } catch (error) { if (token === generation) { state.message = 'Reprise impossible : ' + error.message; emit(); } }
  }
  function setVolume(value) {
    volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (narration) narration.volume = volume; if (utterance) utterance.volume = volume; emit();
  }
  async function setAmbience(asset) {
    ambience?.pause(); ambience = null;
    if (!ready(asset) || !AudioClass) { state.ambience = asset ? 'Ambiance à fournir : ' + asset.title : 'Ambiance arrêtée'; emit(); return false; }
    const audio = new AudioClass(asset.src); ambience = audio; audio.loop = true; duck();
    try { await audio.play(); if (ambience !== audio) { audio.pause(); return false; } state.ambience = asset.title; emit(); return true; }
    catch (error) { if (ambience === audio) { ambience = null; state.ambience = 'Ambiance indisponible : ' + error.message; emit(); } return false; }
  }
  async function playMusic(asset) {
    music?.pause(); music = null;
    if (!ready(asset) || !AudioClass) return false;
    const audio = new AudioClass(asset.src); music = audio; duck();
    try { await audio.play(); if (music !== audio) { audio.pause(); return false; } return true; }
    catch (error) { if (music === audio) { music = null; state.message = 'Musique indisponible : ' + error.message; emit(); } return false; }
  }
  function stopAll() { stopNarration(); ambience?.pause(); ambience = null; music?.pause(); music = null; state.ambience = 'Ambiance arrêtée'; emit(); }
  return { play, pause, resume, setVolume, setAmbience, playMusic, stopNarration, stopAll, getState: () => ({ ...state, volume }), supportsSpeech: !!speech && !!Utterance };
}
