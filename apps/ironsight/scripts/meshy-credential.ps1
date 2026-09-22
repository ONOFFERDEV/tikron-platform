[CmdletBinding()]
param(
  [switch]$Probe,
  [Parameter(Position = 0)]
  [string]$EntryPoint,
  [string]$ConfigPath = 'config/ww1-meshy.json',
  [string]$Only,
  [string]$Asset,
  [string]$Stage,
  [string]$OutputPath = 'artifacts/ww1',
  [string]$TestCredentialPath,
  [string]$TestResultPath,
  [switch]$ForceChildFailure
)

$ErrorActionPreference = 'Stop'
$AppRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$TrustedNode = 'C:\Program Files\nodejs\node.exe'
$RealSecretPath = 'C:\Users\User\.codex\secrets\ironsight-meshy-20260911.clixml'
$TestMode = $env:MESHY_WRAPPER_TEST_MODE -eq '1'

if ($Probe) {
  [pscustomobject]@{
    credentialPathExists = Test-Path -LiteralPath $RealSecretPath -PathType Leaf
    legacyFallbackEnabled = $false
    trustedNodePath = $TrustedNode
    appRoot = $AppRoot
  } | ConvertTo-Json -Compress
  exit 0
}

$EntryRelative = switch ($EntryPoint) {
  'tools/meshy-generate.mjs' { 'tools\meshy-generate.mjs' }
  'tools/meshy-batch.mjs' { 'tools\meshy-batch.mjs' }
  'test/meshy-wrapper-child.fixture.mjs' { if ($TestMode) { 'test\meshy-wrapper-child.fixture.mjs' } else { throw 'The fixture child is disabled.' } }
  default { throw 'The credential wrapper only launches approved absolute entry points.' }
}
$EntryPath = [IO.Path]::GetFullPath((Join-Path $AppRoot $EntryRelative))
$TrustedPrefix = $AppRoot.TrimEnd('\') + '\'
if (-not $EntryPath.StartsWith($TrustedPrefix, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $EntryPath -PathType Leaf)) {
  throw 'The approved Meshy entry point is missing or outside the application root.'
}
if (-not (Test-Path -LiteralPath $TrustedNode -PathType Leaf)) {
  throw 'The trusted absolute Node executable is missing.'
}

if ($TestMode) {
  if ([string]::IsNullOrWhiteSpace($TestCredentialPath) -or [string]::IsNullOrWhiteSpace($TestResultPath)) { throw 'Wrapper test mode requires isolated credential and result paths.' }
  $SecretPath = [IO.Path]::GetFullPath($TestCredentialPath)
  $CredentialSource = 'ironsight-meshy-fixture'
  $NodeArguments = @($EntryPath, '--result', [IO.Path]::GetFullPath($TestResultPath))
  if ($ForceChildFailure) { $NodeArguments += '--fail' }
} else {
  $SecretPath = $RealSecretPath
  $CredentialSource = 'ironsight-meshy-20260911'
  $ResolvedConfig = [IO.Path]::GetFullPath((Join-Path $AppRoot $ConfigPath))
  $ResolvedOutput = [IO.Path]::GetFullPath((Join-Path $AppRoot $OutputPath))
  if ($ResolvedConfig -ne (Join-Path $AppRoot 'config\ww1-meshy.json') -or $ResolvedOutput -ne (Join-Path $AppRoot 'artifacts\ww1')) { throw 'Real credential mode requires canonical config and journal paths.' }
  $NodeArguments = @($EntryPath, '--config', $ResolvedConfig, '--out', $ResolvedOutput)
  if (-not [string]::IsNullOrWhiteSpace($Only)) { $NodeArguments += @('--only', $Only) }
  if (-not [string]::IsNullOrWhiteSpace($Asset)) { $NodeArguments += @('--asset', $Asset) }
  if (-not [string]::IsNullOrWhiteSpace($Stage)) { $NodeArguments += @('--stage', $Stage) }
}
if (-not (Test-Path -LiteralPath $SecretPath -PathType Leaf)) { throw 'The selected Meshy credential file is missing.' }

function ConvertFrom-SecretValue {
  param([Parameter(Mandatory = $true)]$Value)
  if ($Value -is [System.Management.Automation.PSCredential]) { return $Value.GetNetworkCredential().Password }
  if ($Value -is [System.Security.SecureString]) {
    $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer) }
  }
  if ($Value.PSObject.Properties.Name -contains 'ApiKey') { return ConvertFrom-SecretValue -Value $Value.ApiKey }
  throw 'The project Meshy credential has an unsupported encrypted shape.'
}

$Imported = Import-Clixml -LiteralPath $SecretPath
$Plaintext = ConvertFrom-SecretValue -Value $Imported
if ([string]::IsNullOrWhiteSpace($Plaintext)) { throw 'The project Meshy credential is empty.' }

try {
  if (-not $TestMode) { Remove-Item Env:MESHY_FIXTURE_MODE -ErrorAction SilentlyContinue }
  $env:MESHY_API_KEY = $Plaintext
  $env:MESHY_CREDENTIAL_SOURCE = $CredentialSource
  Push-Location -LiteralPath $AppRoot
  try { & $TrustedNode @NodeArguments; $ChildExitCode = $LASTEXITCODE }
  finally { Pop-Location }
}
finally {
  Remove-Item Env:MESHY_API_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:MESHY_CREDENTIAL_SOURCE -ErrorAction SilentlyContinue
  $Plaintext = $null
  $Imported = $null
  if ($TestMode -and -not [string]::IsNullOrWhiteSpace($TestResultPath)) {
    $ResultPath = [IO.Path]::GetFullPath($TestResultPath)
    $Result = if (Test-Path -LiteralPath $ResultPath) { Get-Content -Raw -LiteralPath $ResultPath | ConvertFrom-Json } else { [pscustomobject]@{} }
    $Result | Add-Member -NotePropertyName keyPresentAfterCleanup -NotePropertyValue (Test-Path Env:MESHY_API_KEY) -Force
    $Result | Add-Member -NotePropertyName sourcePresentAfterCleanup -NotePropertyValue (Test-Path Env:MESHY_CREDENTIAL_SOURCE) -Force
    [IO.File]::WriteAllText($ResultPath, ($Result | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
  }
  [GC]::Collect()
}
if ($ChildExitCode -ne 0) { exit $ChildExitCode }
