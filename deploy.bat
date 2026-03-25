@echo off
title BeeEyesAI — Deploy
color 0A

echo.
echo  ==========================================
echo    BeeEyesAI — Deploy para DigitalOcean
echo  ==========================================
echo.

:: Push para o GitHub
echo [1/2] Enviando codigo para o GitHub...
cd /d "%~dp0"
git add -A
git commit -m "deploy: %date% %time%"
git push origin main

if %errorlevel% neq 0 (
    echo.
    echo  Nada novo para enviar ou erro no push.
)

:: Deploy no servidor
echo.
echo [2/2] Atualizando servidor...
ssh -i "%USERPROFILE%\.ssh\id_rsa" -o StrictHostKeyChecking=no root@146.190.72.195 "cd /opt/beeeyes && git pull && docker compose up -d --build && docker image prune -f"

echo.
echo  ==========================================
echo    Deploy concluido! App atualizado.
echo  ==========================================
echo.
pause
