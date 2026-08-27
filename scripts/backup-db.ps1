# Script de sauvegarde automatique de la base PostgreSQL locale
# Entreprise System - Windows Server 2022
# Exécute un pg_dump avec rétention automatique de 14 jours

$ErrorActionPreference = "Continue"

$BackupDir = "C:\Backups\PostgreSQL"
$DateStr = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupFile = "$BackupDir\entreprise_db_$DateStr.sql"
$LogFile = "$BackupDir\backup_history.log"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$pgDumpPath = "C:\PostgreSQL\bin\pg_dump.exe"

if (-not (Test-Path $pgDumpPath)) {
    $cmd = Get-Command pg_dump -ErrorAction SilentlyContinue
    if ($cmd) { $pgDumpPath = $cmd.Source }
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

if (-not (Test-Path $pgDumpPath)) {
    $msg = "[$timestamp] [ERREUR] pg_dump.exe introuvable sur le serveur !"
    Write-Host $msg -ForegroundColor Red
    Add-Content -Path $LogFile -Value $msg
    exit 1
}

Write-Host "[$timestamp] [INFO] Lancement de la sauvegarde PostgreSQL vers $BackupFile..." -ForegroundColor Cyan

# Exécution de pg_dump
& "$pgDumpPath" -h 127.0.0.1 -p 5432 -U postgres -d entreprise_db -F c -f "$BackupFile"

if ($LASTEXITCODE -eq 0 -and (Test-Path $BackupFile) -and ((Get-Item $BackupFile).Length -gt 0)) {
    $sizeKb = [math]::Round(((Get-Item $BackupFile).Length / 1KB), 2)
    $msg = "[$timestamp] [SUCCES] Sauvegarde PostgreSQL reussie ($sizeKb Ko) -> $BackupFile"
    Write-Host $msg -ForegroundColor Green
    Add-Content -Path $LogFile -Value $msg

    # Nettoyage automatique des sauvegardes de plus de 14 jours
    $oldFiles = Get-ChildItem -Path $BackupDir -Filter "entreprise_db_*.sql" | Where-Object {
        $_.CreationTime -lt (Get-Date).AddDays(-14)
    }
    foreach ($old in $oldFiles) {
        Remove-Item $old.FullName -Force -ErrorAction SilentlyContinue
        Add-Content -Path $LogFile -Value "[$timestamp] [CLEANUP] Suppression de l'ancienne sauvegarde : $($old.Name)"
    }
    exit 0
} else {
    $msg = "[$timestamp] [ERREUR] Echec du backup PostgreSQL (Code: $LASTEXITCODE) !"
    Write-Host $msg -ForegroundColor Red
    Add-Content -Path $LogFile -Value $msg
    exit 1
}
