@echo off
title Apolline - Plateforme de courtage
cd /d "%~dp0"
echo.
echo  ========================================
echo   Apolline - Groupe de courtage
echo  ========================================
echo.
echo  Demarrage du serveur de developpement...
echo  Ouverture automatique de http://localhost:5173
echo.
echo  (Fermez cette fenetre pour arreter)
echo.
call npm run dev
pause
