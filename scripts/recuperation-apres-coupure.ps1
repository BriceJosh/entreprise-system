# ============================================================
#  RECUPERATION APRES COUPURE - Entreprise System
#
#  Script tout-en-un a lancer sur le serveur APRES une coupure
#  de courant / arret brutal, quand l'application affiche
#  "La base de donnees est actuellement indisponible".
#
#  Usage (PowerShell EN ADMINISTRATEUR, racine du projet) :
#
#    powershell -ExecutionPolicy Bypass -File .\scripts\recuperation-apres-coupure.ps1
#      -> repare MongoDB + redemarre l'application
#
#    powershell -ExecutionPolicy Bypass -File .\scripts\recuperation-apres-coupure.ps1 -MettreAJour
#      -> idem + recupere les dernieres mises a jour GitHub
#         (git pull + reconstruction frontend)
#
#    powershell -ExecutionPolicy Bypass -File .\scripts\recuperation-apres-coupure.ps1 -DiagnosticSeulement
#      -> affiche seulement l'etat, ne modifie rien
# ============================================================
param(
    [switch]$MettreAJour,
    [switch]$DiagnosticSeulement
)

$ErrorActionPreference = "SilentlyContinue"

function Write-Titre($txt) {
    Write-Host "`n==========================================================" -ForegroundColor Cyan
    Write-Host " $txt" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan
}

function Test-Port27017 {
    $c = New-Object Net.Sockets.TcpClient
    $r = $c.BeginConnect('127.0.0.1', 27017, $null, $null)
    $ok = ($r.AsyncWaitHandle.WaitOne(3000) -and $c.Connected)
    $c.Close()
    return $ok
}

Write-Titre " RECUPERATION APRES COUPURE - $(Get-Date -Format 'dd/MM/yyyy HH:mm') "

# ------------------------------------------------------------
# [0/6] Droits administrateur requis (sauf diagnostic simple)
# ------------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
   ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin -and -not $DiagnosticSeulement) {
    Write-Host "[ERREUR] Ce script doit etre lance dans un PowerShell EN ADMINISTRATEUR." -ForegroundColor Red
    Write-Host "[ASTUCE] Clic droit sur PowerShell -> 'Executer en tant qu'administrateur', puis relancez." -ForegroundColor Yellow
    pause
    exit 1
}

Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host "[OK] Dossier projet : $(Get-Location)"

# ------------------------------------------------------------
# [1/6] Etat actuel
# ------------------------------------------------------------
Write-Host "`n[1/6] Etat actuel du systeme..." -ForegroundColor Yellow

$svc = Get-Service | Where-Object { $_.Name -like "MongoDB*" -or $_.DisplayName -like "*MongoDB*" } | Select-Object -First 1

if (-not $svc) {
    Write-Host "[ERREUR] Aucun service MongoDB trouve sur ce serveur !" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "  Service MongoDB '$($svc.Name)' : $($svc.Status)" -ForegroundColor Gray

$mongoPortOk = Test-Port27017
Write-Host "  Port 27017 (MongoDB) : $(if ($mongoPortOk) {'OUVERT'} else {'FERME'})" -ForegroundColor Gray

$appHealth = $null
try {
    $appHealth = Invoke-RestMethod -Uri 'http://localhost:5000/api/health' -TimeoutSec 8
} catch {}
if ($appHealth) {
    Write-Host "  Application Node : EN LIGNE | base connectee : $($appHealth.dbConnected)" -ForegroundColor Gray
} else {
    Write-Host "  Application Node : INJOIGNABLE (PM2 arrete ou encore en demarrage)" -ForegroundColor Gray
}

if ($svc.Status -eq "Running" -and $mongoPortOk -and $appHealth -and $appHealth.dbConnected) {
    Write-Host "`n[CONCLUSION] Tout semble deja operationnel !" -ForegroundColor Green
    Write-Host "Si l'application affiche encore une erreur, patientez 1 minute puis rafraichissez." -ForegroundColor Green
    pause
    exit 0
}

if ($DiagnosticSeulement) {
    Write-Host "`n[INFO] Mode diagnostic uniquement : aucune action effectuee." -ForegroundColor Yellow
    Write-Host "Pour reparer :" -ForegroundColor White
    Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\recuperation-apres-coupure.ps1" -ForegroundColor White
    pause
    exit 0
}

# ------------------------------------------------------------
# [2/6] Mise a jour optionnelle depuis GitHub
# ------------------------------------------------------------
if ($MettreAJour) {
    Write-Host "`n[2/6] Recuperation des dernieres mises a jour GitHub..." -ForegroundColor Yellow
    git pull
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Depot mis a jour." -ForegroundColor Green
        powershell -ExecutionPolicy Bypass -File ".\scripts\update-app.ps1"
    } else {
        Write-Host "[ATTENTION] git pull a echoue (internet du serveur ?). Version locale conservee." -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[2/6] Mise a jour GitHub ignoree (ajoutez -MettreAJour pour l'activer)." -ForegroundColor Gray
}

# ------------------------------------------------------------
# [3/6] Demarrage du service MongoDB si arrete
# ------------------------------------------------------------
Write-Host "`n[3/6] Gestion du service MongoDB..." -ForegroundColor Yellow

if ($svc.Status -ne "Running") {
    Write-Host "  Service arrete -> tentative de demarrage..." -ForegroundColor Gray
    Start-Service -Name $svc.Name
    Start-Sleep -Seconds 8
    $svc.Refresh()

    if ($svc.Status -eq "Running" -and (Test-Port27017)) {
        Write-Host "[OK] Service MongoDB demarre et port 27017 ouvert." -ForegroundColor Green
    } else {
        Write-Host "[PROBLEME] Le service refuse de demarrer (probable corruption apres arret brutal)." -ForegroundColor Red
        Write-Host "  -> Lancement de la REPARATION de la base (avec sauvegarde prealable)..." -ForegroundColor Yellow
        powershell -ExecutionPolicy Bypass -File ".\scripts\reparer-mongodb.ps1" -Sauvegarde

        Write-Host "`n  -> Nouvelle tentative de demarrage..." -ForegroundColor Gray
        Start-Service -Name $svc.Name
        Start-Sleep -Seconds 8
        $svc.Refresh()
    }
} else {
    Write-Host "  Service deja en cours d'execution." -ForegroundColor Gray
}

# ------------------------------------------------------------
# [4/6] Controle de la base
# ------------------------------------------------------------
Write-Host "`n[4/6] Controle de la base de donnees..." -ForegroundColor Yellow

Start-Sleep -Seconds 3
if (Test-Port27017) {
    Write-Host "[OK] MongoDB repond sur le port 27017." -ForegroundColor Green
} else {
    Write-Host "[ECHEC] MongoDB ne repond toujours pas." -ForegroundColor Red
    Write-Host "  Consultez l'analyse detaillee du log :" -ForegroundColor Yellow
    Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\diagnostic-serveur.ps1" -ForegroundColor White
}

# ------------------------------------------------------------
# [5/6] Redemarrage de l'application (PM2)
# ------------------------------------------------------------
Write-Host "`n[5/6] Redemarrage de l'application (PM2)..." -ForegroundColor Yellow

pm2 restart entreprise-system --update-env
Start-Sleep -Seconds 5

# ------------------------------------------------------------
# [6/6] Verification finale
# ------------------------------------------------------------
Write-Host "`n[6/6] Verification finale..." -ForegroundColor Yellow

Start-Sleep -Seconds 5
try {
    $final = Invoke-RestMethod -Uri 'http://localhost:5000/api/health' -TimeoutSec 10
    if ($final.dbConnected) {
        Write-Host "`n==========================================================" -ForegroundColor Green
        Write-Host " SUCCES : Application EN LIGNE, base de donnees CONNECTEE !" -ForegroundColor Green
        Write-Host "==========================================================" -ForegroundColor Green
        Write-Host "L'application est a nouveau accessible via Tailscale (port 5000)." -ForegroundColor Green
    } else {
        Write-Host "[PARTIEL] L'application repond mais la base n'est pas encore reconnectee." -ForegroundColor Yellow
        Write-Host "Mongoose se reconnecte tout seul : patientez 1-2 min puis relancez ce script." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ATTENTION] L'application ne repond pas encore (redemarrage PM2 en cours ?)" -ForegroundColor Yellow
    Write-Host "Attendez 1 minute puis rechargez http://localhost:5000/api/health" -ForegroundColor Yellow
}

Write-Host "`nTermine." -ForegroundColor Cyan
pause