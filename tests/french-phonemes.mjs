import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createFrenchPhonemizer, prepareReadingText } from '../scripts/french-phonemes.mjs';
import { IUT_STEP } from '../content/iut.js';

test('reading text preserves French accents and normalizes elisions and acronyms without adding credits', () => {
  assert.equal(prepareReadingText('À l’IUT, les étudiants d’aujourd’hui découvrent les repères.'), "À l'I U T, les étudiants d'aujourdui découvrent les repères.");
  assert.equal(prepareReadingText('e\u0301tudiants'), 'étudiants');
});

test('actual French phonemization handles accented words without copyright artifacts or English fallback', {
  skip: !existsSync(new URL('../.tools/narration/node_modules/espeak-ng/dist/espeak-ng.wasm',import.meta.url)) && 'Install the documented narration build tools to run the real eSpeak regression.'
}, async () => {
  const phonemize = await createFrenchPhonemizer();
  const result = await phonemize('Touchez les repères pour découvrir les étudiants d’aujourd’hui.');
  const normalized = result.phonemes.replace(/[ˈˌ]/gu,'');
  assert.match(normalized, /ʁəpɛʁ/); assert.match(normalized,/dekuvʁiʁ/);
  assert.match(normalized,/etydjɑ̃/); assert.match(normalized,/doʒuʁdyi/);
  assert.doesNotMatch(normalized,/kɒpɪɹaɪt|atild|\(en\)/);
  const punctuation = await phonemize('Ici, à Corte, observez le lieu.');
  assert.equal((punctuation.phonemes.match(/,/g)||[]).length,2);
  for (const track of [...Object.values(IUT_STEP.narrations),...IUT_STEP.points.map(point=>({text:point.transcript}))]) {
    const audit = await phonemize(track.text);
    assert.doesNotMatch(audit.phonemes.replace(/[ˈˌ]/gu,''),/kɒpɪɹaɪt|(?:^| )atild(?: |$)/);
  }
});
