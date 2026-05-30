@echo off
cd /d "%~dp0"
set EXPO_NO_TELEMETRY=1
".codex-node\node.exe" "node_modules\expo\bin\cli" start --dev-client --localhost
