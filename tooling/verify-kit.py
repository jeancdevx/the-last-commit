"""Check asset references, GLB node contracts, and the content inventory."""
import argparse
import hashlib
import json
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "public" / "assets"
INVENTORY = ASSETS / "inventory.json"


def demand(condition, message):
    if not condition:
        raise ValueError(message)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def read_asset(relative):
    path = ASSETS / relative
    demand(path.resolve().is_relative_to(ASSETS) and path.is_file(), f"Asset inexistente: {relative}")
    demand(path.stat().st_size > 0, f"Asset vacío: {relative}")
    return path


def read_glb_nodes(path):
    data = path.read_bytes()
    demand(len(data) >= 24, f"GLB truncado: {path.name}")
    header, version, length = struct.unpack_from("<4sII", data)
    demand(header == b"glTF" and version == 2 and length == len(data), f"Cabecera GLB inválida: {path.name}")
    json_len, chunk_type = struct.unpack_from("<I4s", data, 12)
    demand(chunk_type == b"JSON" and 20 + json_len <= len(data), f"Chunk GLB inválido: {path.name}")
    contents = json.loads(data[20:20 + json_len])
    return {item["name"] for item in contents.get("nodes", []) if "name" in item}, contents


def verify_scene():
    scene = read_json(read_asset("scene.json"))
    nodes = {}
    models = {}
    for relative in [scene["shell"], *(item["model"] for item in scene["instances"])]:
        if relative not in nodes:
            nodes[relative], models[relative] = read_glb_nodes(read_asset(relative))
    instances = {item["id"]: item for item in scene["instances"]}
    demand(len(instances) == len(scene["instances"]), "Hay instancias duplicadas.")
    for item in instances.values():
        if "parent" in item:
            parent_model = instances[item["parent"]]["model"]
            demand(item["anchor"] in nodes[parent_model], f"Ancla ausente: {item['anchor']}.")
    for key in ("panel", "ledger", "note", "exit"):
        spec = scene["interaction"][key]
        model = instances[spec["instance"]]["model"]
        demand(spec["node"] in nodes[model], f"Nodo ausente: {spec['node']}.")
    for name in scene["interaction"]["ornamentNodes"]:
        demand(name in nodes[f"models/tag-{name[-2:]}.glb"], f"Adorno ausente: {name}.")
    for model, expected in {
        "models/guard-tree.glb": {"BULBS_07", "BULBS_19", "BULBS_26"},
        "models/absence.glb": {"FLOOR_TRACE", "CABLE_STUB"},
        "models/workstation.glb": {"LAMP_EMITTER", "MUG"},
        "models/exit.glb": {"DOOR_LEAF", "PUSH_BAR", "EXIT_SIGN"},
    }.items():
        demand(expected <= nodes[model], f"Faltan nodos en {model}: {expected - nodes[model]}.")
    for model, glb in models.items():
        demand(all("uri" not in item for item in glb.get("images", [])), f"Imagen externa en {model}.")
    for name in ("roomToneAudio", "a07Audio"):
        read_asset(scene[name])
    return len(models), len(instances)


def verify_story():
    story = read_json(read_asset("story.es.json"))
    demand(story["title"] == "The Last Commit", "Título incorrecto.")
    demand([item["folio"] for item in story["puzzles"]] == ["07", "19", "26"], "Orden de folios incorrecto.")
    clues = story["clues"]
    for clue in clues.values():
        read_asset(clue["texture"])
        if "model" in clue:
            read_asset(clue["model"])
    for puzzle in story["puzzles"]:
        options = {item["id"] for item in puzzle["options"]}
        demand(len(options) == len(puzzle["options"]), f"Opciones duplicadas en {puzzle['id']}.")
        demand(puzzle["answer"] in options, f"Respuesta inexistente en {puzzle['id']}.")
        demand(set(puzzle["requiredClues"]) <= clues.keys(), f"Pista inexistente en {puzzle['id']}.")
    return len(story["puzzles"]), len(clues)


def verify_audio():
    manifest = read_json(read_asset("audio/manifest.json"))["assets"]
    for item in manifest:
        audio = read_asset("audio/" + item["file"])
        source = audio if item.get("loop") else ROOT / "art-source" / "audio-masters" / item["source"]
        with wave.open(str(source), "rb") as clip:
            demand(clip.getnchannels() == 1 and clip.getframerate() == 44100, f"WAV incompatible: {source.name}.")
            demand(clip.getnframes() >= 4000, f"WAV demasiado corto: {source.name}.")
    return len(manifest)


def inventory():
    entries = []
    for path in sorted(ASSETS.rglob("*")):
        if path.is_file() and path != INVENTORY:
            data = path.read_bytes()
            entries.append({
                "path": path.relative_to(ASSETS).as_posix(),
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            })
    return {"version": 1, "files": entries}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write-inventory", action="store_true", help="Actualizar tamaños y hashes.")
    args = parser.parse_args()
    model_count, instance_count = verify_scene()
    puzzle_count, clue_count = verify_story()
    audio_count = verify_audio()
    for name in ("cover.webp", "social-1200x630.jpg", "scene-preview.png"):
        read_asset("art/" + name)
    for name in ("wordmark-light.png", "wordmark-dark.png", "favicon.ico", "theme.css"):
        read_asset("branding/" + name)
    computed = inventory()
    if args.write_inventory:
        INVENTORY.write_text(json.dumps(computed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    else:
        demand(INVENTORY.is_file() and read_json(INVENTORY) == computed, "El inventario no coincide con los assets.")
    print(f"Kit válido: {model_count} GLB, {instance_count} instancias, {puzzle_count} puzles, "
          f"{clue_count} pistas, {audio_count} audios, {len(computed['files'])} archivos públicos.")


if __name__ == "__main__":
    main()
