#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "Project root: $PROJECT_ROOT"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "Error: Python not found. Install Python 3 first."
  exit 1
fi

echo "Using Python: $PYTHON_BIN"

if [ ! -d ".venv" ]; then
  "$PYTHON_BIN" -m venv .venv
fi

if [ -f ".venv/Scripts/activate" ]; then
  # Git Bash on Windows
  # shellcheck source=/dev/null
  source ".venv/Scripts/activate"
elif [ -f ".venv/bin/activate" ]; then
  # Linux/macOS
  # shellcheck source=/dev/null
  source ".venv/bin/activate"
else
  echo "Error: Could not find venv activation script."
  exit 1
fi

python -m pip install --upgrade pip
python -m pip install -r requirements.txt

if [ -f "package.json" ]; then
  if command -v npm >/dev/null 2>&1; then
    npm install
  else
    echo "Warning: npm not found. Skipping root Node dependencies."
  fi
fi

if [ -f ".tmp_logger_ui/package.json" ]; then
  if command -v npm >/dev/null 2>&1; then
    npm install --prefix .tmp_logger_ui
  else
    echo "Warning: npm not found. Skipping .tmp_logger_ui Node dependencies."
  fi
fi

echo ""
echo "Setup complete."
echo "Run app with:"
echo "  source .venv/Scripts/activate  # Git Bash (Windows)"
echo "  python app.py"
