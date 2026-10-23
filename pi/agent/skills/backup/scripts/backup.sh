#!/bin/bash
# Multi-endpoint backup (directory-based): everything under <project root>/backup/
# is backed up. The directory IS the tag list - no manifest file.
#
# Endpoint subdirectories: a FIRST-LEVEL subdirectory of
# backup/ whose name equals a REGISTERED endpoint name (e.g. backup/feishu/)
# holds files for THAT endpoint ONLY. Files directly under backup/ (or in other,
# non-endpoint subdirectories) are "shared" and go to ALL endpoints.
#
# Per-endpoint backup mode (registry field "mode", default "archive"):
#   raw     : upload each file AS-IS (no packing), preserving its relative path
#             under backup/ as the cloud folder layout. Optional "file_formats"
#             glob whitelist (e.g. ["*.pdf","*.md"]) filters what gets uploaded;
#             files not matching are skipped with a [SKIP] line. Case-sensitive.
#   archive : pack shared + this endpoint's subdir into one tar.gz (excluding
#             other endpoints' subdirs) and upload the single archive.
#
# Endpoints are read from ../endpoints/endpoints.json. Each entry: name, display,
# type, credential info, reference, optional mode / file_formats; builtin-lark-cli
# entries also carry root_folder_name / root_folder_token and optional notes
# (machine-private values, living only in this registry - never in skill files).
# Two types:
#   builtin-lark-cli : Feishu Drive via lark-cli (details: references/feishu.md)
#   rclone           : any rclone remote; entry carries "remote" and "path"
# Endpoints run independently: one failing does not stop the others; exit code 1
# if any failed.
# Usage:
#   backup.sh <project dir>                     # backup to ALL registered endpoints
#   backup.sh <project dir> --endpoint <name>   # backup to ONE registered endpoint
#   backup.sh <project dir> --list              # list what would be backed up
# Requires: jq; per-endpoint tooling (lark-cli / rclone) already authorized.
# Fixed-path files that cannot move into backup/ (e.g. CLAUDE.local.md) are
# represented there as symlinks; archive mode dereferences them (tar -h), raw
# mode stages them with cp -L so the link name is kept, content is uploaded.
# NOTE: keep this file pure ASCII (a stray invisible Unicode char once broke bash).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENDPOINTS_JSON="$SCRIPT_DIR/../endpoints/endpoints.json"

PROJECT_DIR="${1:?Usage: backup.sh <project dir> [--endpoint <name>] [--list]}"
shift || true
MODE="backup"
ONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --list) MODE="--list";;
    --endpoint) ONLY="${2:?--endpoint needs a name}"; shift;;
    *) echo "[ERR] unknown arg: $1"; exit 1;;
  esac
  shift
done

BACKUP_DIR_NAME="backup"

export NO_PROXY="feishu.cn,.feishu.cn,larksuite.com,.larksuite.com,127.0.0.1,localhost"

PROJECT_DIR="${PROJECT_DIR%/}"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
[ -d "$PROJECT_DIR" ] || { echo "[ERR] project dir not found: $PROJECT_DIR"; exit 1; }
[ -f "$ENDPOINTS_JSON" ] || { echo "[ERR] endpoints registry not found: $ENDPOINTS_JSON"; echo "Register an endpoint first (references/new-endpoint.md)."; exit 1; }
BACKUP_DIR="$PROJECT_DIR/$BACKUP_DIR_NAME"

# --- Load registered endpoint names (needed for subdirectory routing) ---
EP_NAMES=()
while IFS= read -r n; do
  if [ -n "$n" ]; then EP_NAMES+=("$n"); fi
done < <(jq -r '.endpoints[].name' "$ENDPOINTS_JSON")
[ "${#EP_NAMES[@]}" -gt 0 ] || { echo "[ERR] no endpoints registered in $ENDPOINTS_JSON"; exit 1; }
if [ -n "$ONLY" ]; then
  FOUND=0
  for n in "${EP_NAMES[@]}"; do
    if [ "$n" = "$ONLY" ]; then FOUND=1; fi
  done
  if [ "$FOUND" -eq 0 ]; then
    echo "[ERR] endpoint '$ONLY' not registered in $ENDPOINTS_JSON"
    echo "Registered endpoints: ${EP_NAMES[*]:-none}"
    exit 1
  fi
  EP_NAMES=("$ONLY")
fi

# A backup/ subdirectory routes to ONE endpoint iff its name is a registered
# endpoint; any other subdirectory is ordinary shared content.
is_endpoint_dir() {   # $1 = first-level dir name under backup/
  for n in "${EP_NAMES[@]}"; do
    if [ "$n" = "$1" ]; then return 0; fi
  done
  return 1
}

# First path component of a relative entry (empty for top-level files)
top_of() { case "$1" in */*) echo "${1%%/*}";; *) echo "";; esac; }

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Project $PROJECT_NAME has no $BACKUP_DIR_NAME/ directory (nothing to back up)."
  echo "To back up files: put them (or symlinks to them) under $PROJECT_DIR/$BACKUP_DIR_NAME/,"
  echo "and make sure '$BACKUP_DIR_NAME/' is in .gitignore."
  exit 0
fi

# Snapshot the file list once (filenames may contain $ or backticks, so the
# list goes to a file - never through an unquoted heredoc or eval-like path)
LIST_FILE="$(mktemp)"
trap 'rm -rf "$LIST_FILE"' EXIT
(cd "$BACKUP_DIR" && find . \( -type f -o -type l \) | sed 's|^\./||' | sort) > "$LIST_FILE"

TOTAL_COUNT=$(grep -c . "$LIST_FILE" || true)

# Group: shared (all endpoints) vs per-endpoint subdirectories
EP_DIRS=()   # registered endpoints that actually have files under backup/<name>/
SHARED_COUNT=0
while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  TOP="$(top_of "$rel")"
  if [ -n "$TOP" ] && is_endpoint_dir "$TOP"; then
    SEEN=0
    for e in "${EP_DIRS[@]:-}"; do
      if [ "$e" = "$TOP" ]; then SEEN=1; fi
    done
    if [ "$SEEN" -eq 0 ]; then EP_DIRS+=("$TOP"); fi
  else
    SHARED_COUNT=$((SHARED_COUNT+1))
  fi
done < "$LIST_FILE"

echo "== $PROJECT_NAME backup directory ($BACKUP_DIR_NAME/) =="
echo "-- shared (to ALL endpoints): $SHARED_COUNT file(s)"
while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  TOP="$(top_of "$rel")"
  if [ -n "$TOP" ] && is_endpoint_dir "$TOP"; then continue; fi
  echo "  [OK] $rel"
done < "$LIST_FILE"
for ep in "${EP_DIRS[@]:-}"; do
  [ -n "$ep" ] || continue
  C=0
  while IFS= read -r rel; do
    case "$rel" in "$ep"/*) C=$((C+1));; esac
  done < "$LIST_FILE"
  echo "-- $BACKUP_DIR_NAME/$ep/ (ONLY to endpoint: $ep): $C file(s)"
  while IFS= read -r rel; do
    case "$rel" in "$ep"/*) echo "  [OK] $rel";; esac
  done < "$LIST_FILE"
done

# Endpoint mode / whitelist summary (so --list also previews filtering)
for EP in "${EP_NAMES[@]}"; do
  EP_MODE="$(jq -r --arg n "$EP" '.endpoints[] | select(.name == $n) | (.mode // "archive")' "$ENDPOINTS_JSON")"
  EP_WL="$(jq -r --arg n "$EP" '.endpoints[] | select(.name == $n) | ((.file_formats // []) | join(", "))' "$ENDPOINTS_JSON")"
  if [ -n "$EP_WL" ]; then
    echo "-- endpoint $EP: mode=$EP_MODE, whitelist: $EP_WL (non-matching files are skipped)"
  else
    echo "-- endpoint $EP: mode=$EP_MODE"
  fi
done

if [ "$TOTAL_COUNT" -eq 0 ]; then
  echo "Directory $BACKUP_DIR_NAME/ is empty - nothing to back up."
  exit 0
fi
if [ "$MODE" = "--list" ]; then echo "(--list mode, done)"; exit 0; fi

# --- Policy: backup/ holds PRIVATE files, so the whole
# --- directory MUST be gitignored. Never list member filenames in .gitignore
# --- (.gitignore is public - filenames leak information). Refuse otherwise.
if [ -d "$PROJECT_DIR/.git" ]; then
  if ! git -C "$PROJECT_DIR" check-ignore -q "$BACKUP_DIR_NAME" 2>/dev/null; then
    echo "[ERR] policy violation: $BACKUP_DIR_NAME/ must be gitignored (private-only backup)."
    echo "Add '$BACKUP_DIR_NAME/' to $PROJECT_DIR/.gitignore (one line, no filenames), then re-run."
    exit 1
  fi
fi

WORKROOT="$(mktemp -d)"
trap 'rm -rf "$LIST_FILE" "$WORKROOT"' EXIT

# Entries visible to endpoint $1: everything except OTHER endpoints' subdirs
entries_for_ep() {   # $1 = endpoint name; prints rel entries
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    TOP="$(top_of "$rel")"
    if [ -n "$TOP" ] && is_endpoint_dir "$TOP" && [ "$TOP" != "$1" ]; then continue; fi
    printf '%s\n' "$rel"
  done < "$LIST_FILE"
}

# Whitelist patterns for endpoint $1, one per line (empty output = no filter)
ep_whitelist() {
  jq -r --arg n "$1" '.endpoints[] | select(.name == $n) | (.file_formats // [])[]' "$ENDPOINTS_JSON"
}

# Does $1 match any glob pattern read from stdin?
name_matches_any() {
  local pat
  while IFS= read -r pat; do
    [ -n "$pat" ] || continue
    case "$1" in $pat) return 0;; esac
  done
  return 1
}

# Resolve a symlink to a real staged file (keeps the link name as filename);
# non-symlinks pass through untouched. Echoes the path to upload.
stage_if_symlink() {   # $1 = rel entry
  local rel="$1" base="${1##*/}"
  if [ -L "$BACKUP_DIR/$rel" ]; then
    local st="$WORKROOT/stage"
    mkdir -p "$st"
    cp -L "$BACKUP_DIR/$rel" "$st/$base"
    echo "$st/$base"
  else
    echo "$BACKUP_DIR/$rel"
  fi
}

# --- Feishu (lark-cli) folder token helpers (bash 3.2: no assoc arrays) ---
FE_PROJ_TOKEN=""
FE_CACHE_PATH=""
FE_CACHE_TOKEN=""

feishu_root_folder() {   # root backup folder token from the registry (machine-private value)
  jq -r '[.endpoints[] | select(.type == "builtin-lark-cli") | .root_folder_token // empty] | first // empty' "$ENDPOINTS_JSON"
}

feishu_child_folder() {   # $1 parent token, $2 name -> child folder token (create if missing)
  local t
  t=$(lark-cli drive files list --folder-token "$1" --as user 2>/dev/null \
    | jq -r --arg n "$2" '.data.files[]? | select(.name == $n and .type == "folder") | .token' | head -1)
  if [ -z "$t" ] || [ "$t" = "null" ]; then
    t=$(lark-cli drive +create-folder --name "$2" --folder-token "$1" --as user \
      | jq -r '.data.folder_token')
    echo "  Created cloud folder: $2" >&2
  fi
  echo "$t"
}

feishu_project_token() {
  if [ -z "$FE_PROJ_TOKEN" ]; then
    local root
    root="$(feishu_root_folder)"
    if [ -z "$root" ]; then
      echo "[ERR] no root_folder_token set for the builtin-lark-cli endpoint in $ENDPOINTS_JSON" >&2
      return 1
    fi
    FE_PROJ_TOKEN="$(feishu_child_folder "$root" "$PROJECT_NAME")"
  fi
  echo "$FE_PROJ_TOKEN"
}

# $1 = subpath relative to the project folder ("" = project folder itself)
feishu_dir_token() {
  local want="$1"
  if [ -n "$FE_CACHE_TOKEN" ] && [ "$want" = "$FE_CACHE_PATH" ]; then
    echo "$FE_CACHE_TOKEN"
    return 0
  fi
  local tok rest seg
  tok="$(feishu_project_token)"
  rest="$want"
  while [ -n "$rest" ]; do
    seg="${rest%%/*}"
    if [ "$rest" = "$seg" ]; then rest=""; else rest="${rest#*/}"; fi
    tok="$(feishu_child_folder "$tok" "$seg")"
  done
  FE_CACHE_PATH="$want"
  FE_CACHE_TOKEN="$tok"
  echo "$tok"
}

upload_one_feishu() {   # $1 = rel entry; rc 0 = ok
  local rel="$1"
  local dir="" base="$rel"
  case "$rel" in */*) dir="${rel%/*}"; base="${rel##*/}";; esac
  local tok src
  tok="$(feishu_dir_token "$dir")"
  src="$(stage_if_symlink "$rel")"
  case "$base" in
    *.md)
      # Endpoint convention: .md uploads as a native Feishu doc (docx), title =
      # filename without extension (details: references/feishu.md)
      (cd "$(dirname "$src")" \
        && cat "./$base" | lark-cli docs +create --doc-format markdown \
             --title "${base%.md}" --content - --parent-token "$tok" --as user \
        | jq -e '.ok' >/dev/null)
      ;;
    *)
      (cd "$(dirname "$src")" \
        && lark-cli drive +upload --file "./$base" --folder-token "$tok" --as user \
        | jq -e '.ok' >/dev/null)
      ;;
  esac
}

upload_one_rclone() {   # $1 = rel entry, $2 = dest root (remote:path/project); rc 0 = ok
  local rel="$1" dest_root="$2"
  local src
  src="$(stage_if_symlink "$rel")"
  rclone copyto "$src" "$dest_root/$rel"
}

# --- RAW mode: upload files as-is, preserving relative paths ---
RAW_OK_COUNT=0
run_raw_backup() {   # $1 EP, $2 EP_TYPE; rc 0 = no failures
  local EP="$1" EP_TYPE="$2"
  local WL_FILE="$WORKROOT/wl-$EP"
  ep_whitelist "$EP" > "$WL_FILE"
  local n_ok=0 n_skip=0 n_fail=0 total=0
  local RC_DEST=""
  if [ "$EP_TYPE" = "rclone" ]; then
    local r p
    r="$(jq -r --arg n "$EP" '.endpoints[] | select(.name == $n) | .remote' "$ENDPOINTS_JSON")"
    p="$(jq -r --arg n "$EP" '.endpoints[] | select(.name == $n) | .path // ""' "$ENDPOINTS_JSON")"
    RC_DEST="${r}:${p%/}/${PROJECT_NAME}"
  fi
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    total=$((total+1))
    local base="${rel##*/}"
    if [ -s "$WL_FILE" ] && ! name_matches_any "$base" < "$WL_FILE"; then
      echo "  [SKIP] $rel (format not in whitelist for $EP)"
      n_skip=$((n_skip+1))
      continue
    fi
    local ok=0
    case "$EP_TYPE" in
      builtin-lark-cli) upload_one_feishu "$rel" && ok=1;;
      rclone) upload_one_rclone "$rel" "$RC_DEST" && ok=1;;
      *) echo "  [FAIL] $rel: unknown endpoint type '$EP_TYPE'";;
    esac
    if [ "$ok" -eq 1 ]; then
      n_ok=$((n_ok+1))
      echo "  [UP  ] $rel -> $EP"
    else
      n_fail=$((n_fail+1))
      echo "  [FAIL] $rel (check credential / re-authorize, see its reference doc)"
    fi
  done < <(entries_for_ep "$EP")
  RAW_OK_COUNT=$n_ok
  if [ "$total" -eq 0 ]; then
    echo "  Nothing to back up for this endpoint."
    return 0
  fi
  echo "  $EP raw upload done: $n_ok uploaded, $n_skip skipped (whitelist), $n_fail failed"
  [ "$n_fail" -eq 0 ]
}

# --- ARCHIVE mode: pack shared + this endpoint's subdir into one tar.gz ---
run_archive_backup() {   # $1 EP, $2 EP_TYPE; rc 0 = ok
  local EP="$1" EP_TYPE="$2"
  local workdir="$WORKROOT/$EP"
  mkdir -p "$workdir"
  local archive="${PROJECT_NAME}-backup-$(date +%Y-%m-%d).tar.gz"
  local args=(-czf "$workdir/$archive" -h -C "$PROJECT_DIR")
  local n
  for n in "${EP_NAMES[@]}"; do
    if [ "$n" != "$EP" ]; then args+=("--exclude" "$BACKUP_DIR_NAME/$n"); fi
  done
  args+=("$BACKUP_DIR_NAME")
  tar "${args[@]}"
  local count
  count=$(tar -tzf "$workdir/$archive" | grep -vc '/$' || true)
  if [ "$count" -eq 0 ]; then
    echo "  Nothing to back up for this endpoint (no shared files, no $BACKUP_DIR_NAME/$EP/ content)."
    return 0
  fi
  RAW_OK_COUNT=$count
  echo "  Packed for $EP: $archive ($(du -h "$workdir/$archive" | cut -f1), $count files)"
  case "$EP_TYPE" in
    builtin-lark-cli)
      # archive upload via lark-cli: reuse raw folder helpers on the single file
      local tok
      tok="$(feishu_dir_token "")"
      (cd "$workdir" && lark-cli drive +upload --file "./$archive" --folder-token "$tok" --as user \
        | jq -e '.ok' >/dev/null) \
        && echo "[DONE] $EP: Feishu Drive /${PROJECT_NAME}/${archive} ($count files)"
      ;;
    rclone)
      local r p dest
      r="$(jq -r --arg n "$EP" '.endpoints[] | select(.name == $n) | .remote' "$ENDPOINTS_JSON")"
      p="$(jq -r --arg n "$EP" '.endpoints[] | select(.name == $n) | .path // ""' "$ENDPOINTS_JSON")"
      dest="${r}:${p%/}/${PROJECT_NAME}"
      rclone copy "$workdir/$archive" "$dest" \
        && echo "[DONE] $EP: ${dest}/${archive} ($count files)"
      ;;
    *)
      echo "[FAIL] $EP: unknown endpoint type '$EP_TYPE'"
      return 1
      ;;
  esac
}

# --- Run each endpoint independently ---
FAIL=0
ANY=0
for EP in "${EP_NAMES[@]}"; do
  echo "-- endpoint: $EP"
  EP_TYPE="$(jq -r --arg n "$EP" '.endpoints[] | select(.name == $n) | .type' "$ENDPOINTS_JSON")"
  EP_MODE="$(jq -r --arg n "$EP" '.endpoints[] | select(.name == $n) | (.mode // "archive")' "$ENDPOINTS_JSON")"
  RAW_OK_COUNT=0
  EP_RC=1
  if [ "$EP_MODE" = "raw" ]; then
    run_raw_backup "$EP" "$EP_TYPE" && EP_RC=0
  else
    run_archive_backup "$EP" "$EP_TYPE" && EP_RC=0
  fi
  if [ "$EP_RC" -eq 0 ] && [ "$RAW_OK_COUNT" -gt 0 ]; then ANY=1; fi
  if [ "$EP_RC" -ne 0 ]; then
    echo "[FAIL] $EP: backup failed"
    FAIL=1
  fi
done
if [ "$ANY" -eq 0 ] && [ "$FAIL" -eq 0 ]; then
  echo "No endpoint had anything to back up."
fi
exit "$FAIL"
