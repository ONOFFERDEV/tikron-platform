@echo off
rem Detached launcher for the "assets" parallel astra stream (dev port 8797).
cd /d D:\wt-ironsight-assets\apps\ironsight
node tools\aaa-loop.mjs --stream assets --app D:\wt-ironsight-assets\apps\ironsight --branch ironsight-aaa-assets --plan AAA-PLAN-ASSETS.md --port 8797 --no-deploy %* >> .inspect\aaa-loop-assets\stdout.log 2>&1
