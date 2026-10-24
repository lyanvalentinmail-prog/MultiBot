#!/bin/bash
# create-bot.sh — Crea un nuevo bot desde _template o universal-bot

set -e

if [ -z "$1" ]; then
  echo "Uso: bash scripts/create-bot.sh <nombre-del-bot>"
  echo "Ejemplo: bash scripts/create-bot.sh ventas-bot"
  exit 1
fi

BOT_NAME="$1"
BOT_DIR="bots/$BOT_NAME"
TEMPLATE_DIR="bots/_template"
FALLBACK_DIR="bots/universal-bot"

# Validar nombre
if [[ ! "$BOT_NAME" =~ ^[a-z0-9_-]+$ ]]; then
  echo "✖ Nombre inválido. Usa solo a-z, 0-9, - y _ (ej: mi-bot, ventas_bot)"
  exit 1
fi

if [ -d "$BOT_DIR" ]; then
  echo "✖ Ya existe $BOT_DIR"
  exit 1
fi

# Elegir fuente
if [ -d "$TEMPLATE_DIR" ] && [ "$(ls -A $TEMPLATE_DIR 2>/dev/null)" ]; then
  SRC="$TEMPLATE_DIR"
  echo "📦 Usando template: $SRC"
else
  SRC="$FALLBACK_DIR"
  echo "📦 Template vacío, usando fallback: $SRC"
fi

if [ ! -d "$SRC" ]; then
  echo "✖ No se encontró $SRC ni $TEMPLATE_DIR"
  exit 1
fi

echo "→ Copiando $SRC → $BOT_DIR"
mkdir -p "$BOT_DIR"

# Copia excluyendo sessions, tmp, node_modules, databases
if command -v rsync &> /dev/null; then
  rsync -av --exclude='node_modules' --exclude='sessions' --exclude='tmp' --exclude='storage/databases/database.json' --exclude='.git' "$SRC/" "$BOT_DIR/"
else
  cp -r "$SRC"/* "$BOT_DIR/" 2>/dev/null || true
  cp -r "$SRC"/.gitignore "$BOT_DIR/" 2>/dev/null || true
  rm -rf "$BOT_DIR/node_modules" "$BOT_DIR/sessions" "$BOT_DIR/tmp" "$BOT_DIR/storage/databases/database.json" 2>/dev/null || true
fi

# Limpia sessions/tmp
mkdir -p "$BOT_DIR/sessions" "$BOT_DIR/tmp" "$BOT_DIR/storage/databases"
touch "$BOT_DIR/sessions/.gitkeep" "$BOT_DIR/tmp/.gitkeep"

# Actualiza package.json name si existe
if [ -f "$BOT_DIR/package.json" ]; then
  echo "→ Actualizando package.json name → $BOT_NAME"
  # usa python o jq o sed
  if command -v python3 &> /dev/null; then
    python3 << PY
import json, pathlib
p = pathlib.Path("$BOT_DIR/package.json")
j = json.loads(p.read_text())
j["name"] = "$BOT_NAME"
j["description"] = f"Bot {\"$BOT_NAME\"} — parte de MultiBot"
if "repository" in j and isinstance(j["repository"], dict):
    j["repository"]["directory"] = "bots/$BOT_NAME"
p.write_text(json.dumps(j, indent=2, ensure_ascii=False))
print("  package.json actualizado")
PY
  else
    sed -i "s/\"name\": \".*\"/\"name\": \"$BOT_NAME\"/" "$BOT_DIR/package.json" || true
  fi
fi

# El manifiesto de comandos pasa a ser del bot nuevo.
if [ -f "$BOT_DIR/commands.json" ]; then
  echo "→ Actualizando commands.json → $BOT_NAME"
  if command -v python3 &> /dev/null; then
    python3 << PY
import json, pathlib
p = pathlib.Path("$BOT_DIR/commands.json")
j = json.loads(p.read_text())
j["bot"] = "$BOT_NAME"
j["description"] = f"Comandos que usa {\"$BOT_NAME\"} (viven en commands/)."
p.write_text(json.dumps(j, indent=2, ensure_ascii=False))
print("  commands.json actualizado")
PY
  fi
fi

# Mensaje final
echo ""
echo "✅ Bot creado en $BOT_DIR"
echo ""
echo "Próximos pasos:"
echo "  cd $BOT_DIR"
echo "  cp config.example.js config.js"
echo "  nano config.js   # pon tu owner"
echo "  npm install"
echo "  (cd ../.. && npm install --omit=dev)   # deps compartidas de MultiBot/lib y commands"
echo "  npm start        # elige qr o code"
echo ""
echo "Docs: docs/guides/ADD_NEW_BOT.md"
