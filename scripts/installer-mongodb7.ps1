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

# 1. Arrêt de l'ancien service MongoDB 8.0
Write-Host "`n[1/5] Arrêt de l'ancien service MongoDB 8.0..." -ForegroundColor Yellow
Stop-Service -Name "MongoDB" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
taskkill /F /IM mongod.exe 2>$null

# 2. Téléchargement de MongoDB 7.0.14 LTS (compatible Sandy Bridge / i5 2e gen)
$msiUrl = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.14-signed.msi"
$destMsi = Join-Path $env:TEMP "mongodb-7.0.14.msi"

Write-Host "`n[2/5] Téléchargement de MongoDB 7.0.14 LTS..." -ForegroundColor Yellow
Write-Host "      URL : $msiUrl" -ForegroundColor Gray
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $msiUrl -OutFile $destMsi -UseBasicParsing
    Write-Host "[OK] Téléchargement terminé ($((Get-Item $destMsi).Length / 1MB | ForEach-Object { '{0:N1} Mo' -f $_ }))" -ForegroundColor Green
}
catch {
    Write-Host "[ERREUR] Échec du téléchargement automatique : $_" -ForegroundColor Red
    Write-Host "[SOLUTION] Téléchargez manuellement MongoDB 7.0 MSI sur : https://www.mongodb.com/try/download/community" -ForegroundColor Yellow
    exit 1
}

# 3. Installation silencieuse de MongoDB 7.0
Write-Host "`n[3/5] Installation de MongoDB 7.0 en tant que service Windows..." -ForegroundColor Yellow
$msiArgs = "/i `"$destMsi`" /qn ADDLOCAL=`"ServerService,Client`" SHOULD_INSTALL_COMPASS=`"0`""
$proc = Start-Process msiexec.exe -ArgumentList $msiArgs -Wait -PassThru

if ($proc.ExitCode -eq 0 -or $proc.ExitCode -eq 3010) {
    Write-Host "[OK] MongoDB 7.0 installé avec succès !" -ForegroundColor Green
}
else {
    Write-Host "[ATTENTION] Code d'installation : $($proc.ExitCode)" -ForegroundColor Yellow
}

# 4. Transfert des données sauvegardées
Write-Host "`n[4/5] Restauration des données dans MongoDB 7.0..." -ForegroundColor Yellow
$target7Data = "C:\Program Files\MongoDB\Server\7.0\data"
if (-not (Test-Path $target7Data)) {
    New-Item -ItemType Directory -Path $target7Data -Force | Out-Null
}

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
    Write-Host "      Source des données : $sourceBackup" -ForegroundColor Gray
    Write-Host "      Destination        : $target7Data" -ForegroundColor Gray
    Stop-Service -Name "MongoDB" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    robocopy $sourceBackup $target7Data /E /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
    Write-Host "[OK] Données restaurées dans le dossier MongoDB 7.0." -ForegroundColor Green
}
else {
    Write-Host "[INFO] Aucune sauvegarde trouvée, dossier de données initialisé." -ForegroundColor Gray
}

# 5. Configuration du Replica Set et validation
Write-Host "`n[5/5] Configuration du Replica Set rs0 et redémarrage..." -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File ".\scripts\setup-mongodb-replicaset.ps1"

pm2 restart entreprise-system --update-env 2>$null

Write-Titre "VÉRIFICATION FINALE DU TEMPS RÉEL"
powershell -ExecutionPolicy Bypass -File ".\scripts\verifier-temps-reel.ps1"
