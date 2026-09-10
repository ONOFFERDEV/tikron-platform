@echo off
rem Detached launcher for the "combat" parallel astra stream (dev port 8798).
cd /d D:\wt-ironsight-combat\apps\ironsight
node tools\aaa-loop.mjs --stream combat --app D:\wt-ironsight-combat\apps\ironsight --branch ironsight-aaa-combat --plan AAA-PLAN-COMBAT.md --port 8798 --no-deploy %* >> .inspect\aaa-loop-combat\stdout.log 2>&1
