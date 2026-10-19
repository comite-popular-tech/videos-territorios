# Impede o Windows de dormir enquanto o processo indicado estiver vivo (não muda nenhuma configuração de energia).
param([int]$Pid)
Add-Type -Name P -Namespace W -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
while (Get-Process -Id $Pid -ErrorAction SilentlyContinue) { [W.P]::SetThreadExecutionState(0x80000001) | Out-Null; Start-Sleep 50 }
[W.P]::SetThreadExecutionState(0x80000000) | Out-Null
