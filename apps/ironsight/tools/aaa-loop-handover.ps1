# Waits for a running aaa-loop process to exit (after it honours the STOP file), then
# starts a fresh loop with a deadline. Run detached:
#   Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','tools/aaa-loop-handover.ps1','<oldPid>','2026-09-09T10:00:00+09:00' -WorkingDirectory <app> -WindowStyle Hidden
param([int]$OldPid, [string]$Until)
$app = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $app
$state = Join-Path $app '.inspect\aaa-loop'
$log = Join-Path $state 'handover.log'
"[$(Get-Date -Format o)] waiting for loop pid $OldPid to exit, then restarting until $Until" | Out-File -Append -Encoding utf8 $log
while (Get-Process -Id $OldPid -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 20 }
"[$(Get-Date -Format o)] old loop exited" | Out-File -Append -Encoding utf8 $log
Remove-Item (Join-Path $state 'STOP') -ErrorAction SilentlyContinue
$p = Start-Process -FilePath node -ArgumentList 'tools/aaa-loop.mjs','--until',$Until -WorkingDirectory $app -WindowStyle Hidden -RedirectStandardOutput (Join-Path $state 'stdout-until.log') -RedirectStandardError (Join-Path $state 'stderr-until.log') -PassThru
"[$(Get-Date -Format o)] new loop started pid $($p.Id) --until $Until" | Out-File -Append -Encoding utf8 $log
