#!/bin/bash
# install-termux.sh — Instalador automatizado para Termux

set -e

echo "╔══════════════════════════════════════════╗"
echo "║  MultiBot — Instalador Termux          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check Termux
if [ ! -d "/data/data/com.termux" ]; then
  echo "⚠️  No parece Termux (no se encontró /data/data/com.termux)"
  echo "   Continuando de todos modos... (usa ALLOW_NON_TERMUX=1 si es PC)"
  sleep 2
fi

echo "→ Actualizando paquetes..."
pkg update -y && pkg upgrade -y

echo "→ Instalando dependencias..."
pkg install -y git nodejs ffmpeg imagemagick python pkg-config make clang

echo "→ Node: $(node -v) | NPM: $(npm -v)"

# Clonar si no existe
if [ ! -d "bots/universal-bot" ]; then
  if [ ! -d "MultiBot" ]; then
    echo "→ Clonando repo..."
    # Si ya estás dentro del repo, no clones
    if [ -f "package.json" ] && [ -d "bots" ]; then
      echo "  Ya dentro de MultiBot, omitiendo clone"
    else
      git clone https://github.com/lyanvalentinmail-prog/MultiBot.git
      cd MultiBot
    fi
  fi
fi

BOT_DIR="bots/universal-bot"
if [ ! -d "$BOT_DIR" ]; then
  BOT_DIR="."
fi

echo "→ Instalando npm deps en $BOT_DIR..."
cd "$BOT_DIR"
npm install

echo "→ Configurando..."
if [ ! -f "config.js" ] && [ -f "config.example.js" ]; then
  cp config.example.js config.js
  echo "  Copiado config.example.js → config.js (edita con nano config.js)"
fi

echo ""
echo "✅ Instalación completa"
echo ""
echo "Próximo:"
echo "  nano config.js   # pon tu owner"
echo "  npm start        # elige 'code' o 'qr'"
echo ""
