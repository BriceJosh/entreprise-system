# Script de sauvegarde automatique de la base MongoDB locale
# A planifier quotidiennement avec le Planificateur de tâches Windows Server

$BackupDir = "C:\Backups\MongoDB"
$DateStr = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$TargetFolder = "$BackupDir\backup_$DateStr"

# Créer le dossier de sauvegarde s'il n'existe pas
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Host "📦 Début du backup MongoDB vers $TargetFolder ..." -ForegroundColor Cyan

# Exécution de mongodump (vérifiez le chemin de mongodump si pas dans le PATH)
& mongodump --uri="mongodb://127.0.0.1:27017/entreprise_db?replicaSet=rs0&directConnection=true" --out="$TargetFolder"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Sauvegarde réussie !" -ForegroundColor Green
    
    # Nettoyage des sauvegardes de plus de 30 jours
    Get-ChildItem -Path $BackupDir -Directory | Where-Object {
        $_.CreationTime -lt (Get-Date).AddDays(-30)
    } | Remove-Item -Recurse -Force
    Write-Host "🧹 Nettoyage des sauvegardes de plus de 30 jours effectué." -ForegroundColor Gray
} else {
    Write-Host "❌ Erreur lors de la sauvegarde MongoDB !" -ForegroundColor Red
}
