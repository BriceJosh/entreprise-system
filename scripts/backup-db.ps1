# Script de sauvegarde automatique de la base MongoDB locale
# A planifier quotidiennement avec le Planificateur de taches Windows Server

$BackupDir = "C:\Backups\MongoDB"
$DateStr = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$TargetFolder = "$BackupDir\backup_$DateStr"

# Creer le dossier de sauvegarde s'il n'existe pas
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Host "[INFO] Debut du backup MongoDB vers $TargetFolder ..." -ForegroundColor Cyan

# Execution de mongodump (verifiez le chemin de mongodump si pas dans le PATH)
& mongodump --uri="mongodb://127.0.0.1:27017/entreprise_db?replicaSet=rs0&directConnection=true" --out="$TargetFolder"

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Sauvegarde reussie !" -ForegroundColor Green

    # Nettoyage des sauvegardes de plus de 30 jours
    Get-ChildItem -Path $BackupDir -Directory | Where-Object {
        $_.CreationTime -lt (Get-Date).AddDays(-30)
    } | Remove-Item -Recurse -Force
    Write-Host "[OK] Nettoyage des sauvegardes de plus de 30 jours effectue." -ForegroundColor Gray
}
else {
    Write-Host "[ERREUR] Echec lors de la sauvegarde MongoDB !" -ForegroundColor Red
}
