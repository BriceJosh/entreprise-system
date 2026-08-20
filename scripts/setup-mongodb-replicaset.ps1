# Script de configuration automatique du Replica Set MongoDB sur Windows Server
# Executez ce script dans PowerShell en tant qu'Administrateur

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [*] Configuration du Replica Set MongoDB (rs0) en Local   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Recherche du fichier de configuration mongod.cfg
$found = Get-ChildItem "C:\Program Files\MongoDB\Server" -Filter "mongod.cfg" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $found) {
    Write-Host "[ERREUR] Fichier mongod.cfg introuvable dans C:\Program Files\MongoDB\Server." -ForegroundColor Red
    exit 1
}

$targetConfig = $found.FullName
$mongoBinDir = Split-Path -Parent $targetConfig
$mongoServerDir = Split-Path -Parent $mongoBinDir
$dataDir = Join-Path $mongoServerDir "data"
$logDir = Join-Path $mongoServerDir "log"
$logFile = Join-Path $logDir "mongod.log"

Write-Host "[INFO] Fichier de configuration trouve : $targetConfig" -ForegroundColor Gray

# 2. Reecriture propre du fichier mongod.cfg avec la replication
$cleanYaml = @"
# mongod.cfg generated for Entreprise System
storage:
  dbPath: "$dataDir"

systemLog:
  destination: file
  logAppend: true
  path: "$logFile"

net:
  port: 27017
  bindIp: 127.0.0.1

replication:
  replSetName: "rs0"
"@

# Ecriture en encodage UTF8 propre
[System.IO.File]::WriteAllText($targetConfig, $cleanYaml, [System.Text.Encoding]::UTF8)
Write-Host "[OK] Fichier mongod.cfg configure avec replSetName: rs0" -ForegroundColor Green

# 3. Redemarrage du service Windows MongoDB
Write-Host "`n[INFO] Redemarrage du service Windows 'MongoDB'..." -ForegroundColor Yellow
try {
    Restart-Service -Name "MongoDB" -Force -ErrorAction Stop
    Start-Sleep -Seconds 4
    Write-Host "[OK] Service MongoDB demarre avec succes !" -ForegroundColor Green
}
catch {
    Write-Host "[ERREUR] Le service MongoDB n'a pas pu demarrer : $_" -ForegroundColor Red
    if (Test-Path $logFile) {
        Write-Host "`n[DIAGNOSTIC] Dernieres lignes de mongod.log :" -ForegroundColor Yellow
        Get-Content $logFile -Tail 15 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    }
    exit 1
}

# 4. Initialisation du Replica Set avec Node.js
Write-Host "`n[INFO] Initialisation du Replica Set (rs.initiate)..." -ForegroundColor Yellow
$projectRoot = Split-Path -Parent $PSScriptRoot
$initScript = Join-Path $PSScriptRoot "init-rs.cjs"

Set-Location -Path $projectRoot
node $initScript

Write-Host "`n[SUCCES] Configuration de MongoDB Local terminee avec succes !" -ForegroundColor Green

