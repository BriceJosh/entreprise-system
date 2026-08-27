# Script d'aide à la configuration de Cloudflare Tunnel (Gratuit)
# Entreprise System - Windows Server 2022
param (
    [string]$Action = "menu",
    [string]$Token = ""
)

$cloudflared = "C:\Program Files\Cloudflare\cloudflared.exe"

if (-not (Test-Path $cloudflared)) {
    Write-Host "[ERREUR] cloudflared.exe introuvable dans C:\Program Files\Cloudflare\" -ForegroundColor Red
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 🌐 GESTION DE CLOUDFLARE TUNNEL (ACCÈS PUBLIC GRATUIT)   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if ($Token) {
    Write-Host "`n[INFO] Installation du service Cloudflare avec votre Token..." -ForegroundColor Yellow
    & "$cloudflared" service install $Token
    Start-Sleep -Seconds 2
    Start-Service cloudflared -ErrorAction SilentlyContinue
    Get-Service cloudflared
    Write-Host "`n✔ Cloudflare Tunnel installe et demarre en tant que service Windows !" -ForegroundColor Green
    exit 0
}

Write-Host "`nOptions disponibles :" -ForegroundColor Yellow
Write-Host " 1. Lancer un tunnel instantane gratuit (sans nom de domaine : trycloudflare.com)"
Write-Host " 2. Installer le service Cloudflare officiel permanent (avec votre Token)"
Write-Host " 3. Verifier l'etat du service Cloudflare sur ce serveur"
Write-Host " 4. Verifier l'etat de Tailscale (acces securise de secours)"

Write-Host "`n[CONSEIL] Pour un tunnel instantane de test :" -ForegroundColor White
Write-Host "  & 'C:\Program Files\Cloudflare\cloudflared.exe' tunnel --url http://127.0.0.1:5000" -ForegroundColor Gray

Write-Host "`n[CONSEIL] Pour installer votre tunnel permanent avec Token :" -ForegroundColor White
Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\installer-cloudflare-tunnel.ps1 -Token 'VOTRE_TOKEN_CLOUDFLARE'" -ForegroundColor Gray
