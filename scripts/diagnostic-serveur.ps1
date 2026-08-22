# ============================================================
#  DIAGNOSTIC & REPARATION - Entreprise System (Windows Server)
#  Usage :
#    powershell -ExecutionPolicy Bypass -File .\scripts\diagnostic-serveur.ps1
#    powershell -ExecutionPolicy Bypass -File .\scripts\diagnostic-serveur.ps1 -Reparer
# ============================================================
param(
    [switch]$Reparer
)

$ErrorActionPreference = "SilentlyContinue"

function Write-Titre($txt) {
    Write-Host "`n==========================================================" -ForegroundColor Cyan
    Write-Host " $txt" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan
}

# ------------------------------------------------------------
# Analyse automatique d'un echec de demarrage MongoDB :
# espace disque + lecture du log + detection des causes connues
# ------------------------------------------------------------
function Show-DiagnosticEchecMongo {
    # Espace disque (cause classique n.1 : disque plein)
    Get-PSDrive -PSProvider FileSystem | ForEach-Object {
        Write-Host ("[DISQUE] {0}: libre {1:N1} Go" -f $_.Name, ($_.Free / 1GB)) -ForegroundColor Gray
    }

    # Localisation du fichier de log via la config du service Windows
    $logFile = $null
    $svcDetail = Get-CimInstance Win32_Service -Filter "Name='MongoDB'" -ErrorAction SilentlyContinue
    $mongodExe = $null
    if ($svcDetail) {
        if ($svcDetail.PathName -match '"([^"]+mongod\.exe)"') { $mongodExe = $Matches[1] }
        elseif ($svcDetail.PathName -match '(^[^"]+mongod\.exe)') { $mongodExe = $Matches[1] }
        $cfgFile = $null
        if ($svcDetail.PathName -match '--config\s+"([^"]+)"') { $cfgFile = $Matches[1].Trim() }
        elseif ($svcDetail.PathName -match "--config\s+'([^']+)'") { $cfgFile = $Matches[1].Trim() }
        elseif ($svcDetail.PathName -match '--config\s+([^\s"]+)') { $cfgFile = $Matches[1].Trim() }
        if ($cfgFile -and (Test-Path $cfgFile)) {
            $cfgText = Get-Content $cfgFile -Raw -ErrorAction SilentlyContinue
            if ($cfgText -match "systemLog:[\s\S]*?path:\s*'([^']+)'") { $logFile = $Matches[1] }
            elseif ($cfgText -match 'systemLog:[\s\S]*?path:\s*"?([^\r\n"]+)"?') { $logFile = $Matches[1].Trim() }
        }
    }
    if (-not $logFile -and $mongodExe) {
        $guess = Join-Path (Split-Path -Parent (Split-Path -Parent $mongodExe)) "log\mongod.log"
        if (Test-Path $guess) { $logFile = $guess }
    }

    if (-not ($logFile -and (Test-Path $logFile))) {
        Write-Host "[INFO] mongod.log introuvable (chemin attendu : C:\Program Files\MongoDB\Server\<version>\log\mongod.log)." -ForegroundColor Gray
        return
    }

    Write-Host "`n[LOG] Dernieres lignes de : $logFile" -ForegroundColor Yellow
    $tail = Get-Content $logFile -Tail 40 -ErrorAction SilentlyContinue
    $tail | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }

    $joined = $tail -join "`n"
    Write-Host "`n[ANALYSE] Lecture du log :" -ForegroundColor Yellow
    if ($joined -match 'No space left|\(28\)|errno:? ?28') {
        Write-Host "  >> DISQUE PLEIN : liberez de l'espace sur le serveur puis relancez le service." -ForegroundColor Red
    }
    elseif ($joined -match 'unknown magic number|WiredTiger error|Failed to start up WiredTiger|WT_PANIC|checksum|Fatal Assertion') {
        Write-Host "  >> DONNEES ENDOMMAGEES (arret brutal du serveur probable). Lancez la reparation :" -ForegroundColor Red
        Write-Host "     powershell -ExecutionPolicy Bypass -File .\scripts\reparer-mongodb.ps1 -Sauvegarde" -ForegroundColor White
    }
    elseif ($joined -match 'already in use|address in use') {
        Write-Host "  >> PORT 27017 DEJA UTILISE : verifiez avec 'netstat -ano | findstr 27017'." -ForegroundColor Red
    }
    elseif ($joined -match 'Permission denied|Access is denied') {
        Write-Host "  >> PROBLEME DE DROITS sur le dossier data : verifiez le compte du service." -ForegroundColor Red
    }
    elseif ($joined -match 'Unrecognized option|Error parsing YAML|BadValue|IllegalOperation') {
        Write-Host "  >> FICHIER mongod.cfg INVALIDE : comparez-le au modele dans scripts\setup-mongodb-replicaset.ps1." -ForegroundColor Red
    }
    else {
        Write-Host "  >> Cause non identifiee. Envoyez les lignes de log ci-dessus au support." -ForegroundColor Yellow
        Write-Host "     Une reparation peut aussi etre tentee :" -ForegroundColor Yellow
        Write-Host "     powershell -ExecutionPolicy Bypass -File .\scripts\reparer-mongodb.ps1 -Sauvegarde" -ForegroundColor White
    }
}

Write-Titre " DIAGNOSTIC ENTREPRISE SYSTEM - $(Get-Date -Format 'dd/MM/yyyy HH:mm') "

# ------------------------------------------------------------
# [1/5] Service MongoDB
# ------------------------------------------------------------
Write-Host "`n[1/5] Verification du service MongoDB..." -ForegroundColor Yellow

$svc = Get-Service | Where-Object { $_.Name -like "MongoDB*" -or $_.DisplayName -like "*MongoDB*" } | Select-Object -First 1

if (-not $svc) {
    Write-Host "[ERREUR] Aucun service MongoDB trouve sur ce serveur !" -ForegroundColor Red
    Write-Host "[CONSEIL] Reinstallez MongoDB Community Server en cochant 'Install as a Service'." -ForegroundColor Yellow
}
elseif ($svc.Status -ne "Running") {
    Write-Host "[PROBLEME] Le service '$($svc.Name)' est : $($svc.Status)" -ForegroundColor Red
    if ($Reparer) {
        Write-Host "[ACTION] Demarrage du service $($svc.Name)..." -ForegroundColor Green
        Start-Service -Name $svc.Name
        Start-Sleep -Seconds 4
        $svc.Refresh()
        if ($svc.Status -eq "Running") {
            Write-Host "[OK] Service MongoDB demarre." -ForegroundColor Green
        }
        else {
            Write-Host "[ECHEC] Impossible de demarrer le service MongoDB." -ForegroundColor Red
            Show-DiagnosticEchecMongo
        }
    }
    else {
        Write-Host "[SOLUTION] Relancez ce script avec l'option -Reparer, ou executez :" -ForegroundColor Yellow
        Write-Host "           Start-Service -Name '$($svc.Name)'" -ForegroundColor White
    }
}
else {
    Write-Host "[OK] Service MongoDB actif ($($svc.Name))." -ForegroundColor Green
}

# Test de reponse reelle de MongoDB sur le port 27017
$mongoPort = Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -WarningAction SilentlyContinue
if ($mongoPort.TcpTestSucceeded) {
    Write-Host "[OK] MongoDB repond sur 127.0.0.1:27017." -ForegroundColor Green
}
else {
    Write-Host "[PROBLEME] MongoDB ne repond PAS sur le port 27017." -ForegroundColor Red
}

# ------------------------------------------------------------
# [2/5] Application Node.js sous PM2
# ------------------------------------------------------------
Write-Host "`n[2/5] Verification de l'application (PM2)..." -ForegroundColor Yellow

$pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
if (-not $pm2) {
    Write-Host "[ERREUR] PM2 n'est pas installe ou absent du PATH." -ForegroundColor Red
    Write-Host "[SOLUTION] npm install -g pm2 pm2-windows-startup" -ForegroundColor Yellow
}
else {
    pm2 list
    $proc = pm2 jlist | ConvertFrom-Json | Where-Object { $_.name -eq "entreprise-system" }
    if (-not $proc) {
        Write-Host "[PROBLEME] L'application 'entreprise-system' n'est pas enregistree dans PM2." -ForegroundColor Red
        if ($Reparer) {
            Write-Host "[ACTION] Demarrage de l'application..." -ForegroundColor Green
            pm2 start ecosystem.config.cjs
            pm2 save
        }
        else {
            Write-Host "[SOLUTION] Relancez avec -Reparer ou executez : pm2 start ecosystem.config.cjs ; pm2 save" -ForegroundColor Yellow
        }
    }
    elseif ($proc.pm2_env.status -ne "online") {
        Write-Host "[PROBLEME] L'application est : $($proc.pm2_env.status) (redemarrages: $($proc.pm2_env.restart_time))" -ForegroundColor Red
        if ($Reparer) {
            Write-Host "[ACTION] Redemarrage de l'application..." -ForegroundColor Green
            pm2 restart entreprise-system --update-env
        }
    }
    else {
        Write-Host "[OK] Application 'entreprise-system' en ligne." -ForegroundColor Green
    }
}

# ------------------------------------------------------------
# [3/5] API HTTP de l'application
# ------------------------------------------------------------
Write-Host "`n[3/5] Test de l'API HTTP..." -ForegroundColor Yellow

try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -TimeoutSec 8
    Write-Host "[OK] API repond sur le port 5000 (status: $($health.status))." -ForegroundColor Green
    if ($health.dbConnected) {
        Write-Host "[OK] L'application est bien connectee a la base de donnees." -ForegroundColor Green
    }
    else {
        Write-Host "[PROBLEME] L'application tourne mais la connexion MongoDB est perdue." -ForegroundColor Red
        Write-Host "[SOLUTION] Le service MongoDB est probablement arrete. Relancez avec -Reparer." -ForegroundColor Yellow
    }
}
catch {
    Write-Host "[PROBLEME] L'API ne repond pas sur http://127.0.0.1:5000/api/health" -ForegroundColor Red
    if ($Reparer) {
        Write-Host "[ACTION] Redemarrage complet de l'application..." -ForegroundColor Green
        pm2 delete entreprise-system 2>$null
        pm2 start ecosystem.config.cjs
        pm2 save
        Start-Sleep -Seconds 5
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -TimeoutSec 8
            Write-Host "[OK] API repond apres redemarrage." -ForegroundColor Green
        }
        catch {
            Write-Host "[ECHEC] L'API ne repond toujours pas. Consultez : pm2 logs entreprise-system --lines 50" -ForegroundColor Red
        }
    }
    else {
        Write-Host "[SOLUTION] Relancez avec -Reparer, ou executez :" -ForegroundColor Yellow
        Write-Host "           pm2 restart entreprise-system ; pm2 logs entreprise-system --lines 30" -ForegroundColor White
    }
}

# ------------------------------------------------------------
# [4/5] Base de donnees (contenu reel)
# ------------------------------------------------------------
Write-Host "`n[4/5] Verification du contenu de la base..." -ForegroundColor Yellow

$mongoShell = Get-Command mongosh -ErrorAction SilentlyContinue
if (-not $mongoShell) { $mongoShell = Get-Command mongo -ErrorAction SilentlyContinue }

if ($mongoShell) {
    & $mongoShell.Source --quiet --eval "db = db.getSiblingDB('entreprise_db'); print('Utilisateurs: ' + db.users.countDocuments({}) + ' | Sites: ' + db.sites.countDocuments({}))" "mongodb://127.0.0.1:27017/entreprise_db"
}
else {
    Write-Host "[INFO] mongosh non installe, test du contenu ignore." -ForegroundColor Gray
}

# ------------------------------------------------------------
# [5/5] WebSocket Socket.IO
# ------------------------------------------------------------
Write-Host "`n[5/5] Verification du WebSocket (Socket.IO)..." -ForegroundColor Yellow

try {
    $ws = Invoke-WebRequest -Uri "http://127.0.0.1:5000/socket.io/?EIO=4&transport=polling" -TimeoutSec 8 -UseBasicParsing
    if ($ws.StatusCode -eq 200) {
        Write-Host "[OK] Socket.IO repond correctement sur le port 5000." -ForegroundColor Green
    }
}
catch {
    Write-Host "[PROBLEME] Socket.IO ne repond pas sur le port 5000." -ForegroundColor Red
    Write-Host "[CAUSE] Le processus Node.js est probablement arrete ou en boucle de crash." -ForegroundColor Yellow
    Write-Host "[SOLUTION] Consultez les logs : pm2 logs entreprise-system --lines 50" -ForegroundColor Yellow
}

# ------------------------------------------------------------
# Resume final
# ------------------------------------------------------------
Write-Titre " RESUME "
Write-Host "Si des [PROBLEME] persistent apres '-Reparer', executez sur le serveur :" -ForegroundColor White
Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\reparer-mongodb.ps1 -Sauvegarde   # reparer la base MongoDB" -ForegroundColor White
Write-Host "  pm2 logs entreprise-system --lines 100   # voir les erreurs applicatives" -ForegroundColor White
Write-Host "  Get-Content 'C:\Program Files\MongoDB\Server\<version>\log\mongod.log' -Tail 50   # erreurs MongoDB" -ForegroundColor White
Write-Host ""
