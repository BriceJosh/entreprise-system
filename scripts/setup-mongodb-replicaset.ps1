# Script de configuration automatique du Replica Set MongoDB sur Windows Server
# Executez ce script dans PowerShell en tant qu'Administrateur

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [*] Configuration du Replica Set MongoDB (rs0) en Local   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Recherche du fichier de configuration mongod.cfg (via le service Windows ou le disque)
$targetConfig = $null

$service = Get-CimInstance Win32_Service -Filter "Name='MongoDB'" -ErrorAction SilentlyContinue
if ($service -and $service.PathName -match '--config\s+"?([^"]+)"?') {
    $extracted = $Matches[1].Trim()
    if (Test-Path $extracted) {
        $targetConfig = $extracted
    }
}

if (-not $targetConfig) {
    $searchPaths = @(
        "C:\Program Files\MongoDB\Server",
        "C:\Programmes\MongoDB\Server",
        "C:\MongoDB"
    )
    foreach ($sp in $searchPaths) {
        if (Test-Path $sp) {
            $found = Get-ChildItem $sp -Filter "mongod.cfg" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) {
                $targetConfig = $found.FullName
                break
            }
        }
    }
}

if (-not $targetConfig) {
    Write-Host "[ERREUR] Fichier mongod.cfg introuvable sur ce serveur." -ForegroundColor Red
    exit 1
}

$mongoBinDir = Split-Path -Parent $targetConfig
$mongoServerDir = Split-Path -Parent $mongoBinDir
$dataDir = Join-Path $mongoServerDir "data"
$logDir = Join-Path $mongoServerDir "log"
$logFile = Join-Path $logDir "mongod.log"

# Assurer que les dossiers data et log existent
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

Write-Host "[INFO] Fichier de configuration trouve : $targetConfig" -ForegroundColor Gray
Write-Host "[INFO] Dossier des donnees : $dataDir" -ForegroundColor Gray

# 2. Reecriture propre du fichier mongod.cfg avec la replication
$cleanYaml = @"
# mongod.cfg pour Entreprise System
storage:
  dbPath: $dataDir

systemLog:
  destination: file
  logAppend: true
  path: $logFile

net:
  port: 27017
  bindIp: 127.0.0.1

replication:
  replSetName: rs0
"@

# Ecriture en encodage UTF8 sans BOM
[System.IO.File]::WriteAllText($targetConfig, $cleanYaml, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "[OK] Fichier mongod.cfg configure avec replSetName: rs0" -ForegroundColor Green

# Nettoyage de mongod.lock eventuel si orphelin
$lockFile = Join-Path $dataDir "mongod.lock"
if (Test-Path $lockFile) {
    try {
        $lockContent = Get-Content $lockFile -Raw
        if ([string]::IsNullOrWhiteSpace($lockContent) -or $lockContent.Trim() -eq "") {
            Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
        }
    } catch {}
}

# 3. Redemarrage du service Windows MongoDB
Write-Host "`n[INFO] Demarrage / Redemarrage du service Windows 'MongoDB'..." -ForegroundColor Yellow
try {
    # Arreter d'abord le service s'il tournait
    Stop-Service -Name "MongoDB" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    # Demarrer le service
    Start-Service -Name "MongoDB" -ErrorAction Stop
    Start-Sleep -Seconds 4
    Write-Host "[OK] Service MongoDB demarre avec succes !" -ForegroundColor Green
}
catch {
    Write-Host "[ERREUR] Le service MongoDB n'a pas pu demarrer : $_" -ForegroundColor Red
    if (Test-Path $logFile) {
        Write-Host "`n[DIAGNOSTIC] Messages d'erreur et causes dans mongod.log :" -ForegroundColor Yellow
        $errLines = Get-Content $logFile -Tail 150 -ErrorAction SilentlyContinue | Where-Object { $_ -match '"s":"(F|E|W)"' -and $_ -notmatch '"id":31445' } | Select-Object -Last 10
        if ($errLines) {
            $errLines | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
        } else {
            Get-Content $logFile -Tail 20 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
        }
    }
    Write-Host "`n[CONSEIL] Pour reparer les fichiers endommages de la base :" -ForegroundColor Yellow
    Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\reparer-mongodb.ps1 -Sauvegarde" -ForegroundColor White
    exit 1
}

# 4. Initialisation du Replica Set avec Node.js
Write-Host "`n[INFO] Initialisation du Replica Set (rs.initiate)..." -ForegroundColor Yellow
$projectRoot = Split-Path -Parent $PSScriptRoot
$initScript = Join-Path $PSScriptRoot "init-rs.cjs"

Set-Location -Path $projectRoot
node $initScript

Write-Host "`n[SUCCES] Configuration de MongoDB Local terminee avec succes !" -ForegroundColor Green

