# Script de configuration automatique du Replica Set MongoDB sur Windows Server
# Exécutez ce script dans PowerShell en tant qu'Administrateur

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 🍃 Configuration du Replica Set MongoDB (rs0) en Local   " -ForegroundColor Cyan
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
    Write-Host "❌ Fichier mongod.cfg introuvable dans C:\Program Files\MongoDB\Server." -ForegroundColor Red
    exit 1
}

Write-Host "📄 Fichier de configuration trouvé : $targetConfig" -ForegroundColor Gray

# 2. Vérification et modification du fichier mongod.cfg
$content = Get-Content $targetConfig -Raw

if ($content -match "replSetName:\s*rs0") {
    Write-Host "✅ Le Replica Set 'rs0' est déjà configuré dans mongod.cfg." -ForegroundColor Green
}
else {
    Write-Host "⚙️ Activation de la réplication (rs0) dans $targetConfig..." -ForegroundColor Yellow
    
    # Remplacement de la ligne #replication: si présente, ou ajout en fin de fichier
    if ($content -match "(?m)^#?\s*replication\s*:") {
        $newContent = $content -replace "(?m)^#?\s*replication\s*:.*", "`r`nreplication:`r`n  replSetName: rs0"
    }
    else {
        $newContent = $content + "`r`n`r`nreplication:`r`n  replSetName: rs0`r`n"
    }
    
    # Sauvegarde du fichier
    Set-Content -Path $targetConfig -Value $newContent -Force
    Write-Host "✅ Fichier mongod.cfg mis à jour avec replSetName: rs0" -ForegroundColor Green
}

# 3. Redémarrage du service Windows MongoDB
Write-Host "`n🔄 Redémarrage du service Windows 'MongoDB'..." -ForegroundColor Yellow
try {
    Restart-Service -Name "MongoDB" -Force
    Start-Sleep -Seconds 3
    Write-Host "✅ Service MongoDB redémarré avec succès." -ForegroundColor Green
}
catch {
    Write-Host "❌ Erreur lors du redémarrage du service MongoDB : $_" -ForegroundColor Red
    Write-Host "👉 Assurez-vous d'avoir lancé PowerShell en tant qu'Administrateur." -ForegroundColor Yellow
    exit 1
}

# 4. Initialisation du Replica Set avec Node.js
Write-Host "`n📡 Initialisation du Replica Set (rs.initiate)..." -ForegroundColor Yellow
$projectRoot = Split-Path -Parent $PSScriptRoot
$initScript = Join-Path $PSScriptRoot "init-rs.cjs"

Set-Location -Path $projectRoot
node $initScript

Write-Host "`n🎉 Configuration de MongoDB Local terminée !" -ForegroundColor Green
