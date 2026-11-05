$ErrorActionPreference='Stop'
$root=Join-Path $env:TEMP ('BridgesUpdaterTest-'+[guid]::NewGuid().ToString('N'))
$source=Join-Path $root 'source';$target=Join-Path $root 'target'
New-Item -ItemType Directory -Path $source,$target | Out-Null
$script=(Resolve-Path (Join-Path $PSScriptRoot 'BridgesShopFloor/Update.ps1')).Path
function Write-Package([string]$folder,[string]$version){
 [IO.File]::WriteAllText((Join-Path $folder 'BridgesShopFloor.exe'),$version)
 [IO.File]::WriteAllText((Join-Path $folder 'app.dll'),$version)
}
function Launch-Updater([int]$seconds){
 $info=[Diagnostics.ProcessStartInfo]::new('powershell.exe');$info.UseShellExecute=$false;$info.CreateNoWindow=$true
 $info.Arguments='-NoProfile -ExecutionPolicy Bypass -File "'+$script+'" -AppPid 0 -Source "'+$source+'" -Target "'+$target+'" -NoLaunch -RetrySeconds '+$seconds
 return [Diagnostics.Process]::Start($info)
}
try {
 Write-Package $source 'new';Write-Package $target 'old'
 [IO.File]::WriteAllText((Join-Path $target 'user-notes.txt'),'keep')
 $handle=[IO.File]::Open((Join-Path $target 'app.dll'),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 try{
  $child=Launch-Updater 15;Start-Sleep -Seconds 3
  if($child.HasExited){throw 'Updater did not wait for the locked DLL.'}
 }finally{$handle.Dispose()}
 if(-not $child.WaitForExit(30000) -or $child.ExitCode -ne 0){throw 'Updater failed after file was unlocked.'}
 if([IO.File]::ReadAllText((Join-Path $target 'app.dll')) -ne 'new'){throw 'DLL was not updated.'}
 if([IO.File]::ReadAllText((Join-Path $target 'user-notes.txt')) -ne 'keep'){throw 'Unrelated file changed.'}
 Write-Package $source 'next'
 $handle=[IO.File]::Open((Join-Path $target 'app.dll'),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 try{
  $child=Launch-Updater 1
  if(-not $child.WaitForExit(30000) -or $child.ExitCode -eq 0){throw 'Updater did not reject a persistent file lock.'}
  if([IO.File]::ReadAllText((Join-Path $target 'BridgesShopFloor.exe')) -ne 'new'){throw 'Updater partially replaced files before lock checks finished.'}
 }finally{$handle.Dispose()}
 Write-Host 'PASS: transient lock retries, persistent lock leaves app untouched, unrelated files preserved.'
}finally{Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue}
