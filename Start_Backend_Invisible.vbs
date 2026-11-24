' Starts the EDI backend (port 5001) with no window. Works from wherever the project folder is.
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
WshShell.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName) & "\node-backend"
WshShell.Run "cmd /c set PORT=5001&& node server.js", 0, False
