# Script de configuration automatique du Replica Set MongoDB sur Windows Server
# Executez ce script dans PowerShell en tant qu'Administrateur

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [*] Configuration du Replica Set MongoDB (rs0) en Local   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Recherche du fichier de configuration mongod.cfg
$configPaths = @(
    "C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg",
    "C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg",
    "C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg",
    "C:\Program Files\MongoDB\Server\6.0\bin\mongod.cfg"
)

$targetConfig = $null
foreach ($path in $configPaths) {
    if (Test-Path $path) {
        $targetConfig = $path
        break
    }
}

if (-not $targetConfig) {
    $found = Get-ChildItem "C:\Program Files\MongoDB\Server" -Filter "mongod.cfg" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $targetConfig = $found.FullName }
}

if (-not $targetConfig) {
    Write-Host "[ERREUR] Fichier mongod.cfg introuvable dans C:\Program Files\MongoDB\Server." -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Fichier de configuration trouve : $targetConfig" -ForegroundColor Gray

# 2. Verification et modification du fichier mongod.cfg
$content = Get-Content $targetConfig -Raw

if ($content -match "replSetName:\s*rs0") {
    Write-Host "[OK] Le Replica Set 'rs0' est deja configure dans mongod.cfg." -ForegroundColor Green
}
else {
    Write-Host "[INFO] Activation de la replication (rs0) dans $targetConfig..." -ForegroundColor Yellow

    # Remplacement de la ligne #replication: si presente, ou ajout en fin de fichier
    if ($content -match "(?m)^#?\s*replication\s*:") {
        $newContent = $content -replace "(?m)^#?\s*replication\s*:.*", "`r`nreplication:`r`n  replSetName: rs0"
    }
    else {
        $newContent = $content + "`r`n`r`nreplication:`r`n  replSetName: rs0`r`n"
    }

    # Sauvegarde du fichier
    Set-Content -Path $targetConfig -Value $newContent -Force
    Write-Host "[OK] Fichier mongod.cfg mis a jour avec replSetName: rs0" -ForegroundColor Green
}

# 3. Redemarrage du service Windows MongoDB
Write-Host "`n[INFO] Redemarrage du service Windows 'MongoDB'..." -ForegroundColor Yellow
try {
    Restart-Service -Name "MongoDB" -Force
    Start-Sleep -Seconds 3
    Write-Host "[OK] Service MongoDB redemarre avec succes." -ForegroundColor Green
}
catch {
    Write-Host "[ERREUR] Impossible de redemarrer le service MongoDB : $_" -ForegroundColor Red
    Write-Host "[CONSEIL] Assurez-vous d'avoir lance PowerShell en tant qu'Administrateur." -ForegroundColor Yellow
    exit 1
}

# 4. Initialisation du Replica Set avec Node.js
Write-Host "`n[INFO] Initialisation du Replica Set (rs.initiate)..." -ForegroundColor Yellow
$projectRoot = Split-Path -Parent $PSScriptRoot
$initScript = Join-Path $PSScriptRoot "init-rs.cjs"

Set-Location -Path $projectRoot
node $initScript

Write-Host "`n[SUCCES] Configuration de MongoDB Local terminee avec succes !" -ForegroundColor Green

