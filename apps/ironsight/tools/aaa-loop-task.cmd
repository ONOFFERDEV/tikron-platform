@echo off
rem Detached launcher for the astra loop (run via a Windows scheduled task so it survives
rem the supervisor's own shell/session restarts). Usage: aaa-loop-task.cmd [extra args]
cd /d D:\webgame-baas\apps\ironsight
node tools\aaa-loop.mjs %* >> .inspect\aaa-loop\stdout-task.log 2>&1
