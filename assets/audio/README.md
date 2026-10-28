# Narrations françaises · Memoria Corti

Les sept fichiers MP3 contiennent les textes existants de l’accueil, du récit principal et des cinq repères. Ils ont été **générés par IA**, avec la voix française prédéfinie `ff_siwis` de Kokoro, puis encodés en MP3 mono à 24 kHz, 64 kbit/s. Ce ne sont pas des témoignages ni des enregistrements d’archives. La source « Voix IA naturelle » est affichée dans le lecteur.

La génération s’effectue localement, au moment du développement. **Aucun modèle, abonnement, compte vocal ou clé API n’est requis sur le site.** Les fichiers sont chargés uniquement lorsqu’une personne demande la lecture. Les textes des histoires ne sont pas envoyés à un service vocal lors de l’utilisation du site.

Le pipeline `fr-utf8-2` force l’entrée UTF-8 avec les arguments séparés `-b`, `1`. La syntaxe précédente `-b=1` était mal interprétée par cette compilation d’eSpeak : un « é » pouvait être traité comme « Ã© », dont le symbole © était lu « copyright ». Les sept fichiers ont été régénérés ; ils conservent les accents, les élisions françaises et les pauses de ponctuation. Les acronymes et l’élision « d’aujourd’hui » ont une normalisation de prononciation séparée, sans modifier les textes affichés.

Les crédits et mentions IA sont uniquement des métadonnées affichées. Ils ne sont jamais fournis comme texte à prononcer. Chaque URL audio comporte une empreinte du nouveau fichier pour éviter de réutiliser une ancienne version en cache. `narrations.json` contient aussi la transcription phonétique et le texte de lecture de chaque phrase pour contrôler la génération.

Provenance :

- Modèle original [Kokoro-82M, hexgrad](https://huggingface.co/hexgrad/Kokoro-82M), poids sous Apache-2.0 ; [liste officielle des voix](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md).
- Conversion de modèle [onnx-community/Kokoro-82M-v1.0-ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX), variante quantifiée q8, voix `ff_siwis`.
- Outil de phonétisation français [eSpeak NG](https://github.com/espeak-ng/espeak-ng), utilisé hors ligne via [espeak-ng.js](https://github.com/ianmarmour/espeak-ng.js). Son son robotique n’est pas utilisé dans les fichiers : seules ses transcriptions phonétiques alimentent Kokoro.
- Encodage MP3 avec [lamejs](https://github.com/shijinyu/lamejs), uniquement lors de la génération.

`narrations.json` contient les durées calculées depuis le signal original, les empreintes SHA-256 des textes et des MP3, leur taille et des contrôles de niveau sonore. La compression ajoute un bref délai d’encodeur ; le lecteur utilise la durée réelle du fichier après lecture de ses métadonnées. Les durées initialement estimées dans le projet ne sont pas utilisées pour ces fichiers.

Pour régénérer les narrations après une modification de texte :

```powershell
$env:NODE_USE_SYSTEM_CA = '1'
npm.cmd install --prefix .tools/narration --no-audit --no-fund @huggingface/transformers@3.8.1 espeak-ng@1.0.2 @breezystack/lamejs@1.2.7
node --use-system-ca scripts/generate-narrations.mjs
```

Le script produit aussi `content/narrations.js` pour les chemins, droits et durées. `.tools/` est ignoré par Git et ne doit pas être déployé. Une phrase trop longue ou un signal silencieux entraîne une erreur plutôt qu’une troncature du récit. Le choix de rythme et la voix de secours du navigateur sont des préférences locales. Les noms corses et les intonations peuvent encore bénéficier d’une direction vocale ou d’enregistrements humains.
