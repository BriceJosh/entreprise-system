# Script de déploiement et mise à jour automatique sur Windows Server
# Exécutez ce script dans PowerShell en Administrateur

Write-Host "================================================" -ForegroundColor Cyan
Write-Host " 🚀 Déploiement / Mise à jour Entreprise System " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# 1. Installation des dépendances racine (Frontend)
Write-Host "`n📦 Installation des dépendances Frontend..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec de l'installation des dépendances frontend." -ForegroundColor Red
    exit 1
}

# 2. Compilation du Frontend (Vite Build)
Write-Host "`n🔨 Compilation du Frontend (Vite)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec de la compilation du frontend." -ForegroundColor Red
    exit 1
}

# 3. Installation des dépendances Backend
Write-Host "`n📦 Installation des dépendances Backend..." -ForegroundColor Yellow
Set-Location -Path "Backend"
npm install
Set-Location -Path ".."
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec de l'installation des dépendances backend." -ForegroundColor Red
    exit 1
}

# 4. Redémarrage de PM2
Write-Host "`n🔄 Redémarrage de l'application avec PM2..." -ForegroundColor Yellow
pm2 restart ecosystem.config.cjs --update-env
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ PM2 n'est pas encore démarré, tentative de premier démarrage..." -ForegroundColor Gray
    pm2 start ecosystem.config.cjs
}

pm2 save
Write-Host "`n✅ Déploiement terminé avec succès !" -ForegroundColor Green
Write-Host "Application accessible sur http://localhost:5000" -ForegroundColor Green
