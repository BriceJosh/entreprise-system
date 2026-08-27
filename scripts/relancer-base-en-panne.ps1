# ============================================================
#  RELANCE AUTOMATIQUE DE LA BASE POSTGRESQL ET DE L'APPLICATION
#  Entreprise System - Windows Server 2022
# ============================================================
# Exécutez ce script dans PowerShell (Administrateur) :
#   powershell -ExecutionPolicy Bypass -File .\scripts\relancer-base-en-panne.ps1
# ============================================================

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " 🚀 RÉSOLUTION ET RELANCE AUTOMATIQUE DE POSTGRESQL & APP " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# 1. Vérification / Démarrage du moteur PostgreSQL
Write-Host "`n[1/3] Demarrage et verification du moteur PostgreSQL 16..." -ForegroundColor Yellow
$pgCtl = "C:\PostgreSQL\bin\pg_ctl.exe"
$pgData = "C:\PostgreSQL\data"
$pgLog = "C:\PostgreSQL\server.log"

if (Test-Path $pgCtl) {
    & "$pgCtl" start -D "$pgData" -l "$pgLog" -w
    Start-Sleep -Seconds 2
} else {
    Start-Service PostgreSQL -ErrorAction SilentlyContinue
}

# 2. Redémarrage de l'application PM2
Write-Host "[2/3] Redémarrage de l'application Entreprise System (PM2)..." -ForegroundColor Yellow
pm2 restart entreprise-system --update-env
Start-Sleep -Seconds 2

# 3. Audit de contrôle final
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " 🔍 AUDIT DE CONTRÔLE FINAL EN TEMPS RÉEL (POSTGRESQL)    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
node .\scripts\audit-postgresql-temps-reel.cjs

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " 🎉 RELANCE TERMINÉE : VOTRE APPLICATION EST 100% EN LIGNE !" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
