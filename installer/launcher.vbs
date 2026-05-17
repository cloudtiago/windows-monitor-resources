' ─────────────────────────────────────────────────────────────────────────────
' Monitor de Recursos — Launcher
' Inicia o servidor em background e abre o dashboard no navegador padrão.
' ─────────────────────────────────────────────────────────────────────────────

Dim WshShell, installDir, exePath

Set WshShell = CreateObject("WScript.Shell")

' Resolve the directory where this script lives (the install folder)
installDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
exePath    = installDir & "monitor-recursos.exe"

' Start the server hidden (window style 0 = hidden, bWaitOnReturn = False)
WshShell.Run Chr(34) & exePath & Chr(34), 0, False

' Give the server 2.5 seconds to bind to port 3030
WScript.Sleep 2500

' Open the dashboard in the default browser
WshShell.Run "http://localhost:3030", 1, False

Set WshShell = Nothing
