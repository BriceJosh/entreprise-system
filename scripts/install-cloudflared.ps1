# Script d'installation et configuration de Cloudflare Tunnel sur Windows Server
# Executez ce script dans PowerShell en tant qu'Administrateur

param(
    [string]$TunnelToken = ""
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [*] Installation de Cloudflare Tunnel (cloudflared)       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$InstallDir = "C:\Program Files\Cloudflare"
$ExePath = "$InstallDir\cloudflared.exe"

# 1. Creation du dossier d'installation
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# 2. Telechargement du binaire officiel Cloudflare Tunnel si non present
if (-not (Test-Path $ExePath)) {
    Write-Host "`n[INFO] Telechargement de cloudflared.exe depuis Cloudflare..." -ForegroundColor Yellow
    $url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    Invoke-WebRequest -Uri $url -OutFile $ExePath
    Write-Host "[OK] cloudflared.exe telecharge dans $ExePath" -ForegroundColor Green
}
else {
    Write-Host "`n[OK] cloudflared.exe est deja present dans $ExePath" -ForegroundColor Green
}

# 3. Ajout au PATH systeme si pas encore present
$currentPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::Machine)
if ($currentPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$InstallDir", [EnvironmentVariableTarget]::Machine)
    Write-Host "[OK] Ajoute au PATH systeme Windows." -ForegroundColor Green
}

# 4. Installation en tant que Service Windows si un token est fourni
if ($TunnelToken -ne "") {
    # Nettoyage automatique si l'utilisateur a copie toute la commande 'cloudflared.exe service install <TOKEN>'
    $cleanToken = $TunnelToken.Trim()
    if ($cleanToken -match "(eyJh[A-Za-z0-9_\-]+)") {
        $cleanToken = $Matches[1]
    }

    Write-Host "`n[INFO] Installation du service Cloudflare Tunnel avec le Token..." -ForegroundColor Yellow
    & $ExePath service install $cleanToken
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Service Windows Cloudflare Tunnel installe et demarre !" -ForegroundColor Green
    }
    else {
        Write-Host "[ERREUR] Echec lors de l'installation du service Cloudflare." -ForegroundColor Red
    }
}
else {
    Write-Host "`n[INFO] Pour installer le service Cloudflare avec votre token de connexion :" -ForegroundColor Yellow
    Write-Host "   1. Rendez-vous sur https://one.dash.cloudflare.com/ (Zero Trust > Networks > Tunnels)" -ForegroundColor White
    Write-Host "   2. Creez un tunnel et copiez la commande contenant le token." -ForegroundColor White
    Write-Host "   3. Executez : powershell -File .\scripts\install-cloudflared.ps1 -TunnelToken '<VOTRE_TOKEN>'" -ForegroundColor Cyan
}

Write-Host "`n[SUCCES] Operation terminee !" -ForegroundColor Green
