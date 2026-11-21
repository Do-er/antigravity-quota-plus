#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Load OVSX_PAT from .env if present (supports KEY=VAL, spaces around '=', or a bare token line)
if [ -z "${OVSX_PAT:-}" ] && [ -f .env ]; then
  OVSX_PAT=$(node -e '
    const fs = require("fs");
    const lines = fs.readFileSync(".env", "utf8").split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^(?:export\s+)?OVSX_PAT\s*=\s*(.+)$/);
      if (m) {
        console.log(m[1].trim().replace(/^["'\'']|["'\'']$/g, ""));
        process.exit(0);
      }
      if (!line.includes("=") && !/\s/.test(line)) {
        console.log(line);
        process.exit(0);
      }
    }
  ')
fi

if [ -z "${OVSX_PAT:-}" ]; then
  echo "Error: OVSX_PAT is not set. Add OVSX_PAT=... to .env or export it first." >&2
  exit 1
fi

VERSION=$(node -p "require('./package.json').version")
VSIX_FILE="antigravity-quota-plus-${VERSION}.vsix"

if [ "${1:-}" != "--skip-package" ]; then
  echo "1/2 Building ${VSIX_FILE}..."
  npm run node:vsix:package
else
  echo "1/2 Skipping build, using existing ${VSIX_FILE}..."
fi

if [ ! -f "${VSIX_FILE}" ]; then
  echo "Error: ${VSIX_FILE} not found." >&2
  exit 1
fi

echo "2/2 Publishing ${VSIX_FILE} to Open VSX..."
npx --yes ovsx publish "${VSIX_FILE}" -p "${OVSX_PAT}"

echo "Done: https://open-vsx.org/extension/Doer/antigravity-quota-plus"
