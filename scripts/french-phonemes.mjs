// Build-time French pronunciation. Never mix metadata/credits into the spoken text.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const PHONEME_VERSION = 'fr-utf8-2';
export function prepareReadingText(text) {
  return text.normalize('NFC').replace(/[’‘ʼ]/gu, "'")
    .replace(/\bIUT\b/gu, 'I U T').replace(/\bAR\b/gu, 'réalité augmentée')
    // Avoid an English dictionary fallback in the bundled eSpeak version.
    .replace(/aujourd'hui/giu, 'aujourdui');
}
function cleanIPA(text) {
  return text.replace(/d\u200dʒ/gu,'ʤ').replace(/t\u200dʃ/gu,'ʧ')
    .replace(/t\u200ds/gu,'ʦ').replace(/d\u200dz/gu,'ʣ')
    .replace(/\u200d/gu,'').replace(/\([a-z]{2}(?:-[a-z-]+)?\)/giu,'')
    .replace(/-/gu,'').replace(/\s+/gu,' ').trim().normalize('NFC');
}
export async function createFrenchPhonemizer() {
  const base = new URL('../.tools/narration/node_modules/espeak-ng/dist/', import.meta.url);
  const { default: Espeak } = await import(new URL('espeak-ng.js',base));
  const wasmBinary = await fs.readFile(new URL('espeak-ng.wasm',base));
  return async text => {
    const spoken = prepareReadingText(text), parts = spoken.split(/([,;:!?\.]+)/gu);
    const segments = [];
    for (const part of parts) {
      if (!part.trim()) continue;
      if (/^[,;:!?\.]+$/u.test(part)) { segments.push(part); continue; }
      const engine = await Espeak({
        // -b=1 is NOT equivalent: atoi('=1') selects automatic/Latin-1 decoding,
        // interpreting UTF-8 é bytes as Ã + © and pronouncing 'copyright'.
        arguments: ['--phonout','phonemes.txt','--sep=','-q','-b','1','--ipa=3','-v','fr-fr',part.trim()],
        wasmBinary, locateFile: file => fileURLToPath(new URL(file,base))
      });
      segments.push(cleanIPA(engine.FS.readFile('phonemes.txt',{encoding:'utf8'})));
    }
    const phonemes = segments.join(' ').replace(/\s+([,;:.!?])/gu,'$1').trim();
    if (!phonemes || /kɒpɪɹaɪt|(?:^| )atild(?: |$)/u.test(phonemes.replace(/[ˈˌ]/gu,''))) throw Error('Invalid French phonemes: unexpected encoding artifact.');
    return { spoken, phonemes };
  };
}
