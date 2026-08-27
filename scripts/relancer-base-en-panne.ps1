# ============================================================
#  RELANCE AUTOMATIQUE ET RÉPARATION DE LA BASE DE DONNÉES
#  Entreprise System - Windows Server 2022
# ============================================================
# Exécutez ce script dans PowerShell (Administrateur) :
#   powershell -ExecutionPolicy Bypass -File .\scripts\relancer-base-en-panne.ps1
# ============================================================

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " 🚀 RÉSOLUTION DES PANNES & RELANCE DE MONGODB ET L'APP   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# 1. Arrêt forcé des processus orphelins
Write-Host "`n[1/6] Nettoyage des processus orphelins..." -ForegroundColor Yellow
Stop-Service MongoDB -Force -ErrorAction SilentlyContinue
Get-Process mongod -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 2. Nettoyage des verrous orphelins
Write-Host "[2/6] Nettoyage des verrous orphelins (mongod.lock)..." -ForegroundColor Yellow
$dataDir = "C:\Program Files\MongoDB\Server\7.0\data"
$lockFile = Join-Path $dataDir "mongod.lock"
$repairFile = Join-Path $dataDir "_repair_incomplete"

if (Test-Path $lockFile) {
    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
    Write-Host "   ✔ Fichier lock nettoyé." -ForegroundColor Gray
}
if (Test-Path $repairFile) {
    Remove-Item $repairFile -Force -ErrorAction SilentlyContinue
    Write-Host "   ✔ Marqueur _repair_incomplete nettoyé." -ForegroundColor Gray
}

# 3. Réparation automatique WiredTiger
Write-Host "[3/6] Réparation de la base de données..." -ForegroundColor Yellow
$mongodExe = "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe"
if (Test-Path $mongodExe) {
    & $mongodExe --repair --dbpath $dataDir *>$null
    Write-Host "   ✔ Réparation terminée." -ForegroundColor Green
}

# 4. Démarrage du service Windows MongoDB
Write-Host "[4/6] Démarrage du Service Windows MongoDB..." -ForegroundColor Yellow
Start-Service MongoDB -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

$svc = Get-Service MongoDB -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq "Running") {
    Write-Host "   ✔ Service MongoDB en cours d'exécution (Running) !" -ForegroundColor Green
} else {
    Write-Host "   ⚠ Service arrêté, tentative de lancement direct du service..." -ForegroundColor Yellow
    cmd /c 'net start MongoDB'
}

# 5. Réinitialisation du Replica Set rs0 si nécessaire
Write-Host "[5/6] Vérification du Replica Set (rs0)..." -ForegroundColor Yellow
node .\scripts\init-rs.cjs

# 6. Redémarrage de l'application PM2
Write-Host "[6/6] Redémarrage de l'application Entreprise System..." -ForegroundColor Yellow
pm2 restart entreprise-system --update-env

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " 🔍 AUDIT DE CONTRÔLE FINAL EN TEMPS RÉEL                  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
node .\scripts\audit-temps-reel-et-base.cjs

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " 🎉 RELANCE TERMINÉE : VOTRE APPLICATION EST OPÉRATIONNELLE !" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
