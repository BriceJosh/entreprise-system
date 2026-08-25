# ============================================================
#  SAUVETAGE ET RESTAURATION COMPLÈTE DE LA BASE CORROMPUE
#  Entreprise System - Windows Server
# ============================================================

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " 🚀 SAUVETAGE AUTOMATIQUE DES DONNÉES LOCALES CORROMPUES   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$sourceData = "C:\data_sauvegarde_secours"
if (-not (Test-Path $sourceData)) {
    Write-Host "[ERREUR] Le dossier $sourceData est introuvable !" -ForegroundColor Red
    exit 1
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# 1. Extraction BSON directe des fichiers .wt
Write-Host "`n[1/4] Extraction directe des documents BSON depuis les fichiers .wt..." -ForegroundColor Yellow
node .\scripts\recuperer-donnees-corrompues.cjs $sourceData

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERREUR] L'extraction des donnees a echoue." -ForegroundColor Red
    exit 1
}

# 2. Arret propre et remise a neuf du dossier data
Write-Host "`n[2/4] Remise a neuf du service MongoDB..." -ForegroundColor Yellow
Stop-Service MongoDB -Force -ErrorAction SilentlyContinue
taskkill /F /IM mongod.exe -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Remove-Item "C:\Program Files\MongoDB\Server\8.0\data\*" -Recurse -Force -ErrorAction SilentlyContinue

# 3. Reinitialisation du Replica Set sain
Write-Host "`n[3/4] Reconfiguration d'un Replica Set MongoDB tout neuf..." -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File .\scripts\setup-mongodb-replicaset.ps1

# 4. Re-injection des donnees extraites
Write-Host "`n[4/4] Reinjection des donnees recuperees dans la base saine..." -ForegroundColor Yellow
node .\scripts\restaurer-donnees-json.cjs

# 5. Redemarrage de l'application PM2
Write-Host "`n[OK] Redemarrage de l'application..." -ForegroundColor Yellow
pm2 restart entreprise-system --update-env

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " 🎉 SUCCÈS : TOUTES VOS DONNÉES LOCALES ONT ÉTÉ RESTAURÉES !" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
