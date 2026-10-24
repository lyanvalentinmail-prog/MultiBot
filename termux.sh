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
#    bash termux.sh --install         → instala TODO (sistema + npm + sharp)
#    bash termux.sh --reinstall       → reinstala limpio (borra node_modules)
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
    # Ojo: 2>/dev/null VA PRIMERO para silenciar el fallo de < /dev/tty.
    if IFS= read -r __line 2>/dev/null < /dev/tty; then
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
# ── Paquetes del sistema (Termux) ────────────────────────────────────
# El bot necesita binarios fuera de npm: ffmpeg (stickers/audio),
# convert|magick (ImageMagick, stickers), node ≥ 20, git y herramientas
# de compilación (algunas deps nativas se compilan en el teléfono).
install_termux_system() {
  if ! command -v pkg >/dev/null 2>&1; then
    err "No encontré 'pkg' (¿es Termux de verdad?)."
    return 1
  fi
  local faltan=()
  command -v node >/dev/null 2>&1    || faltan+=("nodejs-lts")
  command -v ffmpeg >/dev/null 2>&1  || faltan+=("ffmpeg")
  { command -v magick >/dev/null 2>&1 || command -v convert >/dev/null 2>&1; } || faltan+=("imagemagick")
  command -v git >/dev/null 2>&1     || faltan+=("git")
  command -v python3 >/dev/null 2>&1 || faltan+=("python")
  command -v make >/dev/null 2>&1    || faltan+=("make")
  command -v cc >/dev/null 2>&1      || faltan+=("clang")
  command -v pkg-config >/dev/null 2>&1 || faltan+=("pkg-config")
  if [ "${#faltan[@]}" -eq 0 ]; then
    ok "Paquetes del sistema: todo instalado."
    return 0
  fi
  info "Instalando con pkg: ${faltan[*]}"
  pkg update -y || warn "pkg update falló, sigo igual..."
  pkg install -y "${faltan[@]}" || { err "pkg install falló."; return 1; }
  ok "Paquetes del sistema listos."
}

node_major() { node -v 2>/dev/null | sed -n 's/^v\([0-9]*\).*/\1/p'; }

cmd_install() { # $1 = bot id → sistema (Termux) + npm + sharp + verificación
  local id="$1" dir="$BOTS_DIR/$1"
  title "📦 Instalando todo — $id"
  # 1) Paquetes del sistema (solo Termux).
  if is_termux; then
    install_termux_system || return 1
  elif ! command -v ffmpeg >/dev/null 2>&1; then
    warn "Sin ffmpeg el bot arranca, pero stickers/audio fallarán."
  fi
  # 2) Node ≥ 20.
  if ! command -v node >/dev/null 2>&1; then
    err "Falta node."
    if is_termux; then info "No se pudo instalar nodejs-lts con pkg."; else info "Instala Node.js ≥ 20 primero."; fi
    return 1
  fi
  local major; major="$(node_major)"
  if [ -n "$major" ] && [ "$major" -lt 20 ]; then
    err "Node v$major muy viejo (el bot pide ≥ 20)."
    is_termux && info "Actualiza con: pkg upgrade nodejs-lts -y"
    return 1
  fi
  command -v npm >/dev/null 2>&1 || { err "npm no encontrado (¿nodejs a medias?)."; return 1; }
  # 3) Deps npm del bot.
  info "Instalando paquetes npm (tarda unos minutos en el teléfono)..."
  (cd "$dir" && npm install --no-audit --no-fund) || { err "npm install falló."; return 1; }
  ok "Paquetes npm listos."
  # 4) sharp en Termux/Android (sin esto, plugins de imagen fallan).
  if is_termux && bot_has_script "$id" "fix:sharp"; then
    info "Ajustando sharp para Android..."
    (cd "$dir" && npm run fix:sharp) || warn "fix:sharp falló (se reintentará al iniciar)."
  fi
  # 5) Verificación final.
  local fallos=0
  if command -v ffmpeg >/dev/null 2>&1; then
    ok "ffmpeg listo (stickers y audio)."
  else
    warn "ffmpeg no quedó instalado: stickers y audio fallarán."; fallos=$((fallos+1))
  fi
  if command -v magick >/dev/null 2>&1 || command -v convert >/dev/null 2>&1; then
    ok "ImageMagick listo (stickers)."
  else
    warn "ImageMagick no quedó instalado: algunos stickers fallarán."; fallos=$((fallos+1))
  fi
  if [ -d "$dir/node_modules/@whiskeysockets/baileys" ] || [ -d "$dir/node_modules/@itsliaaa/baileys" ]; then
    ok "Baileys instalado (WhatsApp)."
  else
    warn "Falta Baileys en node_modules: el bot no va a arrancar."; fallos=$((fallos+1))
  fi
  if [ "$fallos" -eq 0 ]; then ok "Todo instalado. Ya puedes iniciar el bot 🚀"
  else warn "Terminó con $fallos pendiente(s), revisa arriba."; fi
  return 0
}

cmd_reinstall() { # $1 = bot id → borra node_modules y reinstala limpio
  local id="$1" dir="$BOTS_DIR/$1"
  title "♻ Reinstalación limpia — $id"
  if [ -d "$dir/node_modules" ]; then
    info "Borrando node_modules..."
    rm -rf "$dir/node_modules" || { err "No se pudo borrar node_modules."; return 1; }
  else
    info "No había node_modules, instalando directo."
  fi
  cmd_install "$id"
}

cmd_doctor() { # $1 = bot id
  local id="$1" dir="$BOTS_DIR/$1"
  title "🩺 Diagnóstico — $id"
  info "Node: $(node -v 2>/dev/null || echo 'no instalado') · npm: $(npm -v 2>/dev/null || echo 'no instalado')"
  if bot_has_script "$id" "doctor"; then
    (cd "$dir" && npm run doctor) || true
  else
    local major; major="$(node_major)"
    if [ -n "$major" ] && [ "$major" -ge 20 ]; then ok "Node $(node -v) (≥ 20 ✓)"
    else err "Node v${major:-?} ausente o viejo (el bot pide ≥ 20)"; fi
    command -v ffmpeg >/dev/null 2>&1 && ok "ffmpeg presente" || warn "Falta ffmpeg (stickers/audio fallarán)"
    { command -v magick >/dev/null 2>&1 || command -v convert >/dev/null 2>&1; } && ok "ImageMagick presente" || warn "Falta ImageMagick (algunos stickers fallarán)"
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
  local antes; antes="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo "")"
  (cd "$ROOT" && git pull --ff-only) || { err "git pull falló (¿cambios locales?)."; return 1; }
  ok "Repo actualizado."
  # Si el pull trajo nuevas dependencias, reinstala solo esos bots.
  local despues; despues="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo "")"
  if [ -n "$antes" ] && [ -n "$despues" ] && [ "$antes" != "$despues" ]; then
    local cambiados
    cambiados="$(git -C "$ROOT" diff --name-only "$antes" "$despues" -- 'bots/*/package.json' 'bots/*/package-lock.json' 2>/dev/null || true)"
    if [ -n "$cambiados" ]; then
      local ids; ids="$(printf '%s\n' "$cambiados" | sed -n 's|^bots/\([^/]*\)/.*|\1|p' | sort -u)"
      local id
      for id in $ids; do
        if [ -f "$BOTS_DIR/$id/package.json" ]; then
          info "Cambiaron dependencias de $id, reinstalando..."
          cmd_install "$id" || warn "No se pudo reinstalar $id (usa la opción 6)."
        fi
      done
    fi
  fi
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
alias mb-update='bash "$ROOT/termux.sh" --update'
alias mb-doctor='bash "$ROOT/termux.sh" --doctor'
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
  alias mb-update="bash \"$ROOT/termux.sh\" --update" 2>/dev/null || true
  alias mb-doctor="bash \"$ROOT/termux.sh\" --doctor" 2>/dev/null || true
  echo ""
  ok "Terminal personalizada:"
  info "Nuevo prompt: 🤖 multibot ruta ❯ (colores cian/verde/magenta)"
  info "Alias: multibot · mb · mb-qr · mb-code · mb-update · mb-doctor"
  info "Banner de bienvenida al abrir Termux"
  info "Cierra y reabre Termux (o ejecuta: source $bashrc) para verlo."
}

# ── Menú principal ─────────────────────────────────────────────────
# ── Personalizar bot (terminal → bot-settings.js) ────────────────────
CUSTOM_CFG=""
bsettings() { # $1=id, resto args → corre scripts/bot-settings.js del bot
  local id="$1"; shift
  (cd "$BOTS_DIR/$id" && node scripts/bot-settings.js "$@")
}
cs_val() { printf '%s' "$CUSTOM_CFG" | grep -m1 "^$1=" | cut -d= -f2-; }
cs_onoff() {
  if [ "$(cs_val "$1")" = "true" ]; then printf '%bON%b' "$C_GREEN" "$C_RESET"
  else printf '%bOFF%b' "$C_RED" "$C_RESET"; fi
}
cs_toggle() { # $1=id $2=key $3=etiqueta
  if [ "$(cs_val "$2")" = "true" ]; then
    bsettings "$1" set "$2" off >/dev/null && ok "$3: OFF" || err "No se pudo guardar."
  else
    bsettings "$1" set "$2" on >/dev/null && ok "$3: ON" || err "No se pudo guardar."
  fi
}
cs_edit() { # $1=id $2=key $3=etiqueta $4=mayúsculas(0/1)
  local cur; cur="$(cs_val "$2")"
  printf '%s [%b%s%b]: ' "$3" "$C_GREEN" "${cur:-—}" "$C_RESET"
  local v; read_input v || return 1
  v="$(printf '%s' "$v" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -z "$v" ] && { info "Sin cambios."; return 0; }
  [ "${4:-0}" = "1" ] && v="$(printf '%s' "$v" | tr '[:lower:]' '[:upper:]')"
  if bsettings "$1" set "$2" "$v" >/dev/null 2>&1; then ok "$3 → $v"
  else err "No se pudo guardar."; fi
}

cs_banner() { # $1=id
  local id="$1" dir="$BOTS_DIR/$1"
  while true; do
    CUSTOM_CFG="$(bsettings "$id" list 2>/dev/null)"
    local cur; cur="$(cs_val botBanner)"; [ -z "$cur" ] && cur="(banner por defecto 🐱)"
    banner
    printf '%b🖼️  Banner del bot: %b%s%b\n\n' "$C_BOLD" "$C_MAGENTA" "$id" "$C_RESET"
    printf '  Actual: %b%s%b\n\n' "$C_CYAN" "$cur" "$C_RESET"
    printf '%b  1)%b 🐱 Restaurar banner por defecto\n' "$C_YELLOW" "$C_RESET"
    printf '%b  2)%b 🖼️  Poner imagen local (ej. ~/Download/mi-banner.jpg)\n' "$C_YELLOW" "$C_RESET"
    printf '%b  3)%b 🔗 Poner URL de imagen (https://...)\n' "$C_YELLOW" "$C_RESET"
    printf '%b  0)%b ↩ Volver\n' "$C_YELLOW" "$C_RESET"
    printf '\nElige: '
    local opt; read_input opt || return 0
    case "$opt" in
      1) bsettings "$id" set botBanner >/dev/null 2>&1 && ok "Banner restaurado." || err "No se pudo."; sleep 1 ;;
      2)
        printf 'Ruta de la imagen: '
        local ruta; read_input ruta || continue
        ruta="$(printf '%s' "$ruta" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
        ruta="${ruta/#\~/$HOME}"
        if [ ! -f "$ruta" ]; then err "No existe ese archivo."; sleep 1; continue; fi
        local size; size="$(wc -c < "$ruta" 2>/dev/null || echo 0)"
        if [ "$size" -gt 5242880 ]; then err "Muy pesada (>5 MB), usa una más liviana."; sleep 1; continue; fi
        local ext; ext="$(printf '%s' "$ruta" | sed 's/.*\.//;s/.*/\L&/')"
        case "$ext" in jpg|jpeg|png|webp) ;; *) warn "Extensión .$ext (ojalá sea imagen válida)..."; ;; esac
        mkdir -p "$dir/storage/img"
        rm -f "$dir"/storage/img/banner-custom.*
        cp "$ruta" "$dir/storage/img/banner-custom.$ext" || { err "No se pudo copiar."; sleep 1; continue; }
        bsettings "$id" set botBanner "./storage/img/banner-custom.$ext" >/dev/null 2>&1           && ok "Banner actualizado." || err "Se copió pero no se guardó en config."
        sleep 1 ;;
      3)
        printf 'URL https:// de la imagen: '
        local url; read_input url || continue
        url="$(printf '%s' "$url" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
        if [[ "$url" != http* ]]; then err "Debe empezar con http(s)://"; sleep 1; continue; fi
        bsettings "$id" set botBanner "$url" >/dev/null 2>&1 && ok "Banner actualizado." || err "No se pudo."
        sleep 1 ;;
      0) return 0 ;;
      *) err "Opción no válida."; sleep 1 ;;
    esac
  done
}

cs_owners() { # $1=id
  local id="$1"
  while true; do
    CUSTOM_CFG="$(bsettings "$id" list 2>/dev/null)"
    banner
    printf '%b👑 Owners y admins: %b%s%b\n\n' "$C_BOLD" "$C_MAGENTA" "$id" "$C_RESET"
    printf '%bOwners:%b\n' "$C_BOLD" "$C_RESET"
    local olines; olines="$(printf '%s' "$CUSTOM_CFG" | grep "^owner\." | cut -d= -f2-)"
    if [ -z "$olines" ]; then printf '  (nadie — el bot necesita un owner)\n'
    else printf '%s\n' "$olines" | nl -w2 -s') ' | sed 's/^/  /'; fi
    printf '%bAdmins (mods):%b\n' "$C_BOLD" "$C_RESET"
    local mlines; mlines="$(printf '%s' "$CUSTOM_CFG" | grep "^mod\." | cut -d= -f2-)"
    if [ -z "$mlines" ]; then printf '  (nadie)\n'
    else printf '%s\n' "$mlines" | nl -w2 -s') ' | sed 's/^/  /'; fi
    printf '\n%b  1)%b ➕ Agregar owner\n' "$C_YELLOW" "$C_RESET"
    printf '%b  2)%b ➖ Quitar owner\n' "$C_YELLOW" "$C_RESET"
    printf '%b  3)%b ➕ Agregar admin (mod)\n' "$C_YELLOW" "$C_RESET"
    printf '%b  4)%b ➖ Quitar admin (mod)\n' "$C_YELLOW" "$C_RESET"
    printf '%b  0)%b ↩ Volver\n' "$C_YELLOW" "$C_RESET"
    printf '\nElige: '
    local opt; read_input opt || return 0
    case "$opt" in
      1)
        printf 'Nombre del owner: '
        local name; read_input name || continue
        local phone; phone="$(ask_phone)" || continue
        bsettings "$id" owner-add "$phone" "${name:-Owner}" >/dev/null 2>&1           && ok "Owner $phone agregado." || err "No se pudo."
        sleep 1 ;;
      2)
        [ -z "$olines" ] && { info "No hay owners."; sleep 1; continue; }
        printf 'Número de la lista a quitar: '
        local n; read_input n || continue
        local line; line="$(printf '%s\n' "$olines" | sed -n "${n}p")"
        local phone; phone="$(printf '%s' "$line" | cut -d'|' -f1)"
        [ -z "$phone" ] && { err "Opción no válida."; sleep 1; continue; }
        bsettings "$id" owner-del "$phone" >/dev/null 2>&1 && ok "Owner $phone quitado." || err "No se pudo."
        sleep 1 ;;
      3)
        local phone; phone="$(ask_phone)" || continue
        bsettings "$id" mod-add "$phone" >/dev/null 2>&1 && ok "Admin $phone agregado." || err "No se pudo."
        sleep 1 ;;
      4)
        [ -z "$mlines" ] && { info "No hay admins."; sleep 1; continue; }
        printf 'Número de la lista a quitar: '
        local n; read_input n || continue
        local phone; phone="$(printf '%s\n' "$mlines" | sed -n "${n}p")"
        [ -z "$phone" ] && { err "Opción no válida."; sleep 1; continue; }
        bsettings "$id" mod-del "$phone" >/dev/null 2>&1 && ok "Admin $phone quitado." || err "No se pudo."
        sleep 1 ;;
      0) return 0 ;;
      *) err "Opción no válida."; sleep 1 ;;
    esac
  done
}

cmd_customize() { # $1 = bot id
  local id="$1" dir="$BOTS_DIR/$1"
  if [ ! -f "$dir/scripts/bot-settings.js" ]; then
    err "Este bot no trae personalización (falta scripts/bot-settings.js)."
    return 1
  fi
  if ! command -v node >/dev/null 2>&1; then err "Falta node."; return 1; fi
  while true; do
    CUSTOM_CFG="$(bsettings "$id" list 2>/dev/null)"
    [ -n "$CUSTOM_CFG" ] || { err "No se pudo leer la config del bot."; return 1; }
    local nowners nmods; nowners=$(printf '%s' "$CUSTOM_CFG" | grep -c "^owner\."); nmods=$(printf '%s' "$CUSTOM_CFG" | grep -c "^mod\.")
    local bannerCur; bannerCur="$(cs_val botBanner)"; [ -z "$bannerCur" ] && bannerCur="(defecto 🐱)"
    local resp; [ "$(cs_val quotedVerificado)" = "true" ] && resp="estado 📢" || resp="responder 💬"
    banner
    printf '%b🎛 Personalizar bot: %b%s%b\n\n' "$C_BOLD" "$C_MAGENTA" "$id" "$C_RESET"
    printf '%b  1)%b ✏️  Nombre del bot ...... %b%s%b\n' "$C_YELLOW" "$C_RESET" "$C_CYAN" "$(cs_val namebot)" "$C_RESET"
    printf '%b  2)%b 📦 Nombre de stickers ... %b%s%b\n' "$C_YELLOW" "$C_RESET" "$C_CYAN" "$(cs_val packname)" "$C_RESET"
    printf '%b  3)%b 👤 Autor de stickers .... %b%s%b\n' "$C_YELLOW" "$C_RESET" "$C_CYAN" "$(cs_val author)" "$C_RESET"
    printf '%b  4)%b 💰 Moneda ............... %b%s%b\n' "$C_YELLOW" "$C_RESET" "$C_CYAN" "$(cs_val moneda)" "$C_RESET"
    printf '%b  5)%b 🖼️  Banner ............... %b%s%b\n' "$C_YELLOW" "$C_RESET" "$C_CYAN" "$bannerCur" "$C_RESET"
    printf '%b  6)%b 👑 Owners/admins ....... %b%s owner(s) · %s admin(s)%b\n' "$C_YELLOW" "$C_RESET" "$C_CYAN" "$nowners" "$nmods" "$C_RESET"
    printf '%b  7)%b ⚡ Comandos ............. %s\n' "$C_YELLOW" "$C_RESET" "$(cs_onoff comandosEnabled)"
    printf '%b  8)%b 📨 Reenviados ........... %s\n' "$C_YELLOW" "$C_RESET" "$(cs_onoff mensajesReenviados)"
    printf '%b  9)%b 💬 Responder como ....... %b%s%b\n' "$C_YELLOW" "$C_RESET" "$C_CYAN" "$resp" "$C_RESET"
    printf '%b 10)%b 📋 Menú de lista ........ %s\n' "$C_YELLOW" "$C_RESET" "$(cs_onoff menuLista)"
    printf '%b 11)%b 🌍 Modo público ......... %s\n' "$C_YELLOW" "$C_RESET" "$(cs_onoff modoPublico)"
    printf '%b 12)%b 📄 Ver todo\n' "$C_YELLOW" "$C_RESET"
    printf '%b  0)%b ↩ Volver\n' "$C_YELLOW" "$C_RESET"
    printf '\nElige: '
    local opt; read_input opt || return 0
    case "$opt" in
      1) cs_edit "$id" namebot "Nombre del bot"; sleep 1 ;;
      2) cs_edit "$id" packname "Nombre de stickers"; sleep 1 ;;
      3) cs_edit "$id" author "Autor de stickers"; sleep 1 ;;
      4) cs_edit "$id" moneda "Moneda (ej. USD, UYU, MXN)" 1; sleep 1 ;;
      5) cs_banner "$id" ;;
      6) cs_owners "$id" ;;
      7) cs_toggle "$id" comandosEnabled "Comandos"; sleep 1 ;;
      8) cs_toggle "$id" mensajesReenviados "Reenviados"; sleep 1 ;;
      9)
        printf 'Responder como: %b1)%b estado 📢  %b2)%b responder citando 💬 : ' "$C_YELLOW" "$C_RESET" "$C_YELLOW" "$C_RESET"
        local modo; read_input modo || continue
        case "$modo" in
          1) bsettings "$id" set respuesta estado >/dev/null 2>&1 && ok "Modo: estado 📢" || err "No se pudo." ;;
          2) bsettings "$id" set respuesta responder >/dev/null 2>&1 && ok "Modo: responder 💬" || err "No se pudo." ;;
          *) err "Opción no válida." ;;
        esac
        sleep 1 ;;
      10) cs_toggle "$id" menuLista "Menú de lista"; sleep 1 ;;
      11) cs_toggle "$id" modoPublico "Modo público"; sleep 1 ;;
      12)
        title "📄 Personalización — $id"
        printf '%s\n' "$CUSTOM_CFG" | sed 's/^/  /'
        pause ;;
      0) return 0 ;;
      *) err "Opción no válida."; sleep 1 ;;
    esac
  done
}

show_menu() {
  banner
  local estado1=""
  for b in "${BOT_IDS[@]}"; do
    if [ "$b" = "$DEFAULT_BOT" ]; then estado1=" $(status_icon "$b")"; break; fi
  done
  printf '%b  1)%b 🚀 Iniciar bot %b[%s]%b%s\n' "$C_YELLOW" "$C_RESET" "$C_GRAY" "$DEFAULT_BOT" "$C_RESET" "$estado1"
  printf '%b  2)%b 🤖 Elegir bot (actual: %b%s%b)\n' "$C_YELLOW" "$C_RESET" "$C_GREEN" "$DEFAULT_BOT" "$C_RESET"
  printf '%b  3)%b 🔑 Pedir Pairing Code\n' "$C_YELLOW" "$C_RESET"
  printf '%b  4)%b 📷 Mostrar QR\n' "$C_YELLOW" "$C_RESET"
  printf '%b  5)%b ⚙  Configurar bot (número, nombre)\n' "$C_YELLOW" "$C_RESET"
  printf '%b  6)%b 📦 Instalar todo (sistema + dependencias)\n' "$C_YELLOW" "$C_RESET"
  printf '%b  7)%b 🩺 Diagnóstico (doctor)\n' "$C_YELLOW" "$C_RESET"
  printf '%b  8)%b ℹ  Ver info del bot\n' "$C_YELLOW" "$C_RESET"
  printf '%b  9)%b 🚪 Borrar sesión (desvincular WhatsApp)\n' "$C_YELLOW" "$C_RESET"
  printf '%b 10)%b ⬆  Actualizar desde GitHub\n' "$C_YELLOW" "$C_RESET"
  printf '%b 11)%b 🎨 Personalizar terminal Termux\n' "$C_YELLOW" "$C_RESET"
  printf '%b 12)%b 🎛 Personalizar bot (stickers, banner, owners…)\n' "$C_YELLOW" "$C_RESET"
  printf '%b 13)%b ♻ Reinstalación limpia (borra node_modules)\n' "$C_YELLOW" "$C_RESET"
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
      12) id="$(pick_bot choose)" && cmd_customize "$id" ;;
      13) id="$(pick_bot choose)" && cmd_reinstall "$id"; pause ;;
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
  bash termux.sh --install [--bot <id>] Instala todo: sistema (Termux) + npm + sharp
  bash termux.sh --reinstall [--bot <id>] Reinstala limpio (borra node_modules)
  bash termux.sh --doctor [--bot <id>]  Diagnóstico
  bash termux.sh --setup [--bot <id>]   Configura owner/nombre
  bash termux.sh --customize [--bot <id>] Personaliza el bot (stickers, banner…)
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
      --reinstall) action="reinstall"; shift ;;
      --doctor) action="doctor"; shift ;;
      --setup) action="setup"; shift ;;
      --logout) action="logout"; shift ;;
      --update) cmd_update; exit $? ;;
      --personalize) cmd_personalize; exit $? ;;
      --customize) action="customize"; shift ;;
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
    reinstall) id="$(resolve_bot "$bot")" || exit 1; cmd_reinstall "$id" ;;
    doctor)  id="$(resolve_bot "$bot")" || exit 1; cmd_doctor "$id" ;;
    setup)   id="$(resolve_bot "$bot")" || exit 1; cmd_setup "$id" ;;
    customize) id="$(resolve_bot "$bot")" || exit 1; cmd_customize "$id" ;;
    logout)
      id="$(resolve_bot "$bot")" || exit 1
      rm -rf "$BOTS_DIR/$id/sessions"; ok "Sesión de $id borrada." ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"
