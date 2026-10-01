@echo off
rem Starts the WhatsApp bot right now (hidden) through its scheduled task.
rem Double-click this file, or put a shortcut to it on your Desktop.
schtasks /run /tn "WhatsAppBot"
echo WhatsApp bot starting. Give it about 2 minutes, then send !ping.
ping -n 4 127.0.0.1 >nul
