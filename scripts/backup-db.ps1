# Script de sauvegarde automatique de la base MongoDB locale
# Entreprise System - Windows Server 2022
# Exécute un mongodump compressé (.gz) avec rétention automatique

$ErrorActionPreference = "Continue"

$BackupDir = "C:\Backups\MongoDB"
$DateStr = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$ArchiveFile = "$BackupDir\entreprise_db_$DateStr.gz"
$LogFile = "$BackupDir\backup_history.log"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

# Recherche automatique de mongodump.exe
$mongodumpPath = $null
$candidatePaths = @(
    "C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe",
    "C:\Program Files\MongoDB\Server\8.0\bin\mongodump.exe",
    "C:\Program Files\MongoDB\Server\7.0\bin\mongodump.exe"
)

foreach ($path in $candidatePaths) {
    if (Test-Path $path) {
        $mongodumpPath = $path
        break
    }
}

if (-not $mongodumpPath) {
    $cmd = Get-Command mongodump -ErrorAction SilentlyContinue
    if ($cmd) { $mongodumpPath = $cmd.Source }
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

if (-not $mongodumpPath) {
    $msg = "[$timestamp] [ERREUR] mongodump.exe introuvable sur le serveur !"
    Write-Host $msg -ForegroundColor Red
    Add-Content -Path $LogFile -Value $msg
    exit 1
}

Write-Host "[$timestamp] [INFO] Lancement de la sauvegarde vers $ArchiveFile..." -ForegroundColor Cyan

$uri = "mongodb://127.0.0.1:27017/entreprise_db?replicaSet=rs0&directConnection=true"

# Sauvegarde sous forme d'archive compressée gzip
& "$mongodumpPath" --uri="$uri" --archive="$ArchiveFile" --gzip

if ($LASTEXITCODE -eq 0 -and (Test-Path $ArchiveFile) -and ((Get-Item $ArchiveFile).Length -gt 0)) {
    $sizeKb = [math]::Round(((Get-Item $ArchiveFile).Length / 1KB), 2)
    $msg = "[$timestamp] [SUCCES] Sauvegarde reussie ($sizeKb Ko) -> $ArchiveFile"
    Write-Host $msg -ForegroundColor Green
    Add-Content -Path $LogFile -Value $msg

    # Nettoyage automatique des sauvegardes de plus de 14 jours
    $oldFiles = Get-ChildItem -Path $BackupDir -Filter "entreprise_db_*.gz" | Where-Object {
        $_.CreationTime -lt (Get-Date).AddDays(-14)
    }
    foreach ($old in $oldFiles) {
        Remove-Item $old.FullName -Force -ErrorAction SilentlyContinue
        Add-Content -Path $LogFile -Value "[$timestamp] [CLEANUP] Suppression de l'ancienne sauvegarde : $($old.Name)"
    }
    exit 0
} else {
    $msg = "[$timestamp] [ERREUR] Echec du backup MongoDB (Code: $LASTEXITCODE) !"
    Write-Host $msg -ForegroundColor Red
    Add-Content -Path $LogFile -Value $msg
    exit 1
}
