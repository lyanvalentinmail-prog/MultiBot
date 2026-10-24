#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  🤖 MultiBot — acceso directo desde la carpeta del bot
# ───────────────────────────────────────────────────────────────────
#  Estás dentro de bots/<algo>/ y la terminal real (termux.sh) vive en
#  la raíz del repo. Este script la busca hacia arriba y la ejecuta con
#  los mismos argumentos, así `bash termux.sh` funciona estés donde estés:
#
#    cd ~/MultiBot/bots/universal-bot
#    bash termux.sh                  → abre el menú de la terminal real
#    bash termux.sh --code 59899123456
#
#  Si no la encuentra, tu clon está desactualizado: te dice cómo arreglarlo.
# ═══════════════════════════════════════════════════════════════════
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

find_terminal() {
  local dir="$HERE" candidate
  while true; do
    candidate="$dir/termux.sh"
    # Ojo: este propio archivo también se llama termux.sh, hay que saltarlo.
    if [ -f "$candidate" ] && [ "$candidate" != "$HERE/termux.sh" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
    [ "$dir" = "/" ] && return 1
    dir="$(dirname "$dir")"
  done
}

if TERMINAL="$(find_terminal)"; then
  exec bash "$TERMINAL" "$@"
fi

# ── No encontrada: diagnóstico y solución ──────────────────────────
echo "✖ No encontré la terminal MultiBot (termux.sh de la raíz del repo)." >&2
echo "" >&2
echo "  Estás en: $(pwd)" >&2
if TOP="$(git -C "$HERE" rev-parse --show-toplevel 2>/dev/null)" && [ -d "$TOP/bots" ]; then
  echo "  Tu repo: $TOP" >&2
  echo "" >&2
  echo "  Tu clon está desactualizado (la terminal se agregó después)." >&2
  echo "  Arréglalo así:" >&2
  echo "    cd \"$TOP\" && git pull && bash termux.sh" >&2
else
  echo "  Esta carpeta no es un clon git de MultiBot." >&2
fi
echo "" >&2
echo "  O reinstala con un solo comando (no borra tu sesión):" >&2
echo "    bash <(curl -fsSL https://raw.githubusercontent.com/lyanvalentinmail-prog/MultiBot/main/scripts/termux-go.sh)" >&2
exit 1
