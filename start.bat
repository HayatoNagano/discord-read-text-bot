@echo off
cd /d %~dp0
echo 🔊 VOICEVOX起動中...
start "" "D:\project\voicebox\run.exe"

timeout /t 5 >nul  rem 少し待つ（VOICEVOX起動安定のため）

echo 🚀 Bot起動中...
node index.ts
pause