' ─────────────────────────────────────────────────────────────────────────────
' Monitor de Recursos — Launcher v3
' 1. Inicia o servidor em background
' 2. Aguarda o servidor estar pronto (/api/health polling)
' 3. Abre no Microsoft Edge em modo --app (janela propria, sem barra de endereco)
' ─────────────────────────────────────────────────────────────────────────────

Dim WshShell, fso, http, installDir, exePath, edgePath, ready, i

Set WshShell = CreateObject("WScript.Shell")
Set fso      = CreateObject("Scripting.FileSystemObject")
Set http     = CreateObject("WinHttp.WinHttpRequest.5.1")

installDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
exePath    = installDir & "monitor-recursos.exe"

' ── Inicia o servidor em background (janela oculta) ──────────────────────────
WshShell.Run Chr(34) & exePath & Chr(34), 0, False

' ── Aguarda o servidor estar pronto (max 30 segundos) ────────────────────────
ready = False
For i = 1 To 60
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

' ── Localiza o Edge (pre-instalado no Windows 10/11) ─────────────────────────
Dim edgePaths(2)
edgePaths(0) = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
edgePaths(1) = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
edgePaths(2) = ""   ' fallback: tenta via PATH

edgePath = ""
Dim j
For j = 0 To 1
    If fso.FileExists(edgePaths(j)) Then
        edgePath = edgePaths(j)
        Exit For
    End If
Next

' ── Abre a janela ────────────────────────────────────────────────────────────
If edgePath <> "" Then
    ' Edge --app: janela propria, sem barra de endereco, abre em tela cheia
    WshShell.Run Chr(34) & edgePath & Chr(34) & _
        " --app=""http://localhost:3030""" & _
        " --start-fullscreen", 1, False
Else
    ' Fallback: abre no navegador padrao
    WshShell.Run "http://localhost:3030", 1, False
End If

If Not ready Then
    WshShell.Popup "O servidor demorou mais que o esperado." & Chr(13) & _
                   "Verifique se a porta 3030 esta disponivel.", _
                   0, "Monitor de Recursos", 48
End If

Set http     = Nothing
Set fso      = Nothing
Set WshShell = Nothing
