# Télécharge le binaire PocketBase (version figée) pour Windows et l'installe
# dans src-tauri/binaries/ avec le nom attendu par le sidecar Tauri (triplet de
# cible). Pendant Windows du script fetch-pocketbase.sh. Joué en CI (runner
# windows-latest) avant `pnpm tauri build`.
#
# Usage : pwsh ./scripts/fetch-pocketbase.ps1

$ErrorActionPreference = "Stop"

# Version figée de PocketBase (pré-1.0 : ne monter qu'après lecture du changelog).
$PB_VERSION = "0.39.1"

$Root = Split-Path -Parent $PSScriptRoot
$DestDir = Join-Path $Root "src-tauri\binaries"
New-Item -ItemType Directory -Force -Path $DestDir | Out-Null

# Cible Windows amd64 (triplet MSVC attendu par Tauri).
$Triple = "x86_64-pc-windows-msvc"
$BinName = "pocketbase-$Triple.exe"
$DestBin = Join-Path $DestDir $BinName

if (Test-Path $DestBin) {
    Write-Host "PocketBase déjà présent : $DestBin"
    exit 0
}

$Zip = "pocketbase_${PB_VERSION}_windows_amd64.zip"
$Url = "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${Zip}"

Write-Host "Téléchargement de PocketBase v$PB_VERSION (windows amd64)…"
$Tmp = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force -Path $Tmp | Out-Null
try {
    $ZipPath = Join-Path $Tmp "pb.zip"
    Invoke-WebRequest -Uri $Url -OutFile $ZipPath
    Expand-Archive -Path $ZipPath -DestinationPath $Tmp -Force
    Move-Item -Path (Join-Path $Tmp "pocketbase.exe") -Destination $DestBin -Force
    Write-Host "Installé : $DestBin"
}
finally {
    Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
