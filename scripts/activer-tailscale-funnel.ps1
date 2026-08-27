# Script d'activation et de gestion de Tailscale Funnel (HTTPS Gratuit)
# Entreprise System - Windows Server 2022

$tailscale = "C:\Program Files\Tailscale\tailscale.exe"

if (-not (Test-Path $tailscale)) {
    Write-Host "[ERREUR] Tailscale introuvable dans C:\Program Files\Tailscale\" -ForegroundColor Red
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 🚀 ACTIVATION DE TAILSCALE FUNNEL (ACCÈS HTTPS GRATUIT) " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

Write-Host "`n[1/3] Configuration du point d'acces HTTPS local vers le port 5000..." -ForegroundColor Yellow
& "$tailscale" serve --bg 5000

Write-Host "`n[2/3] Ouverture du Funnel public mondial..." -ForegroundColor Yellow
& "$tailscale" funnel --bg 5000

Write-Host "`n[3/3] Verification de l'etat du Funnel..." -ForegroundColor Yellow
& "$tailscale" funnel status

$self = & "$tailscale" status --json | ConvertFrom-Json | Select-Object -ExpandProperty Self
$dnsName = $self.DNSName.TrimEnd('.')

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " 🎉 VOTRE ADRESSE PUBLIQUE SECURISEE (GRATUITE) :" -ForegroundColor Green
Write-Host " 👉 https://$dnsName" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green
