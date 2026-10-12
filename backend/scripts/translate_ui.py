"""Machine-translate the interface strings into each DEC-29 language (step 3).

Reads Frontend/src/locales/_keys.json (from `npm run i18n:extract`) and writes
Frontend/src/locales/<code>.json. Only interface text is sent to the model — never patient
data. Every translation is checked: placeholders ({{name}}, {name}) must be unchanged and the
text non-empty; failures are retried once and otherwise left out (they show in English).
Safety-related strings are listed in _review.json for a native speaker to check.

    uv run python scripts/translate_ui.py            # all languages, only missing strings
    uv run python scripts/translate_ui.py ta hi      # some languages
    uv run python scripts/translate_ui.py --redo ta  # translate everything again
"""

import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import get_settings  # noqa: E402

LOCALES = Path(__file__).resolve().parents[2] / "Frontend" / "src" / "locales"
LANGUAGES = {
    "hi": "Hindi", "bn": "Bengali", "ta": "Tamil", "te": "Telugu", "mr": "Marathi", "gu": "Gujarati",
    "kn": "Kannada", "ml": "Malayalam", "or": "Odia", "pa": "Punjabi",
}
BATCH = 80
PLACEHOLDER = re.compile(r"\{\{\s*\w+\s*\}\}|\{\w+\}")
SAFETY = re.compile(r"emergenc|112|108|urgent|danger|chest pain|breath|not medical advice|can.t advise|doctor can decide|"
                    r"start, stop or change|suicid|harm|poison|overdose|call", re.I)

RULES = """You translate the user interface of MediVara, a health-records app for patients in India.
Translate each English string into {language}, written in its own script.
Rules:
- Keep every placeholder exactly as it is, for example {{{{name}}}}, {{{{count}}}} or {{patient}}. Never translate or remove them.
- Keep these as they are: MediVara, Medivara, PDF, ISL, AI, OK, IST, ElevenLabs, OpenRouter, Gemini, HbA1c, email addresses, numbers, units (mg, mg/dL, %), and symbols (·, →, …, “ ”).
- Plain, polite, simple words a patient understands (grade 6-8). Use the formal "you".
- Keep the meaning exact, especially for safety, privacy and medical messages. Do not add advice, do not drop warnings.
- Keep it short like the English (buttons stay short). Keep punctuation style.
- Return only the JSON object defined by the schema, with one item per input id."""


def call(language: str, items: list[tuple[str, str]], plural: bool) -> dict[str, dict]:
    s = get_settings()
    if plural:
        props = {"id": {"type": "string"}, "one": {"type": "string"}, "other": {"type": "string"}}
        task = "Each string contains {{count}}. Give the singular form (count = 1) as `one` and the plural form as `other`."
    else:
        props = {"id": {"type": "string"}, "text": {"type": "string"}}
        task = "Translate each string as `text`."
    schema = {
        "type": "object",
        "properties": {"items": {"type": "array", "items": {"type": "object", "properties": props, "required": list(props)}}},
        "required": ["items"],
    }
    body = {
        "model": s.openrouter_model,
        "messages": [
            {"role": "system", "content": RULES.format(language=language) + "\n" + task},
            {"role": "user", "content": json.dumps([{"id": i, "text": t} for i, t in items], ensure_ascii=False)},
        ],
        "response_format": {"type": "json_schema", "json_schema": {"name": "ui_translations", "strict": True, "schema": schema}},
        "provider": {"data_collection": "deny", "require_parameters": True},
        "temperature": 0.2,
        "stream": False,
    }
    r = httpx.post(f"{s.openrouter_base_url}/chat/completions", json=body, timeout=180,
                   headers={"Authorization": f"Bearer {s.openrouter_api_key}", "X-Title": "MediVara UI translation"})
    r.raise_for_status()
    content = r.json()["choices"][0]["message"]["content"]
    content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
    return {it["id"]: it for it in json.loads(content)["items"]}


def same_placeholders(a: str, b: str) -> bool:
    return sorted(PLACEHOLDER.findall(a)) == sorted(re.sub(r"\{\{\s*(\w+)\s*\}\}", r"{{\1}}", x) for x in PLACEHOLDER.findall(b))


def translate(code: str, keys: list[str], redo: bool) -> tuple[str, int, int]:
    path = LOCALES / f"{code}.json"
    catalog = {} if redo or not path.exists() else json.loads(path.read_text())
    singles = [k for k in keys if "{{count}}" not in k and k not in catalog]
    plurals = [k for k in keys if "{{count}}" in k and f"{k}_other" not in catalog]
    failed = 0
    for plural, todo in ((False, singles), (True, plurals)):
        for attempt in range(2):
            if not todo:
                break
            retry = []
            for start in range(0, len(todo), BATCH):
                chunk = todo[start:start + BATCH]
                ids = [(str(n), k) for n, k in enumerate(chunk)]
                try:
                    out = call(LANGUAGES[code], ids, plural)
                except Exception as exc:  # noqa: BLE001
                    print(f"  {code}: batch failed ({type(exc).__name__}); will retry")
                    retry += chunk
                    continue
                for i, k in ids:
                    item = out.get(i)
                    if plural:
                        one, other = (item or {}).get("one", "").strip(), (item or {}).get("other", "").strip()
                        if one and other and same_placeholders(k, one) and same_placeholders(k, other):
                            catalog[f"{k}_one"], catalog[f"{k}_other"] = one, other
                        else:
                            retry.append(k)
                    else:
                        text = (item or {}).get("text", "").strip()
                        if text and same_placeholders(k, text):
                            catalog[k] = text
                        else:
                            retry.append(k)
            todo = retry
        failed += len(todo)
    for brand in ("Medivara", "MediVara"):  # the product name is never translated or transliterated
        if brand in keys:
            catalog[brand] = brand
    path.write_text(json.dumps(dict(sorted(catalog.items())), ensure_ascii=False, indent=2) + "\n")
    return code, len(catalog), failed


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    redo = "--redo" in sys.argv
    codes = args or list(LANGUAGES)
    keys = json.loads((LOCALES / "_keys.json").read_text())
    with ThreadPoolExecutor(max_workers=5) as pool:
        for code, n, failed in pool.map(lambda c: translate(c, keys, redo), codes):
            print(f"{code}: {n} entries written, {failed} left in English (failed checks)")
    review = {
        "note": "Machine-translated (Gemini 2.5 Flash). Safety and medical messages below need a native speaker's review before release.",
        "reviewed": {c: False for c in LANGUAGES},
        "safety_keys": [k for k in keys if SAFETY.search(k)],
    }
    (LOCALES / "_review.json").write_text(json.dumps(review, ensure_ascii=False, indent=2) + "\n")
    print(f"{len(review['safety_keys'])} safety strings listed in _review.json for review")


if __name__ == "__main__":
    main()
