# Apolline release - bump version + build signe + upload VPS + manifest
#
# Usage :
#   .\scripts\release.ps1 -Version 0.1.1 -Notes "Fix bug XYZ"
#   .\scripts\release.ps1 -Version 0.2.0 -Notes "Nouvelles fonctionnalites messagerie"
#
# Variables d'environnement requises :
#   $env:TAURI_SIGNING_PRIVATE_KEY      -> contenu de la cle privee Tauri (pas le chemin)
#   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -> mot de passe de la cle (vide si pas de mdp)
#   $env:APOLLINE_VPS_USER              -> utilisateur SSH du VPS (ex: 'root')
#   $env:APOLLINE_VPS_HOST              -> IP ou domaine du VPS
#   $env:APOLLINE_VPS_RELEASES_DIR      -> /opt/apolline-releases (par defaut)

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][string]$Notes
)

$ErrorActionPreference = 'Stop'

# Verifications prealables
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Error "Version doit etre au format X.Y.Z (ex: 0.1.1)"
    exit 1
}

if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
    Write-Error "Variable TAURI_SIGNING_PRIVATE_KEY non definie. Lance d'abord : `$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content ~/.tauri/apolline.key -Raw)"
    exit 1
}
if (-not $env:APOLLINE_VPS_USER -or -not $env:APOLLINE_VPS_HOST) {
    Write-Error "Variables APOLLINE_VPS_USER et APOLLINE_VPS_HOST requises"
    exit 1
}

$ReleasesDir = if ($env:APOLLINE_VPS_RELEASES_DIR) { $env:APOLLINE_VPS_RELEASES_DIR } else { '/opt/apolline-releases' }

Write-Host "------------------------------------------" -ForegroundColor Cyan
Write-Host "  Apolline release v$Version" -ForegroundColor Cyan
Write-Host "------------------------------------------" -ForegroundColor Cyan

# Helper : ecrit un fichier en UTF-8 SANS BOM (PowerShell 5 ajoute un BOM par defaut,
# ce qui casse PostCSS et Tauri qui parsent le JSON).
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
function Write-FileUtf8NoBom($path, $content) {
    [System.IO.File]::WriteAllText($path, $content, $Utf8NoBom)
}

# Bump version simple via regex (preserve l'encodage et le formatage du fichier original)
function Bump-JsonVersion($path, $version) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    # Strip BOM si present
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $bytes = $bytes[3..($bytes.Length - 1)]
    }
    $content = [System.Text.Encoding]::UTF8.GetString($bytes)
    $content = $content -replace '("version"\s*:\s*")[^"]+(")', ('${1}' + $version + '${2}')
    Write-FileUtf8NoBom $path $content
}

# 1. Bump version dans package.json
Write-Host "`n[1/6] Bump package.json -> $Version"
$pkgPath = Join-Path $PSScriptRoot '..\package.json'
Bump-JsonVersion $pkgPath $Version
Write-Host "    OK" -ForegroundColor Green

# 2. Bump version dans tauri.conf.json
Write-Host "`n[2/6] Bump tauri.conf.json -> $Version"
$confPath = Join-Path $PSScriptRoot '..\src-tauri\tauri.conf.json'
Bump-JsonVersion $confPath $Version
Write-Host "    OK" -ForegroundColor Green

# 3. Build signe
Write-Host "`n[3/6] Build Tauri (compile + sign)..." -ForegroundColor Yellow
Push-Location (Join-Path $PSScriptRoot '..')
try {
    npm run tauri:build
    if ($LASTEXITCODE -ne 0) { throw "tauri build a echoue" }
} finally {
    Pop-Location
}
Write-Host "    OK" -ForegroundColor Green

# 4. Localise les artefacts generes (Tauri 2.10+ : .msi + .msi.sig)
# Le projet override target-dir vers C:/apolline-build/target (cf. src-tauri/.cargo/config.toml)
# pour contourner les erreurs E0463 sur les chemins Windows avec espace.
$candidates = @(
    'C:/apolline-build/target/release/bundle/msi',
    (Join-Path $PSScriptRoot '..\src-tauri\target\release\bundle\msi')
)
$bundleDir = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $bundleDir) {
    Write-Error "Bundle MSI introuvable. Cherche dans : $($candidates -join ' ; ')"
    exit 1
}

Write-Host "    Bundle dir : $bundleDir"

$msiPattern = "Extrapol_${Version}_x64_*.msi"
$msiFile = Get-ChildItem -Path $bundleDir -Filter $msiPattern | Where-Object { $_.Extension -eq '.msi' } | Select-Object -First 1
$sigFile = Get-ChildItem -Path $bundleDir -Filter "$msiPattern.sig" | Select-Object -First 1

if (-not $msiFile -or -not $sigFile) {
    Write-Error "MSI ou signature pour la version $Version introuvables dans $bundleDir (pattern: $msiPattern). Verifie createUpdaterArtifacts dans tauri.conf.json et que le build a bien produit la nouvelle version."
    exit 1
}

Write-Host "    Artefact : $($msiFile.Name) ($([math]::Round($msiFile.Length / 1MB, 1)) MB)"
Write-Host "    Signature: $($sigFile.Name)"

# 5. Upload sur le VPS
Write-Host "`n[4/6] Upload sur le VPS (${env:APOLLINE_VPS_HOST})..." -ForegroundColor Yellow
$remotePath = "${env:APOLLINE_VPS_USER}@${env:APOLLINE_VPS_HOST}:${ReleasesDir}/"
scp $msiFile.FullName $sigFile.FullName $remotePath
if ($LASTEXITCODE -ne 0) { Write-Error "scp a echoue"; exit 1 }
Write-Host "    OK" -ForegroundColor Green

# 6. Genere le manifest latest.json
Write-Host "`n[5/6] Genere latest.json..."
$signature = Get-Content $sigFile.FullName -Raw
$signature = $signature.Trim()
$msiUrl = "https://updates.apolline.groupe-apolline.eu/$($msiFile.Name)"

$manifest = @{
    version    = $Version
    notes      = $Notes
    pub_date   = (Get-Date -Format 's') + 'Z'
    platforms  = @{
        'windows-x86_64' = @{
            signature = $signature
            url       = $msiUrl
        }
    }
}

$manifestPath = Join-Path $env:TEMP 'latest.json'
$manifestJson = $manifest | ConvertTo-Json -Depth 10
Write-FileUtf8NoBom $manifestPath $manifestJson

scp $manifestPath "${env:APOLLINE_VPS_USER}@${env:APOLLINE_VPS_HOST}:${ReleasesDir}/latest.json"
if ($LASTEXITCODE -ne 0) { Write-Error "scp manifest a echoue"; exit 1 }
Write-Host "    OK" -ForegroundColor Green

# 7. Recap
Write-Host "`n[6/6] Verification..."
Write-Host "    URL manifest : https://updates.apolline.groupe-apolline.eu/latest.json"
Write-Host "    URL bundle   : $msiUrl"

Write-Host "`n------------------------------------------" -ForegroundColor Green
Write-Host "  Release v$Version publiee OK" -ForegroundColor Green
Write-Host "------------------------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "Les apps installees chez les collabs verront la mise a jour"
Write-Host "dans les 5 secondes apres leur prochain demarrage."
Write-Host ""
Write-Host "Pense a committer les bumps de version (git add + commit)."
