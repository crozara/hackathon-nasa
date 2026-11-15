#!/usr/bin/env python3
"""
Gera todos os clipes de voz neural da Comandante Vega (Quiz Final) via Microsoft Edge TTS.
Usa vozes distintas das 4 usadas pelos artefatos, com entonação leve e empolgada.
"""

import asyncio
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_JS = ROOT / "js" / "data.js"
OUT_DIR = ROOT / "assets" / "audio"

PT_CANDIDATES = [
    "pt-BR-ThalitaMultilingualNeural",
    "pt-BR-FranciscaNeural",
]

EN_CANDIDATES = [
    "en-US-AvaNeural",
    "en-US-EmmaNeural",
    "en-US-MichelleNeural",
    "en-US-AnaNeural",
]

VEGA_PROSODY = {
    "pt": {"pitch": "+9Hz", "rate": "+12%"},
    "en": {"pitch": "+6Hz", "rate": "+10%"},
}


def parse_mission_quiz(source: str) -> dict:
    """Extrai o objeto MISSION_QUIZ de js/data.js convertendo chaves JS para JSON válido."""
    m = re.search(r"export const MISSION_QUIZ\s*=\s*(\{[\s\S]*\});\s*$", source)
    if not m:
        raise RuntimeError("Não foi possível localizar MISSION_QUIZ em js/data.js")
    raw = m.group(1)

    # Protege strings literais para não alterar nada dentro delas
    strings = []

    def stash_str(match):
        strings.append(match.group(0))
        return f"__STR_{len(strings) - 1}__"

    masked = re.sub(r'"(?:\\.|[^"\\])*"', stash_str, raw)
    # Converte chaves bareword JS -> JSON
    masked = re.sub(r"([\{,\s])([A-Za-z_][A-Za-z0-9_]*)\s*:", r'\1"\2":', masked)
    # Restaura strings
    json_text = re.sub(r"__STR_(\d+)__", lambda mt: strings[int(mt.group(1))], masked)
    return json.loads(json_text)


def collect_clips(quiz_data: dict):
    """Retorna lista de (filename, lang, text) para todas as falas da Comandante Vega."""
    clips = []
    for lang in ("pt", "en"):
        q_lang = quiz_data[lang]
        for age in ("child", "teen", "adult"):
            g = q_lang["greeting"][age]
            clips.append((f"vega-{lang}-{age}-greeting.mp3", lang, f"{g['title']} {g['message']}"))

            for idx, q_item in enumerate(q_lang["questions"]):
                q = q_item[age]
                clips.append((f"vega-{lang}-{age}-q{idx}.mp3", lang, q["question"]))
                clips.append((f"vega-{lang}-{age}-q{idx}-ok.mp3", lang, q["onCorrect"]))
                clips.append((f"vega-{lang}-{age}-q{idx}-help.mp3", lang, q["onWrong"]))

        for tier_key, tier in q_lang["summary"].items():
            clips.append((f"vega-{lang}-sum-{tier_key}.mp3", lang, f"{tier['title']} {tier['message']}"))
    return clips


async def select_voices(edge_tts):
    voices = await edge_tts.list_voices()
    available = {v["ShortName"] for v in voices}

    pt_voice = next((v for v in PT_CANDIDATES if v in available), None)
    en_voice = next((v for v in EN_CANDIDATES if v in available), None)

    if not pt_voice or not en_voice:
        raise RuntimeError(f"Voz não encontrada (PT={pt_voice}, EN={en_voice})")
    return {"pt": pt_voice, "en": en_voice}


async def main():
    try:
        import edge_tts
    except ImportError:
        print("edge-tts não encontrado no PYTHONPATH", file=sys.stderr)
        raise SystemExit(1)

    quiz_data = parse_mission_quiz(DATA_JS.read_text(encoding="utf-8"))
    clips = collect_clips(quiz_data)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    chosen = await select_voices(edge_tts)
    print(f"Vozes selecionadas para Comandante Vega -> PT: {chosen['pt']} | EN: {chosen['en']}")
    print(f"Gerando {len(clips)} clipes em {OUT_DIR} ...")

    sem = asyncio.Semaphore(6)

    async def synth_one(fname, lang, text):
        out_path = OUT_DIR / fname
        voice = chosen[lang]
        prosody = VEGA_PROSODY[lang]
        async with sem:
            for attempt in range(3):
                try:
                    comm = edge_tts.Communicate(
                        text=text,
                        voice=voice,
                        pitch=prosody["pitch"],
                        rate=prosody["rate"],
                    )
                    await comm.save(str(out_path))
                    if out_path.exists() and out_path.stat().st_size > 0:
                        return
                except Exception as exc:
                    if attempt == 2:
                        raise RuntimeError(f"Falha ao gerar {fname}: {exc}") from exc
                    await asyncio.sleep(1.0)

    await asyncio.gather(*(synth_one(f, l, t) for f, l, t in clips))
    print(f"Concluído: {len(clips)} arquivos salvos com sucesso.")


if __name__ == "__main__":
    asyncio.run(main())
