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
    "pt-BR-FranciscaNeural",
]

EN_CANDIDATES = [
    "en-US-AvaNeural",
    "en-US-EmmaNeural",
    "en-US-MichelleNeural",
    "en-US-AnaNeural",
]

VEGA_PROSODY = {
    "pt": {"pitch": "+11Hz", "rate": "+13%"},
    "en": {"pitch": "+6Hz", "rate": "+10%"},
}


def normalize_pt_speech(text: str) -> str:
    """Adapta expressões estrangeiras em textos PT para pronúncia 100% brasileira natural."""
    replacements = [
        ("Museum of Lost Space Technology", "Museu de Tecnologia Espacial Perdida"),
        ("'We came in peace for all mankind'", "Viemos em paz por toda a humanidade"),
        ("We came in peace for all mankind", "Viemos em paz por toda a humanidade"),
        ("'corner cube'", "'canto de cubo'"),
        ("corner cube", "canto de cubo"),
        ("'moonquakes'", "'lunamotos'"),
        ("moonquakes", "lunamotos"),
        ("Mare Tranquillitatis", "Mar da Tranquilidade"),
        ("Apollo J-series", "últimas missões Apollo"),
        ("Passive Seismic Experiment", "Experimento Sísmico Passivo"),
        ("Tranquility Base", "Base Tranquilidade"),
        ("delay de rádio", "atraso de rádio"),
        ("CSM Columbia", "módulo de comando Columbia"),
        ("Lunar Module", "Módulo Lunar"),
    ]
    out = text
    for old, new in replacements:
        out = out.replace(old, new)
    return out


def parse_exported_object(source: str, name: str) -> dict:
    """Extrai um objeto exportado em js/data.js por balanceamento de chaves e converte para JSON."""
    m = re.search(rf"export const {re.escape(name)}\s*=\s*\{{", source)
    if not m:
        raise RuntimeError(f"Não foi possível localizar {name} em js/data.js")
    start = m.end() - 1
    depth = 0
    in_str = False
    escaped = False
    end = None
    for idx in range(start, len(source)):
        ch = source[idx]
        if in_str:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_str = False
        else:
            if ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = idx + 1
                    break
    if end is None:
        raise RuntimeError(f"Chaves desbalanceadas em {name}")
    raw = source[start:end]

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


def collect_clips(quiz_data: dict, journey_data: dict):
    """Retorna lista de (filename, lang, text) para todas as falas da Comandante Vega."""
    clips = []
    for lang in ("pt", "en"):
        q_lang = quiz_data[lang]
        j_lang = journey_data[lang]
        for age in ("child", "teen", "adult"):
            g = q_lang["greeting"][age]
            clips.append((f"vega-{lang}-{age}-greeting.mp3", lang, f"{g['title']} {g['message']}"))

            for idx, q_item in enumerate(q_lang["questions"]):
                q = q_item[age]
                clips.append((f"vega-{lang}-{age}-q{idx}.mp3", lang, q["question"]))
                clips.append((f"vega-{lang}-{age}-q{idx}-ok.mp3", lang, q["onCorrect"]))
                clips.append((f"vega-{lang}-{age}-q{idx}-help.mp3", lang, q["onWrong"]))

            for aid, ch_ages in j_lang["siteChapters"].items():
                clips.append((f"vega-{lang}-{age}-chap-{aid}.mp3", lang, ch_ages[age]))

            letter = j_lang["missionLetter"][age]
            letter_text = f"{letter['title']} {' '.join(letter['paragraphs'])}"
            clips.append((f"vega-{lang}-{age}-letter.mp3", lang, letter_text))

            clips.append((f"vega-{lang}-{age}-cert.mp3", lang, j_lang["certificateDelivery"][age]))

            inv = j_lang["invite3D"]["profiles"][age]
            clips.append((f"vega-{lang}-{age}-invite3d.mp3", lang, f"{inv['title']} {inv['message']}"))

        for key, text in j_lang["comms3D"].items():
            clips.append((f"vega-{lang}-comms-{key}.mp3", lang, text))

        for aid, text in j_lang["chapterBridges"].items():
            clips.append((f"vega-{lang}-bridge-{aid}.mp3", lang, text))

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

    source_text = DATA_JS.read_text(encoding="utf-8")
    quiz_data = parse_exported_object(source_text, "MISSION_QUIZ")
    journey_data = parse_exported_object(source_text, "VEGA_JOURNEY")
    clips = collect_clips(quiz_data, journey_data)
    missing = [(f, l, t) for f, l, t in clips if not (OUT_DIR / f).exists() or (OUT_DIR / f).stat().st_size == 0]
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if not missing:
        print(f"Todos os {len(clips)} clipes já existem em {OUT_DIR}.")
        return

    chosen = await select_voices(edge_tts)
    print(f"Vozes selecionadas para Comandante Vega -> PT: {chosen['pt']} | EN: {chosen['en']}")
    print(f"Gerando {len(missing)} clipes novos (de {len(clips)} totais) em {OUT_DIR} ...")

    sem = asyncio.Semaphore(6)

    async def synth_one(fname, lang, text):
        out_path = OUT_DIR / fname
        voice = chosen[lang]
        prosody = VEGA_PROSODY[lang]
        spoken_text = normalize_pt_speech(text) if lang == "pt" else text
        async with sem:
            for attempt in range(3):
                try:
                    comm = edge_tts.Communicate(
                        text=spoken_text,
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

    await asyncio.gather(*(synth_one(f, l, t) for f, l, t in missing))
    print(f"Concluído: {len(missing)} clipes salvos ({len(clips)} no total).")


if __name__ == "__main__":
    asyncio.run(main())
