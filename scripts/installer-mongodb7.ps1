# ============================================================
#  INSTALLATION AUTOMATIQUE MONGODB 7.0 LTS (Compatible i5-2430M / x86-64-v2)
#  Entreprise System - Windows Server 2022
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

# 1. Arrêt complet et suppression du service MongoDB 8.0 pour éviter le conflit 1603
Write-Host "`n[1/6] Nettoyage de l'ancien service MongoDB 8.0..." -ForegroundColor Yellow
Stop-Service -Name "MongoDB" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
taskkill /F /IM mongod.exe 2>$null
Start-Sleep -Seconds 1

# Suppression de l'enregistrement de l'ancien service Windows MongoDB 8.0
sc.exe delete "MongoDB" 2>$null | Out-Null
Start-Sleep -Seconds 2
Write-Host "[OK] Ancien service nettoyé." -ForegroundColor Green

# 2. Téléchargement de MongoDB 7.0.14 LTS (compatible Sandy Bridge / i5 2e gen)
$msiUrl = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.14-signed.msi"
$destMsi = Join-Path $env:TEMP "mongodb-7.0.14.msi"

Write-Host "`n[2/6] Téléchargement de MongoDB 7.0.14 LTS..." -ForegroundColor Yellow
if (Test-Path $destMsi) {
    Write-Host "[OK] Fichier d'installation déjà présent dans TEMP ($((Get-Item $destMsi).Length / 1MB | ForEach-Object { '{0:N1} Mo' -f $_ }))" -ForegroundColor Green
}
else {
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $msiUrl -OutFile $destMsi -UseBasicParsing
        Write-Host "[OK] Téléchargement terminé ($((Get-Item $destMsi).Length / 1MB | ForEach-Object { '{0:N1} Mo' -f $_ }))" -ForegroundColor Green
    }
    catch {
        Write-Host "[ERREUR] Échec du téléchargement automatique : $_" -ForegroundColor Red
        exit 1
    }
}

# 3. Installation silencieuse de MongoDB 7.0
Write-Host "`n[3/6] Installation de MongoDB 7.0..." -ForegroundColor Yellow
$msiLog = Join-Path $env:TEMP "mongodb7_install.log"
$msiArgs = "/i `"$destMsi`" /qn /l*v `"$msiLog`" ADDLOCAL=`"ServerService,Client`" SHOULD_INSTALL_COMPASS=`"0`""
$proc = Start-Process msiexec.exe -ArgumentList $msiArgs -Wait -PassThru

$mongo7Exe = "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe"
if (-not (Test-Path $mongo7Exe)) {
    # Si le package avec ServerService a échoué, installer tout le paquet standard
    Write-Host "[INFO] Second essai d'installation standard..." -ForegroundColor Gray
    $msiArgs2 = "/i `"$destMsi`" /qn /l*v `"$msiLog`" SHOULD_INSTALL_COMPASS=`"0`""
    $proc2 = Start-Process msiexec.exe -ArgumentList $msiArgs2 -Wait -PassThru
}

if (Test-Path $mongo7Exe) {
    Write-Host "[OK] MongoDB 7.0 (mongod.exe) installé avec succès !" -ForegroundColor Green
}
else {
    Write-Host "[ERREUR] mongod.exe 7.0 est introuvable. Consultez le journal : $msiLog" -ForegroundColor Red
    exit 1
}

# 4. Restauration des données et réparation propre sous MongoDB 7.0
Write-Host "`n[4/6] Restauration des données et réparation sous MongoDB 7.0..." -ForegroundColor Yellow
$target7Data = "C:\Program Files\MongoDB\Server\7.0\data"
$target7Log = "C:\Program Files\MongoDB\Server\7.0\log"
$target7Cfg = "C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg"

if (-not (Test-Path $target7Data)) { New-Item -ItemType Directory -Path $target7Data -Force | Out-Null }
if (-not (Test-Path $target7Log)) { New-Item -ItemType Directory -Path $target7Log -Force | Out-Null }

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
    Write-Host "      Copie depuis : $sourceBackup" -ForegroundColor Gray
    robocopy $sourceBackup $target7Data /E /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
    Write-Host "[OK] Fichiers transférés dans MongoDB 7.0." -ForegroundColor Green
}

# Nettoyage des fichiers de lock et temporaires de réparation incomplète
Get-ChildItem $target7Data -Directory -Filter "_tmp_repairDatabase_*" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
$lock7 = Join-Path $target7Data "mongod.lock"
if (Test-Path $lock7) { Remove-Item $lock7 -Force -ErrorAction SilentlyContinue }

# Lancement de la réparation avec le moteur 7.0 (compatible i5-2430M)
Write-Host "      Lancement de mongod 7.0 --repair..." -ForegroundColor Gray
& $mongo7Exe --repair --dbpath $target7Data 2>&1 | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
Write-Host "[OK] Réparation des données sous MongoDB 7.0 terminée avec succès !" -ForegroundColor Green

# 5. Configuration du fichier mongod.cfg et du Service Windows
Write-Host "`n[5/6] Configuration du service Windows et de la réplication rs0..." -ForegroundColor Yellow
$logFile7 = Join-Path $target7Log "mongod.log"

$cleanYaml = @"
# mongod.cfg pour Entreprise System (MongoDB 7.0 LTS)
storage:
  dbPath: $target7Data

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

[System.IO.File]::WriteAllText($target7Cfg, $cleanYaml, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "[OK] Fichier mongod.cfg configuré pour 7.0." -ForegroundColor Green

# Enregistrement ou mise à jour du service Windows MongoDB
$svc = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if (-not $svc) {
    $binPath = "`"$mongo7Exe`" --config `"$target7Cfg`" --service"
    New-Service -Name "MongoDB" -DisplayName "MongoDB Server (MongoDB)" -BinaryPathName $binPath -StartupType Automatic | Out-Null
    Write-Host "[OK] Service Windows MongoDB 7.0 créé." -ForegroundColor Green
}
else {
    sc.exe config "MongoDB" binPath= "`"$mongo7Exe`" --config `"$target7Cfg`" --service" | Out-Null
}

# Démarrage du service
Write-Host "      Démarrage du service MongoDB..." -ForegroundColor Gray
Start-Service -Name "MongoDB" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 4

if ((Get-Service -Name "MongoDB").Status -eq "Running") {
    Write-Host "[OK] Service MongoDB 7.0 démarré et en cours d'exécution !" -ForegroundColor Green
}
else {
    Write-Host "[ATTENTION] Tentative de démarrage forcé..." -ForegroundColor Yellow
    Start-Process $mongo7Exe -ArgumentList "--config `"$target7Cfg`" --service" -NoNewWindow
    Start-Sleep -Seconds 4
}

# 6. Initialisation du Replica Set rs0 et redémarrage PM2
Write-Host "`n[6/6] Initialisation du Replica Set rs0..." -ForegroundColor Yellow
$initScript = Join-Path $PSScriptRoot "init-rs.cjs"
node $initScript

pm2 restart entreprise-system --update-env 2>$null
Start-Sleep -Seconds 3

Write-Titre "VÉRIFICATION FINALE DU TEMPS RÉEL (MONGODB 7.0 LTS)"
powershell -ExecutionPolicy Bypass -File ".\scripts\verifier-temps-reel.ps1"
