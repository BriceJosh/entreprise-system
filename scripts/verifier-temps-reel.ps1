# ============================================================
#  VÉRIFICATION COMPLÈTE TEMPS RÉEL, CHANGE STREAMS & BASE
#  Entreprise System - Windows Server 2022 / Local / Tailscale
#
#  Usage :
#    powershell -ExecutionPolicy Bypass -File .\scripts\verifier-temps-reel.ps1
#    powershell -ExecutionPolicy Bypass -File .\scripts\verifier-temps-reel.ps1 -ReparerReplicaSet
#    powershell -ExecutionPolicy Bypass -File .\scripts\verifier-temps-reel.ps1 -Hote "100.x.y.z" (via Tailscale)
# ============================================================
param(
    [switch]$ReparerReplicaSet,
    [string]$Hote = "127.0.0.1",
    [int]$Port = 5000
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "SilentlyContinue"

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " VÉRIFICATION TEMPS RÉEL, CHANGE STREAMS & SOCKET.IO" -ForegroundColor Cyan
Write-Host " Entreprise System - $(Get-Date -Format 'dd/MM/yyyy HH:mm')" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# 1. Vérification Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "[ERREUR] Node.js n'est pas trouvé dans le PATH." -ForegroundColor Red
    exit 1
}

# 2. Si demandé, réparation automatique du Replica Set
if ($ReparerReplicaSet) {
    Write-Host "`n[*] Tentative de réparation/initialisation automatique du Replica Set rs0..." -ForegroundColor Yellow
    powershell -ExecutionPolicy Bypass -File ".\scripts\setup-mongodb-replicaset.ps1"
}

# 3. Lancement de l'audit complet Node.js
$mongoUri = "mongodb://$($Hote):27017/entreprise_db?replicaSet=rs0&directConnection=true"
$apiUrl = "http://$($Hote):$($Port)"

Write-Host "`n[*] Exécution des tests d'audit..." -ForegroundColor Gray
& node ".\scripts\audit-temps-reel-et-base.cjs" $mongoUri $apiUrl

$exitCode = $LASTEXITCODE

if ($exitCode -ne 0 -and -not $ReparerReplicaSet) {
    Write-Host "`n[ASTUCE] Si le Replica Set ou les Change Streams ont échoué," -ForegroundColor Yellow
    Write-Host "         lancez la commande suivante en tant qu'Administrateur :" -ForegroundColor Yellow
    Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\setup-mongodb-replicaset.ps1" -ForegroundColor White
}
