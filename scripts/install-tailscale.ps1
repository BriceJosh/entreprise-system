# Script d'installation de Tailscale sur Windows Server
# Executez ce script dans PowerShell en tant qu'Administrateur

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [*] Installation de Tailscale sur Windows Server          " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$InstallerPath = "$env:TEMP\tailscale-setup.exe"

# 1. Telechargement de Tailscale officiel pour Windows
Write-Host "`n[INFO] Telechargement de Tailscale depuis le site officiel..." -ForegroundColor Yellow
$url = "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe"
Invoke-WebRequest -Uri $url -OutFile $InstallerPath

if (Test-Path $InstallerPath) {
    Write-Host "[OK] Fichier d'installation telecharge dans $InstallerPath" -ForegroundColor Green
}
else {
    Write-Host "[ERREUR] Echec du telechargement de Tailscale." -ForegroundColor Red
    exit 1
}

# 2. Installation silencieuse
Write-Host "`n[INFO] Installation de Tailscale..." -ForegroundColor Yellow
Start-Process -FilePath $InstallerPath -ArgumentList "/quiet" -Wait

# Nettoyage
Remove-Item $InstallerPath -Force -ErrorAction SilentlyContinue

Write-Host "[OK] Tailscale installe avec succes !" -ForegroundColor Green
Write-Host "`n[PROCHAINE ETAPE] :" -ForegroundColor Yellow
Write-Host "1. Ouvrez l'application Tailscale depuis le menu Demarrer ou pres de l'horloge Windows." -ForegroundColor White
Write-Host "2. Cliquez sur 'Log in' pour connecter le serveur avec votre compte (Google, Microsoft, GitHub... sans carte bancaire)." -ForegroundColor White
Write-Host "3. Notez l'adresse IP Tailscale du serveur (ex: 100.x.y.z) ou son nom de machine." -ForegroundColor White

Write-Host "`n[SUCCES] Termine !" -ForegroundColor Green
