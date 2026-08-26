# ============================================================
#  INSTALLATION AUTOMATIQUE MONGODB 7.0 LTS (Compatible i5-2430M / x86-64-v2)
#  Entreprise System - Windows Server 2022 (Déploiement direct sans conflit MSI)
#
#  Usage (PowerShell en Administrateur) :
#    powershell -ExecutionPolicy Bypass -File .\scripts\installer-mongodb7.ps1
# ============================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "SilentlyContinue"

function Write-Titre($txt) {
    Write-Host "`n==========================================================" -ForegroundColor Cyan
    Write-Host " $txt" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan
}

Write-Titre "INSTALLATION DE MONGODB 7.0 LTS (COMPATIBLE AVEC CE PROCESSEUR)"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERREUR] Ce script doit être exécuté dans un PowerShell EN ADMINISTRATEUR." -ForegroundColor Red
    exit 1
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# 1. Arrêt complet et suppression de l'ancien service MongoDB
Write-Host "`n[1/6] Nettoyage de l'ancien service MongoDB..." -ForegroundColor Yellow
Stop-Service -Name "MongoDB" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
taskkill /F /IM mongod.exe 2>$null
sc.exe delete "MongoDB" 2>$null | Out-Null
Start-Sleep -Seconds 2
Write-Host "[OK] Ancien service nettoyé." -ForegroundColor Green

# 2. Téléchargement de l'archive officielle MongoDB 7.0.14 LTS (ZIP autonome sans conflit d'installateur)
$zipUrl = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.14.zip"
$destZip = Join-Path $env:TEMP "mongodb-7.0.14.zip"
$extractTemp = Join-Path $env:TEMP "mongodb7_extracted"

Write-Host "`n[2/6] Téléchargement de l'archive MongoDB 7.0.14 LTS..." -ForegroundColor Yellow
if (-not (Test-Path $destZip) -or (Get-Item $destZip).Length -lt 100MB) {
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Write-Host "      Téléchargement depuis : $zipUrl ..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $zipUrl -OutFile $destZip -UseBasicParsing
        Write-Host "[OK] Téléchargement terminé ($((Get-Item $destZip).Length / 1MB | ForEach-Object { '{0:N1} Mo' -f $_ }))" -ForegroundColor Green
    }
    catch {
        Write-Host "[ERREUR] Échec du téléchargement : $_" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "[OK] Archive 7.0 déjà présente en cache ($((Get-Item $destZip).Length / 1MB | ForEach-Object { '{0:N1} Mo' -f $_ }))." -ForegroundColor Green
}

# 3. Extraction des exécutables 7.0 dans C:\Program Files\MongoDB\Server\7.0\bin
Write-Host "`n[3/6] Déploiement des fichiers exécutables MongoDB 7.0..." -ForegroundColor Yellow
$mongo7Dir = "C:\Program Files\MongoDB\Server\7.0"
$mongo7Bin = Join-Path $mongo7Dir "bin"
$mongo7Data = Join-Path $mongo7Dir "data"
$mongo7Log = Join-Path $mongo7Dir "log"
$mongo7Cfg = Join-Path $mongo7Bin "mongod.cfg"
$mongo7Exe = Join-Path $mongo7Bin "mongod.exe"

if (-not (Test-Path $mongo7Bin)) { New-Item -ItemType Directory -Path $mongo7Bin -Force | Out-Null }
if (-not (Test-Path $mongo7Data)) { New-Item -ItemType Directory -Path $mongo7Data -Force | Out-Null }
if (-not (Test-Path $mongo7Log)) { New-Item -ItemType Directory -Path $mongo7Log -Force | Out-Null }

if (Test-Path $extractTemp) { Remove-Item $extractTemp -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $extractTemp -Force | Out-Null

Write-Host "      Extraction de l'archive..." -ForegroundColor Gray
Expand-Archive -Path $destZip -DestinationPath $extractTemp -Force

# Recherche du dossier bin extrait
$foundBin = Get-ChildItem $extractTemp -Directory -Filter "bin" -Recurse | Select-Object -First 1
if ($foundBin) {
    Copy-Item "$($foundBin.FullName)\*" $mongo7Bin -Recurse -Force
}
else {
    $subDir = Get-ChildItem $extractTemp -Directory | Select-Object -First 1
    if ($subDir -and (Test-Path (Join-Path $subDir.FullName "bin"))) {
        Copy-Item (Join-Path $subDir.FullName "bin\*") $mongo7Bin -Recurse -Force
    }
}

Remove-Item $extractTemp -Recurse -Force -ErrorAction SilentlyContinue

if (Test-Path $mongo7Exe) {
    Write-Host "[OK] mongod.exe 7.0 déployé avec succès dans $mongo7Bin" -ForegroundColor Green
}
else {
    Write-Host "[ERREUR] Échec de l'extraction de mongod.exe." -ForegroundColor Red
    exit 1
}

# 4. Restauration des données et réparation automatique sous MongoDB 7.0
Write-Host "`n[4/6] Restauration des données et réparation sous MongoDB 7.0..." -ForegroundColor Yellow

# Trouver la dernière sauvegarde de données
$backupDirs = Get-ChildItem "C:\Program Files\MongoDB\Server\8.0" -Directory -Filter "data_backup_*" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
$sourceBackup = $null

if ($backupDirs -and $backupDirs.Count -gt 0) {
    $sourceBackup = $backupDirs[0].FullName
}
elseif (Test-Path "C:\Program Files\MongoDB\Server\8.0\data") {
    $sourceBackup = "C:\Program Files\MongoDB\Server\8.0\data"
}

if ($sourceBackup) {
    Write-Host "      Copie des données depuis : $sourceBackup" -ForegroundColor Gray
    robocopy $sourceBackup $mongo7Data /E /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
    Write-Host "[OK] Fichiers transférés dans $mongo7Data." -ForegroundColor Green
}

# Nettoyage des fichiers temporaires de crash
Get-ChildItem $mongo7Data -Directory -Filter "_tmp_repairDatabase_*" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
$lockFile = Join-Path $mongo7Data "mongod.lock"
if (Test-Path $lockFile) { Remove-Item $lockFile -Force -ErrorAction SilentlyContinue }

# Lancement de la réparation avec le moteur 7.0 (compatible i5-2430M)
Write-Host "      Exécution de mongod 7.0 --repair..." -ForegroundColor Gray
& $mongo7Exe --repair --dbpath $mongo7Data 2>&1 | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
Write-Host "[OK] Base de données réparée avec succès !" -ForegroundColor Green

# 5. Configuration du fichier mongod.cfg et Création du Service Windows
Write-Host "`n[5/6] Configuration du service Windows et de la réplication rs0..." -ForegroundColor Yellow
$logFile7 = Join-Path $mongo7Log "mongod.log"

$cleanYaml = @"
# mongod.cfg pour Entreprise System (MongoDB 7.0 LTS)
storage:
  dbPath: $mongo7Data

systemLog:
  destination: file
  logAppend: true
  path: $logFile7

net:
  port: 27017
  bindIp: 127.0.0.1

replication:
  replSetName: rs0
"@

[System.IO.File]::WriteAllText($mongo7Cfg, $cleanYaml, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "[OK] Fichier mongod.cfg créé pour 7.0." -ForegroundColor Green

# Création du service Windows MongoDB 7.0
$binPath = "`"$mongo7Exe`" --config `"$mongo7Cfg`" --service"
New-Service -Name "MongoDB" -DisplayName "MongoDB Server (MongoDB)" -BinaryPathName $binPath -StartupType Automatic | Out-Null
Write-Host "[OK] Service Windows MongoDB 7.0 configuré." -ForegroundColor Green

# Démarrage du service
Write-Host "      Démarrage du service MongoDB..." -ForegroundColor Gray
Start-Service -Name "MongoDB" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5

$svcStatus = (Get-Service -Name "MongoDB").Status
if ($svcStatus -eq "Running") {
    Write-Host "[OK] Service MongoDB 7.0 démarré et en cours d'exécution !" -ForegroundColor Green
}
else {
    Write-Host "[ATTENTION] Démarrage direct..." -ForegroundColor Yellow
    Start-Process $mongo7Exe -ArgumentList "--config `"$mongo7Cfg`" --service" -NoNewWindow
    Start-Sleep -Seconds 5
}

# 6. Initialisation du Replica Set rs0 et redémarrage PM2
Write-Host "`n[6/6] Initialisation du Replica Set rs0..." -ForegroundColor Yellow
$initScript = Join-Path $PSScriptRoot "init-rs.cjs"
node $initScript

pm2 restart entreprise-system --update-env 2>$null
Start-Sleep -Seconds 3

Write-Titre "VÉRIFICATION FINALE DU TEMPS RÉEL (MONGODB 7.0 LTS)"
powershell -ExecutionPolicy Bypass -File ".\scripts\verifier-temps-reel.ps1"
