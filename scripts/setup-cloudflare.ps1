# ============================================================
#  GESTION ET CONFIGURATION DE CLOUDFLARE TUNNEL (GRATUIT)
#  Entreprise System - Windows Server 2022
# ============================================================
# Permet de connecter l'application à Cloudflare (Zero Trust)
# tout en gardant Tailscale comme solution de secours.
# ============================================================

param (
    [string]$TunnelToken = ""
)

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " 🌐 CONFIGURATION DU TUNNEL CLOUDFLARE GRATUIT           " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$cloudflaredDir = "C:\Program Files\Cloudflare"
$cloudflaredExe = Join-Path $cloudflaredDir "cloudflared.exe"
$tokenDir = "C:\ProgramData\cloudflared"
$tokenFile = Join-Path $tokenDir "token"

if (-not (Test-Path $tokenDir)) {
    New-Item -ItemType Directory -Path $tokenDir -Force | Out-Null
}

if ($TunnelToken) {
    Write-Host "[INFO] Mise a jour du token Cloudflare Tunnel..." -ForegroundColor Yellow
    [System.IO.File]::WriteAllText($tokenFile, $TunnelToken.Trim())
    Write-Host "[OK] Nouveau token enregistre dans $tokenFile" -ForegroundColor Green
}

# Verifier l'executable
if (-not (Test-Path $cloudflaredExe)) {
    $alt = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
    if (Test-Path $alt) {
        if (-not (Test-Path $cloudflaredDir)) { New-Item -ItemType Directory -Path $cloudflaredDir -Force | Out-Null }
        Copy-Item $alt $cloudflaredExe -Force
    }
}

# Redemarrage du service
Write-Host "`n[INFO] Redemarrage du service Windows Cloudflared..." -ForegroundColor Yellow
Restart-Service Cloudflared -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

$svc = Get-Service Cloudflared -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq "Running") {
    Write-Host "[SUCCES] Cloudflared est actif et connecte !" -ForegroundColor Green
} else {
    Write-Host "[ATTENTION] Le service Cloudflared n'est pas encore demarre. Verifiez votre token." -ForegroundColor Yellow
}

# Rappel Tailscale
Write-Host "`n----------------------------------------------------------" -ForegroundColor Gray
Write-Host " 🛡️ ACCÈS DE SECOURS (TAILSCALE TOUJOURS ACTIF) :" -ForegroundColor Cyan
Write-Host " En cas de probleme avec Cloudflare, vous pouvez toujours" -ForegroundColor Gray
Write-Host " acceder a l'application via votre IP Tailscale : http://100.97.221.61:5000" -ForegroundColor White
Write-Host "----------------------------------------------------------`n" -ForegroundColor Gray
