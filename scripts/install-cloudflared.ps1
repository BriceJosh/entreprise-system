# Script d'installation et configuration de Cloudflare Tunnel sur Windows Server
# Exécutez ce script dans PowerShell en tant qu'Administrateur

param(
    [string]$TunnelToken = ""
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " ☁️ Installation de Cloudflare Tunnel (cloudflared)       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$InstallDir = "C:\Program Files\Cloudflare"
$ExePath = "$InstallDir\cloudflared.exe"

# 1. Création du dossier d'installation
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# 2. Téléchargement du binaire officiel Cloudflare Tunnel si non présent
if (-not (Test-Path $ExePath)) {
    Write-Host "`n📥 Téléchargement de cloudflared.exe depuis Cloudflare..." -ForegroundColor Yellow
    $url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    Invoke-WebRequest -Uri $url -OutFile $ExePath
    Write-Host "✅ cloudflared.exe téléchargé dans $ExePath" -ForegroundColor Green
}
else {
    Write-Host "`n✅ cloudflared.exe est déjà présent dans $ExePath" -ForegroundColor Green
}

# 3. Ajout au PATH système si pas encore présent
$currentPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::Machine)
if ($currentPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$InstallDir", [EnvironmentVariableTarget]::Machine)
    Write-Host "✅ Ajouté au PATH système Windows." -ForegroundColor Green
}

# 4. Installation en tant que Service Windows si un token est fourni
if ($TunnelToken -ne "") {
    Write-Host "`n⚙️ Installation du service Cloudflare Tunnel avec le Token..." -ForegroundColor Yellow
    & $ExePath service install $TunnelToken
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Service Windows Cloudflare Tunnel installé et démarré !" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Erreur lors de l'installation du service Cloudflare." -ForegroundColor Red
    }
}
else {
    Write-Host "`nℹ️ Pour installer le service Cloudflare avec votre token de connexion :" -ForegroundColor Yellow
    Write-Host "   1. Rendez-vous sur https://one.dash.cloudflare.com/ (Zero Trust > Networks > Tunnels)" -ForegroundColor White
    Write-Host "   2. Créez un tunnel et copiez la commande contenant le token." -ForegroundColor White
    Write-Host "   3. Exécutez : powershell -File .\scripts\install-cloudflared.ps1 -TunnelToken '<VOTRE_TOKEN>'" -ForegroundColor Cyan
}

Write-Host "`n🎉 Installation terminée !" -ForegroundColor Green
