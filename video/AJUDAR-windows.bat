@echo off
rem Dois cliques aqui para ajudar a produzir os videos da campanha (Windows). Para parar, feche esta janela.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ajudar.ps1 %*
echo.
pause
