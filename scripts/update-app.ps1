# Script de deploiement et mise a jour automatique sur Windows Server
# Executez ce script dans PowerShell en Administrateur

Write-Host "================================================" -ForegroundColor Cyan
Write-Host " [*] Deploiement / Mise a jour Entreprise System " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# 1. Installation des dependances racine (Frontend)
Write-Host "`n[INFO] Installation des dependances Frontend..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERREUR] Echec de l'installation des dependances frontend." -ForegroundColor Red
    exit 1
}

# 2. Compilation du Frontend (Vite Build)
Write-Host "`n[INFO] Compilation du Frontend (Vite)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERREUR] Echec de la compilation du frontend." -ForegroundColor Red
    exit 1
}

# 3. Installation des dependances Backend
Write-Host "`n[INFO] Installation des dependances Backend..." -ForegroundColor Yellow
Set-Location -Path "Backend"
npm install
Set-Location -Path ".."
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERREUR] Echec de l'installation des dependances backend." -ForegroundColor Red
    exit 1
}

# 4. Redemarrage de PM2
Write-Host "`n[INFO] Redemarrage de l'application avec PM2..." -ForegroundColor Yellow
pm2 restart ecosystem.config.cjs --update-env
if ($LASTEXITCODE -ne 0) {
    Write-Host "[INFO] PM2 n'est pas encore demarre, premier demarrage..." -ForegroundColor Gray
    pm2 start ecosystem.config.cjs
}

pm2 save
Write-Host "`n[SUCCES] Deploiement termine avec succes !" -ForegroundColor Green
Write-Host "Application accessible sur http://localhost:5000" -ForegroundColor Green
