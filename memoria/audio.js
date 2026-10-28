import { createHeritageMusic } from './music.js?v=18';

export function chooseFrenchVoice(voices = [], preferredURI = '') {
  const french = voices.filter(voice => /^fr(?:[-_]|$)/i.test(voice.lang));
  const preferred = french.find(voice => voice.voiceURI === preferredURI);
  const rank = voice => (/natural|neural|enhanced|premium|siri|google/i.test(voice.name) ? 10 : 0) + (/^fr[-_]FR$/i.test(voice.lang) ? 3 : 0) + (voice.default ? 1 : 0);
  return preferred || [...french].sort((a,b) => rank(b) - rank(a))[0] || null;
}

// One narration at a time. The original instrumental score is distinct from archives.
export function createAudioController({ speech = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, AudioClass = globalThis.Audio, MusicFactory = createHeritageMusic, onChange = () => {} } = {}) {
  let generation = 0, narration = null, utterance = null, ambience = null, music = null;
  let volume = 0.8, rate = 1;
  const state = { title: '', text: '', playing: false, paused: false, loading: false, source: '', message: 'Audio à fournir', ambience: 'Ambiances à fournir', musicPlaying: false, musicMessage: '', currentTime: 0, duration: 0 };
  const ready = asset => !!asset?.src && asset.rights?.status === 'autorise';
  const emit = () => { duck(); onChange({ ...state, volume }); };
  const score = MusicFactory({ onChange: value => { state.musicPlaying = value.playing; emit(); } });
  function duck() {
    if (ambience) ambience.volume = volume * (state.playing && !state.paused ? 0.08 : 0.3);
    if (music) music.volume = volume * (state.playing && !state.paused ? 0.08 : 0.25);
    score?.setVolume(volume * (state.playing && !state.paused ? 0.05 : 0.22));
  }
  function stopNarration() {
    generation++;
    narration?.pause(); narration = null;
    if (speech && utterance) { speech.cancel(); speech.resume(); }
    utterance = null; state.playing = false; state.paused = false; state.loading = false; state.currentTime = 0; state.duration = 0;
    state.title = ''; state.text = ''; state.source = ''; state.message = ''; emit();
  }
  async function play(track, { synthetic = false, voiceURI = '' } = {}) {
    stopNarration(); const token = generation;
    state.title = track.title; state.text = track.text || track.transcript || ''; state.message = '';
    if (synthetic) {
      state.source = 'Synthèse vocale — lecture du texte, pas un enregistrement historique';
      if (!speech || !Utterance) { state.message = 'Synthèse indisponible. Audio à fournir ; transcription accessible.'; emit(); return false; }
      const voice = chooseFrenchVoice(speech.getVoices?.() || [], voiceURI);
      utterance = new Utterance(state.text); utterance.lang = voice?.lang || 'fr-FR'; utterance.rate = rate * .97; utterance.volume = volume;
      if (voice) { utterance.voice = voice; state.source = `Synthèse vocale de cet appareil · ${voice.name}`; }
      utterance.onend = () => { if (token !== generation) return; state.playing = false; state.paused = false; emit(); };
      utterance.onerror = event => { if (token !== generation) return; state.playing = false; state.paused = false; state.message = 'Lecture vocale indisponible : ' + (event.error || 'erreur'); emit(); };
      state.playing = true; emit();
      try { speech.speak(utterance); return true; }
      catch (error) { state.playing = false; state.message = 'Lecture vocale indisponible : ' + error.message; emit(); return false; }
    }
    state.source = track.audio?.kind === 'ai-narration' ? 'Voix IA naturelle · français' : 'Enregistrement';
    if (!ready(track.audio) || !AudioClass) { state.message = 'Audio à fournir. Vous pouvez lire la transcription ou choisir la synthèse vocale.'; emit(); return false; }
    const audio = new AudioClass(track.audio.src); narration = audio; audio.volume = volume; audio.playbackRate = rate;
    state.loading = true; state.message = 'Chargement de la narration…'; state.duration = track.audio.duration || 0; emit();
    audio.onloadedmetadata = () => { if (token !== generation) return; if (Number.isFinite(audio.duration)) state.duration = audio.duration; emit(); };
    audio.ontimeupdate = () => { if (token !== generation) return; state.currentTime = audio.currentTime || 0; emit(); };
    audio.onwaiting = () => { if (token !== generation) return; state.loading = true; state.message = 'Chargement de la narration…'; emit(); };
    audio.onplaying = () => { if (token !== generation) return; state.loading = false; state.message = ''; emit(); };
    audio.onended = () => { if (token !== generation) return; state.playing = false; state.paused = false; state.loading = false; state.currentTime = state.duration; state.message = ''; emit(); };
    audio.onerror = () => { if (token !== generation) return; state.playing = false; state.paused = false; state.loading = false; state.message = 'Fichier audio indisponible. Vous pouvez choisir la voix de cet appareil ou lire la transcription.'; emit(); };
    try {
      await audio.play();
      if (token !== generation) { audio.pause(); return false; }
      state.playing = true; state.loading = false; state.message = ''; emit(); return true;
    } catch (error) { if (token === generation) { state.loading = false; state.message = 'Lecture audio impossible. Réessayez ou choisissez la voix de cet appareil. ' + error.message; emit(); } return false; }
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
  function setRate(value) {
    rate = Math.max(.8, Math.min(1.25, Number(value) || 1));
    if (narration) narration.playbackRate = rate;
    // Speech engines apply rate changes on the next utterance.
    emit();
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
    score.stop(); state.musicMessage = '';
    if (asset?.kind === 'original-score') {
      try { const started = await score.start(); if (started) state.musicMessage = asset.title; emit(); return started; }
      catch { state.musicMessage = 'Son indisponible. Touchez Musique pour réessayer.'; emit(); return false; }
    }
    if (!ready(asset) || !AudioClass) return false;
    const audio = new AudioClass(asset.src); music = audio; duck();
    try { await audio.play(); if (music !== audio) { audio.pause(); return false; } return true; }
    catch (error) { if (music === audio) { music = null; state.message = 'Musique indisponible : ' + error.message; emit(); } return false; }
  }
  function stopMusic() { music?.pause(); music = null; score.stop(); state.musicMessage = ''; emit(); }
  function stopAll() { stopNarration(); ambience?.pause(); ambience = null; stopMusic(); state.ambience = 'Ambiance arrêtée'; emit(); }
  return { play, pause, resume, setVolume, setRate, setAmbience, playMusic, stopMusic, unlockMusic: () => score.unlock(), stopNarration, stopAll, getState: () => ({ ...state, volume, rate }), getSpeechVoices: () => (speech?.getVoices?.() || []).filter(voice => /^fr(?:[-_]|$)/i.test(voice.lang)), supportsSpeech: !!speech && !!Utterance };
}
