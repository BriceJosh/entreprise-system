# ============================================================
#  REPARATION MONGODB - Entreprise System (Windows Server)
#  A utiliser quand le service MongoDB refuse de demarrer
#  (arret brutal du serveur, corruption WiredTiger, etc.)
#
#  Usage (PowerShell en Administrateur, depuis la racine du projet) :
#    powershell -ExecutionPolicy Bypass -File .\scripts\reparer-mongodb.ps1
#    powershell -ExecutionPolicy Bypass -File .\scripts\reparer-mongodb.ps1 -Sauvegarde
#      -> copie le dossier de donnees avant la reparation (recommande)
#    powershell -ExecutionPolicy Bypass -File .\scripts\reparer-mongodb.ps1 -Forcer
#      -> tente la reparation meme si l'espace disque semble insuffisant
# ============================================================
param(
    [switch]$Sauvegarde,
    [switch]$Forcer
)

$ErrorActionPreference = "SilentlyContinue"

function Write-Titre($txt) {
    Write-Host "`n==========================================================" -ForegroundColor Cyan
    Write-Host " $txt" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan
}

# Affiche en priorite les lignes FATALES/ERREUR du log MongoDB
# (les piles d'execution masquent souvent le vrai message)
function Show-ErreursLog($logFile, $lignesBrutes = 40) {
    if (-not ($logFile -and (Test-Path $logFile))) { return }
    $errs = Get-Content $logFile -Tail 500 -ErrorAction SilentlyContinue | Where-Object { $_ -match '"s":"(F|E)"' } | Select-Object -Last 15
    if ($errs) {
        Write-Host "`n[LOG] Messages FATALS/ERREURS recents de $logFile :" -ForegroundColor Yellow
        $errs | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    }
    else {
        Write-Host "`n[LOG] Dernieres lignes de $logFile :" -ForegroundColor Yellow
        Get-Content $logFile -Tail $lignesBrutes -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    }
}

Write-Titre " REPARATION MONGODB "

# ------------------------------------------------------------
# 1. Localisation du service, de mongod.exe et du fichier cfg
# ------------------------------------------------------------
$svc = Get-Service | Where-Object { $_.Name -like "MongoDB*" -or $_.DisplayName -like "*MongoDB*" } | Select-Object -First 1
if (-not $svc) {
    Write-Host "[ERREUR] Aucun service MongoDB trouve sur ce serveur." -ForegroundColor Red
    exit 1
}

$svcDetail = Get-CimInstance Win32_Service -Filter "Name='$($svc.Name)'"
$mongodExe = $null
$cfgFile = $null

if ($svcDetail.PathName -match '"([^"]+mongod\.exe)"') { $mongodExe = $Matches[1] }
elseif ($svcDetail.PathName -match '(^[^"]+mongod\.exe)') { $mongodExe = $Matches[1] }
if ($svcDetail.PathName -match '--config\s+"([^"]+)"') { $cfgFile = $Matches[1].Trim() }
elseif ($svcDetail.PathName -match "--config\s+'([^']+)'") { $cfgFile = $Matches[1].Trim() }
elseif ($svcDetail.PathName -match '--config\s+([^\s"]+)') { $cfgFile = $Matches[1].Trim() }

if (-not $mongodExe -or -not (Test-Path $mongodExe)) {
    $cand = Get-ChildItem "C:\Program Files\MongoDB\Server" -Recurse -Filter "mongod.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cand) { $mongodExe = $cand.FullName }
}
if (-not $cfgFile -or -not (Test-Path $cfgFile)) {
    $cand = Get-ChildItem (Split-Path -Parent $mongodExe) -Filter "mongod.cfg" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cand) { $cfgFile = $cand.FullName }
}
if (-not $mongodExe -or -not (Test-Path $mongodExe)) {
    Write-Host "[ERREUR] mongod.exe introuvable. Reinstallez MongoDB Community Server." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] mongod.exe : $mongodExe" -ForegroundColor Green
Write-Host "[INFO] Config      : $cfgFile"

# ------------------------------------------------------------
# 2. Dossiers data / log (depuis le cfg, sinon defauts standard)
# ------------------------------------------------------------
$binDir = Split-Path -Parent $mongodExe
$serverDir = Split-Path -Parent $binDir
$dataDir = Join-Path $serverDir "data"
$logDir = Join-Path $serverDir "log"
$logFile = Join-Path $logDir "mongod.log"
$mongoPort = 27017

if ($cfgFile -and (Test-Path $cfgFile)) {
    $cfgText = Get-Content $cfgFile -Raw
    if ($cfgText -match "dbPath:\s*'([^']+)'") { $dataDir = $Matches[1] }
    elseif ($cfgText -match 'dbPath:\s*"?([^\r\n"]+)"?') { $dataDir = $Matches[1].Trim() }
    if ($cfgText -match "systemLog:[\s\S]*?path:\s*'([^']+)'") { $logFile = $Matches[1] }
    elseif ($cfgText -match 'systemLog:[\s\S]*?path:\s*"?([^\r\n"]+)"?') { $logFile = $Matches[1].Trim() }
    if ($cfgText -match 'port:\s*(\d+)') { $mongoPort = [int]$Matches[1] }
}
Write-Host "[INFO] Dossier data : $dataDir"
Write-Host "[INFO] Fichier log  : $logFile"

if (-not (Test-Path $dataDir)) {
    Write-Host "[ERREUR] Le dossier de donnees est introuvable : $dataDir" -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------
# 3. Verification de l'espace disque (la reparation duplique les donnees)
# ------------------------------------------------------------
$dataSize = (Get-ChildItem $dataDir -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
if (-not $dataSize) { $dataSize = 0 }
$rootLetter = ([IO.Path]::GetPathRoot((Resolve-Path $dataDir).Path)).TrimEnd('\').TrimEnd(':')
$freeBytes = (Get-PSDrive -Name $rootLetter).Free
Write-Host ("[INFO] Taille des donnees : {0:N1} Go | Espace libre disque {1}: {2:N1} Go" -f ($dataSize / 1GB), $rootLetter, ($freeBytes / 1GB))

if ($freeBytes -lt ($dataSize * 1.1) -and -not $Forcer) {
    Write-Host "[ECHEC] Espace disque insuffisant pour reparer (il faut environ la taille des donnees en plus)." -ForegroundColor Red
    Write-Host "[SOLUTION] Liberez de l'espace disque puis relancez ce script, ou forcez avec -Forcer." -ForegroundColor Yellow
    exit 1
}

# ------------------------------------------------------------
# 4. Arret propre du service
# ------------------------------------------------------------
Write-Host "`n[ACTION] Arret du service $($svc.Name)..." -ForegroundColor Yellow
Stop-Service -Name $svc.Name -Force
$timeout = 45
while ($timeout -gt 0 -and (Get-Service -Name $svc.Name).Status -ne "Stopped") { Start-Sleep 1; $timeout-- }
if ((Get-Service -Name $svc.Name).Status -ne "Stopped") {
    Write-Host "[AVERTISSEMENT] Le service ne s'arrete pas, arret force du processus mongod..." -ForegroundColor Yellow
    taskkill /F /IM mongod.exe | Out-Null
    Start-Sleep 3
}
Write-Host "[OK] MongoDB arrete." -ForegroundColor Green

# ------------------------------------------------------------
# 5. Sauvegarde optionnelle avant reparation
# ------------------------------------------------------------
$backupDir = $null
if ($Sauvegarde) {
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backupDir = "${dataDir}_backup_$stamp"
    Write-Host "`n[ACTION] Sauvegarde des donnees vers : $backupDir ..." -ForegroundColor Yellow
    robocopy $dataDir $backupDir /E /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -lt 8) {
        Write-Host "[OK] Sauvegarde terminee." -ForegroundColor Green
    }
    else {
        Write-Host "[ECHEC] Sauvegarde incomplete (code $LASTEXITCODE). Reparation annulee par securite." -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "`n[INFO] Pas de sauvegarde demandee (l'option -Sauvegarde est recommandee)." -ForegroundColor Gray
}

# ------------------------------------------------------------
# 6. Reparation de la base
# ------------------------------------------------------------
# Suppression d'un eventuel dossier temporaire laisse par une
# reparation interrompue (cause connue de crash au redemarrage)
$tmpRepair = Get-ChildItem $dataDir -Directory -Filter "_tmp_repairDatabase_*" -ErrorAction SilentlyContinue
foreach ($d in $tmpRepair) {
    Write-Host "[INFO] Suppression du dossier temporaire obsolete : $($d.FullName)" -ForegroundColor Yellow
    Remove-Item $d.FullName -Recurse -Force
}

Write-Host "`n[ACTION] Lancement de la reparation (mongod --repair)..." -ForegroundColor Yellow
Write-Host "         Operation potentiellement longue selon la taille des donnees, patientez..." -ForegroundColor Gray
& $mongodExe --repair --config $cfgFile 2>&1 | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
$repairCode = $LASTEXITCODE
if ($repairCode -ne 0) {
    Write-Host "[ECHEC] La reparation a echoue (code $repairCode)." -ForegroundColor Red
    Show-ErreursLog $logFile
    Write-Host "[PISTE] Envoyez les messages ci-dessus au support : ils indiquent la cause exacte" -ForegroundColor Yellow
    Write-Host "        (corruption WiredTiger, incompatibilite de version, fichier illisible...)." -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Reparation terminee sans erreur." -ForegroundColor Green

# ------------------------------------------------------------
# 7. Redemarrage du service + verification du port
# ------------------------------------------------------------
Write-Host "`n[ACTION] Redemarrage du service $($svc.Name)..." -ForegroundColor Yellow
Start-Service -Name $svc.Name
$timeout = 60
while ($timeout -gt 0 -and (Get-Service -Name $svc.Name).Status -ne "Running") { Start-Sleep 1; $timeout-- }
Start-Sleep 3
$portOk = (Test-NetConnection -ComputerName 127.0.0.1 -Port $mongoPort -WarningAction SilentlyContinue).TcpTestSucceeded

if ((Get-Service -Name $svc.Name).Status -eq "Running" -and $portOk) {
    Write-Host "[OK] MongoDB tourne et repond sur le port $mongoPort !" -ForegroundColor Green
    Write-Titre " ETAPES SUIVANTES "
    Write-Host "  1) pm2 restart entreprise-system" -ForegroundColor White
    Write-Host "  2) powershell -ExecutionPolicy Bypass -File .\scripts\diagnostic-serveur.ps1" -ForegroundColor White
    Write-Host "     -> '[OK] L'application est bien connectee a la base de donnees.' attendu" -ForegroundColor Gray
    if ($backupDir) {
        Write-Host "`n[NOTE] Une fois tout valide, supprimez la sauvegarde pour recuperer l'espace :" -ForegroundColor Gray
        Write-Host "       Remove-Item '$backupDir' -Recurse -Force" -ForegroundColor Gray
    }
}
else {
    Write-Host "[ECHEC] Le service ne repond toujours pas apres reparation." -ForegroundColor Red
    Show-ErreursLog $logFile
    exit 1
}