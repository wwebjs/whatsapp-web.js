@echo off
rem Starts the WhatsApp bot and restarts it whenever it stops.
rem Launch it at login via Task Scheduler or a shortcut in the Startup folder
rem (Win+R, type shell:startup). Output and timestamps go to data\bot.log.
cd /d "%~dp0"
if not exist data mkdir data
:loop
echo [%date% %time%] starting bot >> data\bot.log
node bot.js >> data\bot.log 2>&1
set code=%errorlevel%
rem Exit code 99 means "!stop" was sent from WhatsApp: stay stopped.
if "%code%"=="99" (
    echo [%date% %time%] stopped with !stop >> data\bot.log
    exit /b 0
)
echo [%date% %time%] bot stopped (exit code %code%), restarting in 10 seconds >> data\bot.log
rem "timeout" fails when there is no console (hidden/scheduled runs); ping waits reliably.
ping -n 11 127.0.0.1 >nul
goto loop
