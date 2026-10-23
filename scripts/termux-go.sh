#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  🤖 MultiBot GO — bootstrap de un solo comando para Termux
# ───────────────────────────────────────────────────────────────────
#  Pega esto en Termux y listo: clona o actualiza el repo y abre la
#  terminal. Funciona aunque estés en la carpeta equivocada, tu clon
#  esté viejo o hayas descargado el ZIP:
#
#    bash <(curl -fsSL https://raw.githubusercontent.com/lyanvalentinmail-prog/MultiBot/main/scripts/termux-go.sh)
#
#  Acepta los mismos argumentos que termux.sh (ej. --qr, --code <n>).
#  Nunca borra tu carpeta: si existe pero no es un clon git, la respalda
#  con fecha (tu sesión queda a salvo).
#
#  Variables opcionales (avanzado):
#    MULTIBOT_DIR=~/MiBot  MULTIBOT_REPO_URL=<otro repo>
# ═══════════════════════════════════════════════════════════════════
set -u

REPO_URL="${MULTIBOT_REPO_URL:-https://github.com/lyanvalentinmail-prog/MultiBot.git}"
DEST="${MULTIBOT_DIR:-${HOME:-/tmp}/MultiBot}"

say() { printf '%s\n' "$*"; }

if ! command -v git >/dev/null 2>&1; then
  say "✖ Falta git. En Termux ejecuta primero:  pkg install git -y" >&2
  exit 1
fi

if [ -d "$DEST/.git" ]; then
  say "→ Actualizando $DEST ..."
  if ! git -C "$DEST" pull --ff-only; then
    say "⚠ git pull falló (¿cambios locales o rama sin remoto?). Sigo con lo que hay..." >&2
    say "  Para forzar la actualización:  cd \"$DEST\" && git stash && git pull" >&2
  fi
else
  if [ -e "$DEST" ]; then
    BACKUP="$DEST.respaldo-$(date +%Y%m%d-%H%M%S)"
    say "→ $DEST existe pero no es un clon git; lo muevo a $BACKUP (no borro nada)"
    mv "$DEST" "$BACKUP" || { say "✖ No pude respaldar $DEST" >&2; exit 1; }
  fi
  say "→ Clonando MultiBot en $DEST ..."
  git clone --depth 1 "$REPO_URL" "$DEST" || { say "✖ Falló el clon. Revisa tu conexión e inténtalo de nuevo." >&2; exit 1; }
fi

if [ -f "$DEST/termux.sh" ]; then
  cd "$DEST" || exit 1
  exec bash "$DEST/termux.sh" "$@"
fi

say "✖ No apareció termux.sh en $DEST. Prueba borrar la carpeta y correr este comando de nuevo." >&2
exit 1
