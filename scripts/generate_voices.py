#!/usr/bin/env python3
"""
Gera todos os áudios neurais (Microsoft Edge TTS) para o Museu do Silêncio Lunar.
100% gratuito e sem necessidade de API Key.

Uso:
  pip install edge-tts
  python3 scripts/generate_voices.py
"""

import asyncio
import os
import re
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("Pacote 'edge-tts' não encontrado. Instale com: pip install edge-tts")
    raise SystemExit(1)

ROOT = Path(__file__).resolve().parent.parent
DATA_JS = ROOT / "js" / "data.js"
OUT_DIR = ROOT / "assets" / "audio"

# Uma voz neural com personalidade diferente para cada equipamento
VOICES = {
    "lrrr": {"pt": ("pt-BR-AntonioNeural", "+0Hz", "+0%"), "en": ("en-US-GuyNeural", "+0Hz", "+0%")},
    "pse": {"pt": ("pt-BR-FranciscaNeural", "+0Hz", "+0%"), "en": ("en-US-AriaNeural", "+0Hz", "+0%")},
    "eagle": {"pt": ("pt-BR-AntonioNeural", "-6Hz", "-4%"), "en": ("en-US-ChristopherNeural", "+0Hz", "+0%")},
    "lrv": {"pt": ("pt-BR-ThalitaNeural", "+0Hz", "+0%"), "en": ("en-US-JennyNeural", "+0Hz", "+0%")},
}


def extract_stories_from_data_js(text: str):
    """Extrai blocos de stories { child, teen, adult } para pt e en de cada artefato."""
    results = {}
    artifact_ids = ["lrrr", "pse", "eagle", "lrv"]

    # Localiza o início de cada artefato no array ARTIFACTS
    positions = []
    for aid in artifact_ids:
        m = re.search(rf'id:\s*"{aid}"', text)
        if m:
            positions.append((m.start(), aid))
    positions.sort()

    for i, (start_pos, aid) in enumerate(positions):
        end_pos = positions[i + 1][0] if i + 1 < len(positions) else len(text)
        chunk = text[start_pos:end_pos]
        results[aid] = {}

        for lang in ("pt", "en"):
            lang_match = re.search(rf'\b{lang}:\s*\{{', chunk)
            if not lang_match:
                continue
            lang_sub = chunk[lang_match.start():]
            stories_match = re.search(r'stories:\s*\{', lang_sub)
            if not stories_match:
                continue
            stories_sub = lang_sub[stories_match.start():]
            results[aid][lang] = {}

            for age in ("child", "teen", "adult"):
                age_match = re.search(rf'\b{age}:\s*\[(.*?)\]', stories_sub, re.DOTALL)
                if not age_match:
                    continue
                raw_array = age_match.group(1)
                # Extrai strings entre aspas duplas (tratando escapes simples)
                paragraphs = re.findall(r'"((?:[^"\\]|\\.)*)"', raw_array)
                cleaned = [p.replace('\\"', '"').replace("\\n", " ").strip() for p in paragraphs]
                results[aid][lang][age] = cleaned

    return results


def extract_qa_from_data_js(text: str):
    """Extrai respostas Q&A de ARTIFACT_INTERACTIONS para pt e en de cada artefato."""
    results = {}
    inter_match = re.search(r'ARTIFACT_INTERACTIONS\s*=\s*\{', text)
    if not inter_match:
        return results
    inter_chunk = text[inter_match.start():]
    end_match = re.search(r'\n(?:export\s+)?const\s+MISSION_QUIZ\b', inter_chunk)
    if end_match:
        inter_chunk = inter_chunk[:end_match.start()]

    artifact_ids = ["lrrr", "pse", "eagle", "lrv"]
    positions = []
    for aid in artifact_ids:
        m = re.search(rf'\n\s*{aid}:\s*\{{', inter_chunk)
        if m:
            positions.append((m.start(), aid))
    positions.sort()

    for i, (start_pos, aid) in enumerate(positions):
        end_pos = positions[i + 1][0] if i + 1 < len(positions) else len(inter_chunk)
        chunk = inter_chunk[start_pos:end_pos]
        qa_match = re.search(r'\bqa:\s*\[', chunk)
        if not qa_match:
            continue
        qa_sub = chunk[qa_match.start():]
        results[aid] = {"pt": [], "en": []}

        for lang in ("pt", "en"):
            answers = re.findall(
                rf'\b{lang}:\s*\{{[^}}]*?\ba:\s*"((?:[^"\\]|\\.)*)"',
                qa_sub,
                re.DOTALL,
            )
            results[aid][lang] = [
                a.replace('\\"', '"').replace("\\n", " ").strip() for a in answers
            ]

    return results


async def generate_all():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    raw = DATA_JS.read_text(encoding="utf-8")
    stories = extract_stories_from_data_js(raw)
    qa_answers = extract_qa_from_data_js(raw)

    tasks = []
    for aid, langs in stories.items():
        for lang, ages in langs.items():
            voice, pitch, rate = VOICES[aid][lang]
            for age, paragraphs in ages.items():
                for idx, text in enumerate(paragraphs):
                    out_file = OUT_DIR / f"{aid}-{lang}-{age}-p{idx}.mp3"
                    if out_file.exists():
                        continue
                    tasks.append((text, voice, pitch, rate, out_file))

    for aid, langs in qa_answers.items():
        for lang, answers in langs.items():
            voice, pitch, rate = VOICES[aid][lang]
            for idx, text in enumerate(answers):
                out_file = OUT_DIR / f"{aid}-{lang}-qa{idx}.mp3"
                if out_file.exists():
                    continue
                tasks.append((text, voice, pitch, rate, out_file))

    print(f"Total de áudios a gerar: {len(tasks)}")
    for i, (text, voice, pitch, rate, out_file) in enumerate(tasks, 1):
        print(f"[{i}/{len(tasks)}] {out_file.name} ({voice}, pitch={pitch}, rate={rate})")
        communicate = edge_tts.Communicate(text, voice, pitch=pitch, rate=rate)
        await communicate.save(str(out_file))

    print("Concluído! Os arquivos foram salvos em assets/audio/.")


if __name__ == "__main__":
    asyncio.run(generate_all())
