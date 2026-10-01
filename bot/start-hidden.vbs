' Starts start-bot.bat with no visible window, so it cannot be closed by accident.
' Used by the "WhatsAppBot" scheduled task. To stop the bot, run stop-bot.bat.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run "cmd /c start-bot.bat", 0, False
