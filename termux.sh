#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  🤖 MultiBot Terminal — terminal personalizada para Termux
# ───────────────────────────────────────────────────────────────────
#  Menú interactivo para:
#    • Elegir qué bot iniciar (detecta todos los de bots/)
#    • Vincular WhatsApp por QR o Pairing Code (sin re-preguntar)
#    • Configurar owner, instalar dependencias, diagnóstico
#    • Personalizar el prompt de Termux (colores, alias, banner)
#
#  Uso:
#    bash termux.sh                  → abre el menú interactivo
#    bash termux.sh --qr              → inicia el bot con QR
#    bash termux.sh --code 59899123456→ inicia el bot con pairing code
#    bash termux.sh --bot universal-bot --qr
#    bash termux.sh --list-bots       → lista los bots detectados
#    bash termux.sh --install         → instala dependencias del bot
#    bash termux.sh --personalize     → personaliza el prompt de Termux
#    bash termux.sh --help
# ═══════════════════════════════════════════════════════════════════
set -u

# ── Rutas ──────────────────────────────────────────────────────────
SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
ROOT="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
BOTS_DIR="$ROOT/bots"
CONF_FILE="${HOME:-$ROOT}/.multibot-terminal.conf"
BANNER_FILE="${HOME:-$ROOT}/.multibot-banner.sh"

# ── Colores (seguros aunque TERM no soporte tput) ──────────────────
if command -v tput >/dev/null 2>&1 && tput setaf 1 >/dev/null 2>&1; then
  C_RESET="$(tput sgr0)"
  C_BOLD="$(tput bold)"
  C_RED="$(tput setaf 1)"
  C_GREEN="$(tput setaf 2)"
  C_YELLOW="$(tput setaf 3)"
  C_BLUE="$(tput setaf 4)"
  C_MAGENTA="$(tput setaf 5)"
  C_CYAN="$(tput setaf 6)"
  C_WHITE="$(tput setaf 7)"
  C_GRAY="$(tput setaf 8 2>/dev/null || printf '\033[90m')"
else
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'; C_MAGENTA=$'\033[35m'; C_CYAN=$'\033[36m'
  C_WHITE=$'\033[37m'; C_GRAY=$'\033[90m'
fi

ok()    { printf '%b✔%b %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn()  { printf '%b!%b %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
err()   { printf '%b✖%b %s\n' "$C_RED" "$C_RESET" "$*" >&2; }
info()  { printf '%b→%b %s\n' "$C_CYAN" "$C_RESET" "$*"; }
title() { printf '\n%b%b%s%b\n' "$C_BOLD" "$C_CYAN" "$*" "$C_RESET"; }

# Lectura robusta: usa /dev/tty si existe (menú dentro de pipes),
# si no stdin. Devuelve 1 en EOF para no ciclarse sin terminal.
read_input() {
  local __var="$1" __line=""
  if [ -c /dev/tty ]; then
    if IFS= read -r __line < /dev/tty 2>/dev/null; then
      printf -v "$__var" '%s' "$__line"; return 0
    fi
    # /dev/tty existe pero no se puede abrir (sandbox/CI) → usa stdin
  fi
  IFS= read -r __line || return 1
  printf -v "$__var" '%s' "$__line"
}
pause() { printf '%bPulsa Enter para continuar...%b' "$C_GRAY" "$C_RESET"; read_input _ || true; }

# ── Detección de entorno ───────────────────────────────────────────
is_termux() {
  [ -n "${TERMUX_VERSION:-}" ] || [ -n "${TERMUX_APP__PID:-}" ] \
    || [[ "${PREFIX:-}" == *"com.termux"* ]] \
    || [[ "${HOME:-}" == *"com.termux"* ]] \
    || [ -d /data/data/com.termux ]
}

# ── Config persistente ─────────────────────────────────────────────
DEFAULT_BOT="universal-bot"
LAST_PHONE=""
load_conf() {
  [ -f "$CONF_FILE" ] || return 0
  while IFS='=' read -r key value; do
    case "$key" in
      DEFAULT_BOT) DEFAULT_BOT="$value" ;;
      LAST_PHONE) LAST_PHONE="$value" ;;
    esac
  done < "$CONF_FILE"
}
save_conf() {
  mkdir -p "$(dirname "$CONF_FILE")" 2>/dev/null || true
  {
    echo "DEFAULT_BOT=$DEFAULT_BOT"
    echo "LAST_PHONE=$LAST_PHONE"
  } > "$CONF_FILE" 2>/dev/null || warn "No se pudo guardar $CONF_FILE"
}

# ── Detección de bots ──────────────────────────────────────────────
# Lista directorios de bots válidos (con package.json + index.js o main.js)
BOT_IDS=()
bot_name() { # $1 = id → nombre bonito (bot.json > package.json > id)
  local id="$1" dir="$BOTS_DIR/$id" name=""
  if [ -f "$dir/bot.json" ]; then
    name="$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$dir/bot.json" 2>/dev/null | head -n1 | sed 's/.*"[[:space:]]*:[[:space:]]*"//; s/"$//')"
  fi
  if [ -z "$name" ] && [ -f "$dir/package.json" ]; then
    name="$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$dir/package.json" 2>/dev/null | head -n1 | sed 's/.*"[[:space:]]*:[[:space:]]*"//; s/"$//')"
  fi
  [ -n "$name" ] && echo "$name" || echo "$id"
}
bot_entry() { # $1 = id → entrypoint (webEntrypoint > main.js > index.js)
  local id="$1" dir="$BOTS_DIR/$id"
  if [ -f "$dir/main.js" ]; then echo "main.js"
  elif [ -f "$dir/index.js" ]; then echo "index.js"
  else echo ""
  fi
}
detect_bots() {
  BOT_IDS=()
  [ -d "$BOTS_DIR" ] || return 0
  for dir in "$BOTS_DIR"/*/; do
    [ -d "$dir" ] || continue
    local id; id="$(basename "$dir")"
    [ -f "$dir/package.json" ] || continue
    if [ -z "$(bot_entry "$id")" ] && ! grep -q '"start"[[:space:]]*:' "$dir/package.json" 2>/dev/null; then
      continue
    fi
    BOT_IDS+=("$id")
  done
}
bot_has_script() { # $1=id $2=script → 0 si existe en package.json
  grep -q "\"$2\"[[:space:]]*:" "$BOTS_DIR/$1/package.json" 2>/dev/null
}
bot_status() { # $1 = id → "listo|falta-deps|sin-config"
  local dir="$BOTS_DIR/$1"
  if [ ! -d "$dir/node_modules" ]; then echo "falta-deps"; return; fi
  # Solo se exige config.js si el bot trae asistente "setup".
  if bot_has_script "$1" "setup" && [ ! -f "$dir/config.js" ]; then echo "sin-config"; return; fi
  echo "listo"
}
status_icon() {
  case "$(bot_status "$1")" in
    listo)      printf '%b● listo%b' "$C_GREEN" "$C_RESET" ;;
    sin-config) printf '%b● sin config%b' "$C_YELLOW" "$C_RESET" ;;
    *)          printf '%b● sin instalar%b' "$C_RED" "$C_RESET" ;;
  esac
}

# ── Banner ─────────────────────────────────────────────────────────
banner() {
  clear 2>/dev/null || true
  printf '%b' "$C_CYAN"
  cat <<'ART'
  █▀▄▀█ █ █   ▀█▀ ▀█▀ █▄▄ █▀▀ ▀█▀
  █ ▀ █ █ █▄▄  █   █  █▄█ █▄█  █
ART
  printf '%b' "$C_RESET"
  printf '  %b%bTerminal personalizada · Termux%b\n' "$C_BOLD" "$C_MAGENTA" "$C_RESET"
  printf '  %b%s%b\n' "$C_GRAY" "$(is_termux && echo "📱 Corriendo en Termux" || echo "💻 No-Termux (modo desarrollo)")" "$C_RESET"
  detect_bots
  if [ "${#BOT_IDS[@]}" -eq 0 ]; then
    printf '  %b⚠ No se detectaron bots en bots/%b\n' "$C_YELLOW" "$C_RESET"
  else
    printf '  %bBots:%b ' "$C_GRAY" "$C_RESET"
    local first=1 id
    for id in "${BOT_IDS[@]}"; do
      [ "$first" -eq 1 ] || printf '%b·%b ' "$C_GRAY" "$C_RESET"
      first=0
      if [ "$id" = "$DEFAULT_BOT" ]; then
        printf '%b%s ★%b ' "$C_GREEN" "$id" "$C_RESET"
      else
        printf '%s ' "$id"
      fi
    done
    printf '\n'
  fi
  printf '  %b%s%b\n\n' "$C_GRAY" "──────────────────────────────────" "$C_RESET"
}

# ── Selector de bot ────────────────────────────────────────────────
pick_bot() { # $1 = "choose" (pregunta) o vacío (usa default) → echo id
  detect_bots
  if [ "${#BOT_IDS[@]}" -eq 0 ]; then
    err "No hay bots en $BOTS_DIR"
    return 1
  fi
  if [ "${1:-}" != "choose" ]; then
    for id in "${BOT_IDS[@]}"; do
      if [ "$id" = "$DEFAULT_BOT" ]; then echo "$id"; return 0; fi
    done
    echo "${BOT_IDS[0]}"; return 0
  fi
  title "Elige un bot" >&2
  local i=1 id
  for id in "${BOT_IDS[@]}"; do
    local mark=" "; [ "$id" = "$DEFAULT_BOT" ] && mark="★"
    printf '  %b%s)%b %b%s%b  %s  %s\n' "$C_YELLOW" "$i" "$C_RESET" "$C_BOLD" "$id" "$C_RESET" "$(status_icon "$id")" "$mark" >&2
    printf '     %b%s%b\n' "$C_GRAY" "$(bot_name "$id")" "$C_RESET" >&2
    i=$((i+1))
  done
  printf '  %b0)%b Cancelar\n' "$C_YELLOW" "$C_RESET" >&2
  printf '\nNúmero: ' >&2
  local choice; read_input choice || return 1
  if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 0 ] || [ "$choice" -gt "${#BOT_IDS[@]}" ]; then
    err "Opción no válida."; return 1
  fi
  [ "$choice" -eq 0 ] && return 1
  echo "${BOT_IDS[$((choice-1))]}"
}

ask_phone() { # → echo número normalizado o vacío si inválido
  local preset="${LAST_PHONE:-}"
  if [ -n "$preset" ]; then
    printf 'Número de WhatsApp con código de país [%b%s%b]: ' "$C_GREEN" "$preset" "$C_RESET" >&2
  else
    printf 'Número de WhatsApp con código de país (ej. 59899123456): ' >&2
  fi
  local raw; read_input raw || return 1
  raw="${raw:-$preset}"
  local phone; phone="$(printf '%s' "$raw" | tr -cd '0-9' | sed 's/^0*//')"
  if [[ "$phone" == 52* ]] && [[ "$phone" != 521* ]] && [ "${#phone}" -eq 12 ]; then
    phone="521${phone:2}" # México: WhatsApp usa 521
  fi
  if [ "${#phone}" -lt 8 ] || [ "${#phone}" -gt 15 ]; then
    err "Número no válido (8-15 dígitos con código de país)."
    echo ""; return 1
  fi
  LAST_PHONE="$phone"; save_conf
  echo "$phone"
}

# ── Acciones ───────────────────────────────────────────────────────
cmd_install() { # $1 = bot id
  local id="$1" dir="$BOTS_DIR/$1"
  title "📦 Instalando dependencias — $id"
  if ! command -v npm >/dev/null 2>&1; then
    err "npm no encontrado."
    if is_termux; then info "Ejecuta: pkg install nodejs-lts -y"; else info "Instala Node.js ≥ 20 primero."; fi
    return 1
  fi
  (cd "$dir" && npm install) || { err "npm install falló."; return 1; }
  ok "Dependencias listas."
}

cmd_doctor() { # $1 = bot id
  local id="$1" dir="$BOTS_DIR/$1"
  title "🩺 Diagnóstico — $id"
  info "Node: $(node -v 2>/dev/null || echo 'no instalado') · npm: $(npm -v 2>/dev/null || echo 'no instalado')"
  if bot_has_script "$id" "doctor"; then
    (cd "$dir" && npm run doctor) || true
  else
    [ -d "$dir/node_modules" ] && ok "node_modules presente" || err "Falta npm install"
    [ -f "$dir/config.js" ] && ok "config.js presente" || warn "Falta config.js (usa Configurar bot)"
    [ -d "$dir/sessions" ] && ok "Carpeta sessions presente" || info "Sin sesión todavía (normal si es la primera vez)"
  fi
}

cmd_setup() { # $1 = bot id
  local id="$1" dir="$BOTS_DIR/$1"
  title "⚙ Configurar — $id ($(bot_name "$id"))"
  if ! bot_has_script "$id" "setup"; then
    warn "Este bot no tiene asistente 'setup'."
    if [ ! -f "$dir/config.js" ] && [ -f "$dir/config.example.js" ]; then
      cp "$dir/config.example.js" "$dir/config.js"
      ok "Creado config.js desde config.example.js — edítalo a mano."
    fi
    return 0
  fi
  printf 'Tu nombre (owner): '
  local name; read_input name || return 1
  name="${name:-MultiBot Owner}"
  local phone; phone="$(ask_phone)" || return 1
  printf 'Tu LID (opcional, Enter para omitir): '
  local lid; read_input lid || return 1
  lid="$(printf '%s' "$lid" | tr -cd '0-9')"
  if [ -n "$lid" ]; then
    (cd "$dir" && npm run setup -- --owner "$phone" --name "$name" --lid "$lid" --yes)
  else
    (cd "$dir" && npm run setup -- --owner "$phone" --name "$name" --yes)
  fi
  ok "Configuración guardada."
}

cmd_start() { # $1 = bot id, $2 = método (qr|code|ask|sesión), $3 = teléfono
  local id="$1" method="${2:-ask}" phone="${3:-}" dir="$BOTS_DIR/$1"
  if [ ! -d "$dir/node_modules" ]; then
    warn "Faltan dependencias, instalando primero..."
    cmd_install "$id" || return 1
  fi
  if [ ! -f "$dir/config.js" ] && bot_has_script "$id" "setup"; then
    warn "No hay config.js — vamos a configurarlo rápido."
    cmd_setup "$id" || return 1
  fi
  # Sesión ya vinculada → arranca directo, sin pedir método.
  if grep -rl '"registered"[[:space:]]*:[[:space:]]*true' "$dir/sessions" 2>/dev/null | grep -q .; then
    method="sesión"
  fi
  case "$method" in
    qr|code) export MULTIBOT_LOGIN_METHOD="$method" ;;
    *) unset MULTIBOT_LOGIN_METHOD 2>/dev/null || true ;;
  esac
  if [ "$method" = "code" ] && [ -n "$phone" ]; then
    export MULTIBOT_LOGIN_PHONE="$phone"
  else
    unset MULTIBOT_LOGIN_PHONE 2>/dev/null || true
  fi
  if ! is_termux; then export ALLOW_NON_TERMUX=1; fi
  title "🚀 Iniciando $(bot_name "$id")"
  case "$method" in
    qr)     info "Método: QR — escanéalo con WhatsApp → Dispositivos vinculados." ;;
    code)   info "Método: Pairing Code para $phone — WhatsApp → Vincular con número." ;;
    sesión) ok "Sesión ya vinculada — conectando directo." ;;
    *)      info "El bot te preguntará: escribe qr o code." ;;
  esac
  info "Para detener: Ctrl+C · Para salir de sesión: opción 'Borrar sesión'."
  echo ""
  if bot_has_script "$id" "start"; then
    (cd "$dir" && npm start)
  else
    (cd "$dir" && node "$(bot_entry "$id")")
  fi
  local code=$?
  unset MULTIBOT_LOGIN_METHOD MULTIBOT_LOGIN_PHONE 2>/dev/null || true
  echo ""
  [ "$code" -eq 0 ] && ok "Bot detenido." || warn "El bot terminó con código $code."
  return "$code"
}

cmd_pairing() { # $1 = bot id (opcional)
  local id="${1:-}"; [ -z "$id" ] && { id="$(pick_bot choose)" || return 0; }
  title "🔑 Pairing Code — $id"
  info "Vincula escribiendo el código en WhatsApp → ⋮ → Dispositivos vinculados → Vincular con número."
  local phone; phone="$(ask_phone)" || return 0
  cmd_start "$id" "code" "$phone"
}

cmd_qr() { # $1 = bot id (opcional)
  local id="${1:-}"; [ -z "$id" ] && { id="$(pick_bot choose)" || return 0; }
  title "📷 Código QR — $id"
  info "Escanea el QR con WhatsApp → ⋮ → Dispositivos vinculados → Vincular dispositivo."
  cmd_start "$id" "qr"
}

cmd_logout() { # $1 = bot id
  local id="$1" dir="$BOTS_DIR/$1"
  title "🚪 Borrar sesión — $id"
  if [ ! -d "$dir/sessions" ]; then info "No hay sesión guardada."; return 0; fi
  printf 'Esto desvincula WhatsApp. ¿Seguro? [s/N]: '
  local ans; read_input ans || return 1
  case "$ans" in
    s|S|y|Y|sí|si) rm -rf "$dir/sessions"; ok "Sesión borrada. Inicia de nuevo con QR o Pairing Code." ;;
    *) info "Cancelado." ;;
  esac
}

cmd_update() {
  title "⬆ Actualizar MultiBot"
  if [ ! -d "$ROOT/.git" ]; then err "No es un clon git ($ROOT)."; return 1; fi
  (cd "$ROOT" && git pull --ff-only) && ok "Repo actualizado." || err "git pull falló (¿cambios locales?)."
}

cmd_info() { # $1 = bot id
  local id="$1" dir="$BOTS_DIR/$1"
  title "ℹ $(bot_name "$id") [$id]"
  printf '  Carpeta: %s\n' "$dir"
  printf '  Estado:  %s\n' "$(status_icon "$id")"
  local entry; entry="$(bot_entry "$id")"
  [ -z "$entry" ] && entry="(npm start)"
  printf '  Entrada: %s\n' "$entry"
  [ -f "$dir/bot.json" ] && grep -o '"description"[[:space:]]*:[[:space:]]*"[^"]*"' "$dir/bot.json" 2>/dev/null | head -n1 | sed 's/.*"[[:space:]]*:[[:space:]]*"//; s/"$/"/; s/^/  Info: /'
  [ -d "$dir/sessions" ] && ok "Tiene sesión guardada" || info "Sin sesión (primera vez)"
}

# ── Personalización de la terminal Termux ──────────────────────────
cmd_personalize() {
  title "🎨 Personalizar terminal Termux"
  local bashrc="${HOME:-$ROOT}/.bashrc"
  # 1) Banner que se muestra al abrir Termux
  cat > "$BANNER_FILE" <<EOF
# MultiBot banner — generado por termux.sh (no editar a mano)
if [ -z "\${MULTIBOT_BANNER_SHOWN:-}" ]; then
  export MULTIBOT_BANNER_SHOWN=1
  printf '\033[36m  █▀▄▀█ █ █   ▀█▀ ▀█▀ █▄▄ █▀▀ ▀█▀\033[0m\n'
  printf '\033[35m  MultiBot Terminal · escribe "multibot" para abrir el menú\033[0m\n'
fi
EOF
  # 2) Bloque en .bashrc (idempotente)
  local marker="# >>> MultiBot Terminal >>>"
  if [ -f "$bashrc" ] && grep -qF "$marker" "$bashrc"; then
    info ".bashrc ya tiene el bloque MultiBot — actualizando banner."
  else
    cat >> "$bashrc" <<EOF

$marker
# Prompt personalizado MultiBot + alias + banner (generado por termux.sh)
if [ -f "$BANNER_FILE" ]; then . "$BANNER_FILE"; fi
PS1='\[\033[1;36m\]🤖 multibot\[\033[0m\] \[\033[1;32m\]\w\[\033[0m\] \[\033[1;35m\]❯\[\033[0m\] '
alias multibot='bash "$ROOT/termux.sh"'
alias mb='bash "$ROOT/termux.sh"'
alias mb-qr='bash "$ROOT/termux.sh" --qr'
alias mb-code='bash "$ROOT/termux.sh" --code'
# <<< MultiBot Terminal <<<
EOF
    ok "Bloque añadido a $bashrc"
  fi
  # Aplica en esta sesión también
  # shellcheck disable=SC1090
  [ -f "$BANNER_FILE" ] && . "$BANNER_FILE"
  PS1='\[\033[1;36m\]🤖 multibot\[\033[0m\] \[\033[1;32m\]\w\[\033[0m\] \[\033[1;35m\]❯\[\033[0m\] '
  alias multibot="bash \"$ROOT/termux.sh\"" 2>/dev/null || true
  alias mb="bash \"$ROOT/termux.sh\"" 2>/dev/null || true
  echo ""
  ok "Terminal personalizada:"
  info "Nuevo prompt: 🤖 multibot ruta ❯ (colores cian/verde/magenta)"
  info "Alias: multibot · mb · mb-qr · mb-code"
  info "Banner de bienvenida al abrir Termux"
  info "Cierra y reabre Termux (o ejecuta: source $bashrc) para verlo."
}

# ── Menú principal ─────────────────────────────────────────────────
show_menu() {
  banner
  printf '%b  1)%b 🚀 Iniciar bot %b[%s]%b\n' "$C_YELLOW" "$C_RESET" "$C_GRAY" "$DEFAULT_BOT" "$C_RESET"
  printf '%b  2)%b 🤖 Elegir bot (actual: %b%s%b)\n' "$C_YELLOW" "$C_RESET" "$C_GREEN" "$DEFAULT_BOT" "$C_RESET"
  printf '%b  3)%b 🔑 Pedir Pairing Code\n' "$C_YELLOW" "$C_RESET"
  printf '%b  4)%b 📷 Mostrar QR\n' "$C_YELLOW" "$C_RESET"
  printf '%b  5)%b ⚙  Configurar bot (número, nombre)\n' "$C_YELLOW" "$C_RESET"
  printf '%b  6)%b 📦 Instalar / reinstalar dependencias\n' "$C_YELLOW" "$C_RESET"
  printf '%b  7)%b 🩺 Diagnóstico (doctor)\n' "$C_YELLOW" "$C_RESET"
  printf '%b  8)%b ℹ  Ver info del bot\n' "$C_YELLOW" "$C_RESET"
  printf '%b  9)%b 🚪 Borrar sesión (desvincular WhatsApp)\n' "$C_YELLOW" "$C_RESET"
  printf '%b 10)%b ⬆  Actualizar desde GitHub\n' "$C_YELLOW" "$C_RESET"
  printf '%b 11)%b 🎨 Personalizar terminal Termux\n' "$C_YELLOW" "$C_RESET"
  printf '%b  0)%b 👋 Salir\n' "$C_YELLOW" "$C_RESET"
  printf '\nElige una opción: '
}

menu_loop() {
  while true; do
    show_menu
    local opt; read_input opt || { echo ""; exit 0; }
    case "$opt" in
      1) id="$(pick_bot)" && cmd_start "$id" "ask"; pause ;;
      2)
        id="$(pick_bot choose)" || { pause; continue; }
        DEFAULT_BOT="$id"; save_conf; ok "Bot por defecto: $id"; pause ;;
      3) cmd_pairing ""; pause ;;
      4) cmd_qr ""; pause ;;
      5) id="$(pick_bot choose)" && cmd_setup "$id"; pause ;;
      6) id="$(pick_bot choose)" && cmd_install "$id"; pause ;;
      7) id="$(pick_bot choose)" && cmd_doctor "$id"; pause ;;
      8) id="$(pick_bot choose)" && cmd_info "$id"; pause ;;
      9) id="$(pick_bot choose)" && cmd_logout "$id"; pause ;;
      10) cmd_update; pause ;;
      11) cmd_personalize; pause ;;
      0|q|Q|salir|exit)
        printf '\n%b👋 ¡Nos vemos! MultiBot Terminal%b\n' "$C_MAGENTA" "$C_RESET"
        exit 0 ;;
      *) err "Opción no válida."; sleep 1 ;;
    esac
  done
}

usage() {
  cat <<EOF
${C_BOLD}🤖 MultiBot Terminal${C_RESET} — terminal personalizada para Termux

Uso:
  bash termux.sh                        Abre el menú interactivo
  bash termux.sh --bot <id> --qr        Inicia ese bot mostrando el QR
  bash termux.sh --bot <id> --code <n>  Inicia ese bot con pairing code
  bash termux.sh --qr                   QR con el bot por defecto ($DEFAULT_BOT)
  bash termux.sh --code [número]        Pairing code (usa el último número si se omite)
  bash termux.sh --start [qr|code|ask]  Inicia el bot por defecto
  bash termux.sh --list-bots            Lista los bots detectados
  bash termux.sh --install [--bot <id>] Instala dependencias
  bash termux.sh --doctor [--bot <id>]  Diagnóstico
  bash termux.sh --setup [--bot <id>]   Configura owner/nombre
  bash termux.sh --logout [--bot <id>]  Borra la sesión (desvincula)
  bash termux.sh --update               git pull del repo
  bash termux.sh --personalize          Personaliza el prompt de Termux
  bash termux.sh --help                 Esta ayuda

Ejemplos:
  bash termux.sh --code 59899123456
  bash termux.sh --bot universal-bot --qr
EOF
}

list_bots() {
  detect_bots
  if [ "${#BOT_IDS[@]}" -eq 0 ]; then err "No hay bots en $BOTS_DIR"; return 1; fi
  printf '%bBots detectados:%b\n' "$C_BOLD" "$C_RESET"
  for id in "${BOT_IDS[@]}"; do
    local mark=" "; [ "$id" = "$DEFAULT_BOT" ] && mark="★"
    printf '  %s %b%s%b — %s [%s]\n' "$mark" "$C_GREEN" "$id" "$C_RESET" "$(bot_name "$id")" "$(status_icon "$id")"
  done
}

resolve_bot() { # $1 = id o vacío → valida y echo
  detect_bots
  local id="${1:-$DEFAULT_BOT}"
  for b in "${BOT_IDS[@]}"; do [ "$b" = "$id" ] && { echo "$id"; return 0; }; done
  err "Bot '$id' no existe. Disponibles: ${BOT_IDS[*]:-ninguno}"
  return 1
}

# ── Arranque ───────────────────────────────────────────────────────
main() {
  load_conf
  if [ $# -eq 0 ]; then menu_loop; return; fi

  local bot="" action="" phone="" method="ask"
  while [ $# -gt 0 ]; do
    case "$1" in
      --bot) bot="${2:-}"; shift 2 ;;
      --qr) action="start"; method="qr"; shift ;;
      --code)
        action="start"; method="code"; shift
        if [ $# -gt 0 ] && [[ "$1" != --* ]]; then phone="$1"; shift; fi ;;
      --start)
        action="start"; shift
        if [ $# -gt 0 ] && [[ "$1" != --* ]]; then method="$1"; shift; fi ;;
      --phone) phone="${2:-}"; shift 2 ;;
      --list-bots) list_bots; exit $? ;;
      --install) action="install"; shift ;;
      --doctor) action="doctor"; shift ;;
      --setup) action="setup"; shift ;;
      --logout) action="logout"; shift ;;
      --update) cmd_update; exit $? ;;
      --personalize) cmd_personalize; exit $? ;;
      --menu) menu_loop; exit 0 ;;
      -h|--help|help) usage; exit 0 ;;
      *) err "Opción desconocida: $1"; usage; exit 1 ;;
    esac
  done

  case "$action" in
    start)
      id="$(resolve_bot "$bot")" || exit 1
      if [ "$method" = "code" ]; then
        phone="$(printf '%s' "${phone:-$LAST_PHONE}" | tr -cd '0-9' | sed 's/^0*//')"
        if [ "${#phone}" -lt 8 ] || [ "${#phone}" -gt 15 ]; then
          if [ -t 0 ]; then
            phone="$(ask_phone)" || exit 1
          else
            err "Falta número válido: --code 59899123456 (o guarda uno abriendo el menú)"
            exit 1
          fi
        fi
        LAST_PHONE="$phone"; save_conf
      fi
      banner; cmd_start "$id" "$method" "$phone" ;;
    install) id="$(resolve_bot "$bot")" || exit 1; cmd_install "$id" ;;
    doctor)  id="$(resolve_bot "$bot")" || exit 1; cmd_doctor "$id" ;;
    setup)   id="$(resolve_bot "$bot")" || exit 1; cmd_setup "$id" ;;
    logout)
      id="$(resolve_bot "$bot")" || exit 1
      rm -rf "$BOTS_DIR/$id/sessions"; ok "Sesión de $id borrada." ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"
