' ─────────────────────────────────────────────────────────────────────────────
' Monitor de Recursos — Launcher v2
' Inicia o servidor e aguarda ele estar pronto antes de abrir o browser.
' Usa polling em /api/health para garantir que o servidor esteja up.
' ─────────────────────────────────────────────────────────────────────────────

Dim WshShell, http, installDir, exePath, ready, i

Set WshShell = CreateObject("WScript.Shell")
Set http     = CreateObject("WinHttp.WinHttpRequest.5.1")

' Resolve install dir from this script's location
installDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
exePath    = installDir & "monitor-recursos.exe"

' ── Start the server exe in the background (hidden window) ───────────────────
WshShell.Run Chr(34) & exePath & Chr(34), 0, False

' ── Poll /api/health until the server responds (max 30 seconds) ──────────────
ready = False
For i = 1 To 60        ' 60 × 500ms = 30s
    WScript.Sleep 500
    On Error Resume Next
    http.Open "GET", "http://localhost:3030/api/health", False
    http.SetTimeouts 400, 400, 400, 400
    http.Send
    If Err.Number = 0 Then
        If http.Status = 200 Then
            ready = True
            Exit For
        End If
    End If
    On Error GoTo 0
Next

' ── Open the dashboard ────────────────────────────────────────────────────────
WshShell.Run "http://localhost:3030", 1, False

' ── Warn if server never responded ───────────────────────────────────────────
If Not ready Then
    WshShell.Popup "O servidor demorou mais do que o esperado para iniciar." & _
                   Chr(13) & "Verifique se a porta 3030 esta disponivel.", _
                   0, "Monitor de Recursos", 48
End If

Set http     = Nothing
Set WshShell = Nothing
