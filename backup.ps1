# ============================================================
#  EDI_AUTOMATION — Auto Backup Script
#  Saves: frontend/src + node-backend (source only)
#  Location: EDI_AUTOMATION_BACKUPS\ next to the project folder
#  Keeps: Last 10 backups
# ============================================================

$ProjectRoot  = $PSScriptRoot
$BackupRoot   = Join-Path (Split-Path $PSScriptRoot -Parent) "EDI_AUTOMATION_BACKUPS"
$Timestamp    = Get-Date -Format "yyyy-MM-dd_HH-mm"
$BackupPath   = Join-Path $BackupRoot "backup_$Timestamp"
$ZipPath      = "$BackupPath.zip"
$MaxBackups   = 10

$IncludeFolders = @(
    "frontend\src",
    "node-backend\models",
    "node-backend\routes",
    "node-backend\utils",
    "node-backend\middleware",
    "node-backend\migrations",
    "node-backend\server.js",
    "node-backend\db.js",
    "node-backend\database.sqlite",
    "node-backend\package.json",
    "frontend\package.json",
    "frontend\vite.config.js",
    "frontend\index.html"
)

Write-Host "========================================"
Write-Host " EDI AUTOMATION — AUTO BACKUP"
Write-Host " Time: $(Get-Date -Format 'dd-MMM-yyyy HH:mm')"
Write-Host "========================================"

if (-not (Test-Path $BackupRoot)) { New-Item -ItemType Directory -Path $BackupRoot | Out-Null }
New-Item -ItemType Directory -Path $BackupPath | Out-Null

foreach ($item in $IncludeFolders) {
    $src = Join-Path $ProjectRoot $item
    if (-not (Test-Path $src)) { continue }
    $dst = Join-Path $BackupPath $item
    $dstParent = Split-Path $dst -Parent
    if (-not (Test-Path $dstParent)) { New-Item -ItemType Directory -Path $dstParent -Force | Out-Null }

    if (Test-Path $src -PathType Container) {
        robocopy $src $dst /E /XD node_modules dist .vite .git /XF "*.log" "*.db-shm" "*.db-wal" /NJH /NJS /NFL /NDL /NC /NS /NP | Out-Null
    } else {
        Copy-Item -Path $src -Destination $dst -Force
    }
    Write-Host "[+] $item"
}

Write-Host "[~] Compressing..."
Compress-Archive -Path "$BackupPath\*" -DestinationPath $ZipPath -CompressionLevel Optimal
Remove-Item -Path $BackupPath -Recurse -Force

$zipSize = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
Write-Host "[+] ZIP: $ZipPath ($zipSize MB)"

# Delete old — keep last 10
$allBackups = Get-ChildItem -Path $BackupRoot -Filter "backup_*.zip" | Sort-Object LastWriteTime -Descending
if ($allBackups.Count -gt $MaxBackups) {
    $toDelete = $allBackups | Select-Object -Skip $MaxBackups
    foreach ($old in $toDelete) { Remove-Item $old.FullName -Force; Write-Host "[-] Deleted: $($old.Name)" }
}

Write-Host "========================================"
Write-Host " BACKUP COMPLETE! Total: $($allBackups.Count) backup(s)"
Write-Host "========================================"


