@echo off
rem Stops the WhatsApp bot completely: the restart loop (start-bot.bat) and the bot itself.
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='cmd.exe'\" | Where-Object { $_.CommandLine -like '*start-bot.bat*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force"
echo WhatsApp bot stopped.
