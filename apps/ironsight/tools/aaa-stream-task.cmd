@echo off
rem Detached launcher for a parallel astra stream. %1 = stream name, %2 = worktree root.
rem Usage: aaa-stream-task.cmd assets D:\wt-ironsight-assets --until 2026-09-11T10:00:00+09:00
setlocal
set STREAM=%1
set ROOT=%2
shift
shift
cd /d %ROOT%\apps\ironsight
node tools\aaa-loop.mjs --stream %STREAM% --app %ROOT%\apps\ironsight --branch ironsight-aaa-%STREAM% --plan AAA-PLAN-%STREAM%.md --port %PORT% --no-deploy %1 %2 %3 %4 %5 %6 >> .inspect\aaa-loop-%STREAM%\stdout.log 2>&1
