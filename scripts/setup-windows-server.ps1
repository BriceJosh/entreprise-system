# Script d'installation initiale complète sur la machine Windows Server
# Exécutez ce script dans PowerShell en tant qu'Administrateur sur le serveur

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 🚀 Installation & Déploiement Complet - Windows Server  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Vérification de Node.js
Write-Host "`n1️⃣ Vérification de l'environnement Node.js..." -ForegroundColor Yellow
if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js n'est pas installé sur ce serveur !" -ForegroundColor Red
    Write-Host "👉 Veuillez installer Node.js LTS (v20 ou v22) depuis https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
$nodeVer = node -v
Write-Host "✅ Node.js détecté : $nodeVer" -ForegroundColor Green

# 2. Installation de PM2 globalement
Write-Host "`n2️⃣ Configuration de PM2 pour Windows..." -ForegroundColor Yellow
npm install -g pm2 pm2-windows-startup
& "$env:APPDATA\npm\pm2-startup.cmd" install 2>$null

# 3. Installation des dépendances et compilation du Frontend
Write-Host "`n3️⃣ Installation des dépendances Frontend & Compilation (Vite)..." -ForegroundColor Yellow
npm install
npm run build

# 4. Installation des dépendances Backend
Write-Host "`n4️⃣ Installation des dépendances Backend..." -ForegroundColor Yellow
Set-Location -Path "Backend"
npm install
Set-Location -Path ".."

# 5. Configuration du Replica Set MongoDB local (rs0)
Write-Host "`n5️⃣ Configuration du Replica Set MongoDB Local (rs0)..." -ForegroundColor Yellow
& powershell -ExecutionPolicy Bypass -File ".\scripts\setup-mongodb-replicaset.ps1"

# 6. Démarrage de l'application avec PM2
Write-Host "`n6️⃣ Démarrage de l'application avec PM2..." -ForegroundColor Yellow
pm2 delete entreprise-system 2>$null
pm2 start ecosystem.config.cjs
pm2 save

# 7. Règle Pare-feu Windows
Write-Host "`n7️⃣ Configuration du Pare-feu Windows (Port 5000)..." -ForegroundColor Yellow
$firewallRule = Get-NetFirewallRule -DisplayName "Entreprise System Node.js" -ErrorAction SilentlyContinue
if (-not $firewallRule) {
    New-NetFirewallRule -DisplayName "Entreprise System Node.js" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow | Out-Null
    Write-Host "✅ Port 5000 ouvert dans le pare-feu local." -ForegroundColor Green
}
else {
    Write-Host "✅ Règle de pare-feu déjà existante." -ForegroundColor Green
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "🎉 INSTALLATION SUR LE SERVEUR RÉUSSIE !" -ForegroundColor Green
Write-Host "Application locale disponible sur : http://localhost:5000" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
