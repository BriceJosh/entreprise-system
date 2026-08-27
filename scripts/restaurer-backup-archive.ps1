# Script de restauration rapide depuis une archive .gz
# Entreprise System - Windows Server 2022
param (
    [string]$FichierArchive = ""
)

$BackupDir = "C:\Backups\MongoDB"

if (-not $FichierArchive) {
    $latest = Get-ChildItem -Path $BackupDir -Filter "entreprise_db_*.gz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latest) {
        $FichierArchive = $latest.FullName
    }
}

if (-not (Test-Path $FichierArchive)) {
    Write-Host "[ERREUR] Fichier d'archive introuvable : $FichierArchive" -ForegroundColor Red
    exit 1
}

$mongorestorePath = "C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe"
if (-not (Test-Path $mongorestorePath)) {
    $cmd = Get-Command mongorestore -ErrorAction SilentlyContinue
    if ($cmd) { $mongorestorePath = $cmd.Source }
}

Write-Host "`n[INFO] Restauration depuis l'archive : $FichierArchive..." -ForegroundColor Cyan

$uri = "mongodb://127.0.0.1:27017/entreprise_db?replicaSet=rs0&directConnection=true"

& "$mongorestorePath" --uri="$uri" --archive="$FichierArchive" --gzip --drop

if ($LASTEXITCODE -eq 0) {
    Write-Host "[SUCCES] La base a ete restauree avec succes !" -ForegroundColor Green
} else {
    Write-Host "[ERREUR] Echec de la restauration (Code: $LASTEXITCODE)." -ForegroundColor Red
}
