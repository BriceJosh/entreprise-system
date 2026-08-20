# Script d'installation initiale complete sur la machine Windows Server
# Executez ce script dans PowerShell en tant qu'Administrateur sur le serveur

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [*] Installation & Deploiement Complet - Windows Server  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verification de Node.js
Write-Host "`n[1/7] Verification de l'environnement Node.js..." -ForegroundColor Yellow
if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Host "[ERREUR] Node.js n'est pas installe sur ce serveur !" -ForegroundColor Red
    Write-Host "[CONSEIL] Veuillez installer Node.js LTS depuis https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
$nodeVer = node -v
Write-Host "[OK] Node.js detecte : $nodeVer" -ForegroundColor Green

# 2. Installation de PM2 globalement
Write-Host "`n[2/7] Configuration de PM2 pour Windows..." -ForegroundColor Yellow
npm install -g pm2 pm2-windows-startup
& "$env:APPDATA\npm\pm2-startup.cmd" install 2>$null

# 3. Installation des dependances et compilation du Frontend
Write-Host "`n[3/7] Installation des dependances Frontend & Compilation (Vite)..." -ForegroundColor Yellow
npm install
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERREUR] Echec du build Frontend." -ForegroundColor Red
    exit 1
}

# 4. Installation des dependances Backend
Write-Host "`n[4/7] Installation des dependances Backend..." -ForegroundColor Yellow
Set-Location -Path "Backend"
npm install
Set-Location -Path ".."
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERREUR] Echec de l'installation Backend." -ForegroundColor Red
    exit 1
}

# 5. Configuration du Replica Set MongoDB local (rs0)
Write-Host "`n[5/7] Configuration du Replica Set MongoDB Local (rs0)..." -ForegroundColor Yellow
& powershell -ExecutionPolicy Bypass -File ".\scripts\setup-mongodb-replicaset.ps1"

# 6. Demarrage de l'application avec PM2
Write-Host "`n[6/7] Demarrage de l'application avec PM2..." -ForegroundColor Yellow
pm2 delete entreprise-system 2>$null
pm2 start ecosystem.config.cjs
pm2 save

# 7. Regle Pare-feu Windows
Write-Host "`n[7/7] Configuration du Pare-feu Windows (Port 5000)..." -ForegroundColor Yellow
$firewallRule = Get-NetFirewallRule -DisplayName "Entreprise System Node.js" -ErrorAction SilentlyContinue
if (-not $firewallRule) {
    New-NetFirewallRule -DisplayName "Entreprise System Node.js" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow | Out-Null
    Write-Host "[OK] Port 5000 ouvert dans le pare-feu local." -ForegroundColor Green
}
else {
    Write-Host "[OK] Regle de pare-feu deja existante." -ForegroundColor Green
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "[SUCCES] INSTALLATION SUR LE SERVEUR REUSSIE !" -ForegroundColor Green
Write-Host "Application locale disponible sur : http://localhost:5000" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
