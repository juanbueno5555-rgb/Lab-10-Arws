# Lanza N ejecuciones de newman en paralelo y resume el resultado.
#
# Requisitos:
#   npm install -g newman
#
# Uso:
#   pwsh -File run-concurrent.ps1
#   pwsh -File run-concurrent.ps1 -Runs 4
#
# Antes de ejecutarlo, ajuste `functionApp` en el archivo de entorno.

[CmdletBinding()]
param(
    [int]$Runs = 10,
    [int]$Iterations = 1,
    [string]$Collection = "ARSW_LOAD-BALANCING_AZURE_II.postman_collection.json",
    [string]$Environment = "[ARSW_LOAD-BALANCING_AZURE_II].postman_environment.json",
    [string]$ReportDir = "reports"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command newman -ErrorAction SilentlyContinue)) {
    throw "newman no está instalado. Ejecute: npm install -g newman"
}

$collectionPath = Join-Path $PSScriptRoot $Collection
$environmentPath = Join-Path $PSScriptRoot $Environment

if (-not (Test-Path -LiteralPath $collectionPath)) {
    throw "No se encontró la colección: $collectionPath"
}
if (-not (Test-Path -LiteralPath $environmentPath)) {
    throw "No se encontró el entorno: $environmentPath"
}

$reportsPath = Join-Path $PSScriptRoot $ReportDir
if (Test-Path -LiteralPath $reportsPath) {
    Remove-Item -LiteralPath $reportsPath -Recurse -Force
}
New-Item -ItemType Directory -Path $reportsPath | Out-Null

Write-Host "Lanzando $Runs ejecuciones concurrentes de newman..." -ForegroundColor Cyan

$processes = @()
for ($i = 1; $i -le $Runs; $i++) {
    $reportFile = Join-Path $reportsPath ("run-{0:D2}.json" -f $i)
    $logFile = Join-Path $reportsPath ("run-{0:D2}.log" -f $i)

    $argumentList = @(
        "run", $collectionPath,
        "-e", $environmentPath,
        "-n", "$Iterations",
        "--reporters", "json",
        "--reporter-json-export", $reportFile
    )

    $processes += Start-Process -FilePath "newman" `
        -ArgumentList $argumentList `
        -NoNewWindow `
        -PassThru `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError "$logFile.err"
}

$processes | Wait-Process

Write-Host "Resumen:" -ForegroundColor Cyan
node (Join-Path $PSScriptRoot "resumen.js") $reportsPath
