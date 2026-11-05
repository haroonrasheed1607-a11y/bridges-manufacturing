param([int]$AppPid,[string]$Source,[string]$Target,[switch]$NoLaunch,[int]$RetrySeconds=60)
$ErrorActionPreference='Stop'
$changed=New-Object 'System.Collections.Generic.List[object]'
$backup=$null
function Invoke-Retry([scriptblock]$Action){
 $deadline=[DateTime]::UtcNow.AddSeconds($RetrySeconds)
 while($true){try{& $Action;return}catch{if([DateTime]::UtcNow -ge $deadline){throw};Start-Sleep -Milliseconds 500}}
}
try {
 $Source=[IO.Path]::GetFullPath($Source).TrimEnd([IO.Path]::DirectorySeparatorChar)
 $Target=[IO.Path]::GetFullPath($Target).TrimEnd([IO.Path]::DirectorySeparatorChar)
 if($Source -eq $Target){throw 'The update source must be a separate staging folder.'}
 $exe=Join-Path $Target 'BridgesShopFloor.exe'
 if(-not (Test-Path -LiteralPath (Join-Path $Source 'BridgesShopFloor.exe'))){throw 'Update package does not contain the app.'}
 if($AppPid -gt 0){$old=Get-Process -Id $AppPid -ErrorAction SilentlyContinue;if($old -and -not $old.WaitForExit(90000)){throw 'The running app did not close. Close it before retrying.'}}
 $files=@(Get-ChildItem -LiteralPath $Source -File -Recurse)
 # Wait for every copy running from this installation. Never terminate other apps or WebView2 processes.
 Invoke-Retry {
  $other=@(Get-Process -Name BridgesShopFloor -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq $exe})
  if($other.Count -gt 0){throw 'Another Bridges Shop Floor window is still open. Close all copies and retry.'}
  foreach($file in $files){
   $relative=$file.FullName.Substring($Source.Length).TrimStart([char[]]'\/')
   $destination=Join-Path $Target $relative
   if(Test-Path -LiteralPath $destination){$handle=[IO.File]::Open($destination,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$handle.Dispose()}
  }
 }
 $backup=Join-Path $env:TEMP ('BridgesBackup-'+[guid]::NewGuid().ToString('N'))
 New-Item -ItemType Directory -Path $backup | Out-Null
 # Back up only package files, leaving unrelated user files untouched.
 foreach($file in $files){
  $relative=$file.FullName.Substring($Source.Length).TrimStart([char[]]'\/')
  $destination=Join-Path $Target $relative;$copy=Join-Path $backup $relative
  if(Test-Path -LiteralPath $destination){New-Item -ItemType Directory -Force -Path (Split-Path $copy) | Out-Null;Invoke-Retry {Copy-Item -LiteralPath $destination -Destination $copy -Force}}
 }
 foreach($file in $files){
  $relative=$file.FullName.Substring($Source.Length).TrimStart([char[]]'\/')
  $destination=Join-Path $Target $relative;$copy=Join-Path $backup $relative
  New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
  $changed.Add(@{destination=$destination;backup=$copy;existed=(Test-Path -LiteralPath $copy)})
  Invoke-Retry {Copy-Item -LiteralPath $file.FullName -Destination $destination -Force}
 }
 if(-not $NoLaunch){Start-Process -FilePath $exe}
 exit 0
} catch {
 $failure=$_.Exception.Message;$recovery=New-Object 'System.Collections.Generic.List[string]'
 foreach($item in $changed){try{if($item.existed){Invoke-Retry {Copy-Item -LiteralPath $item.backup -Destination $item.destination -Force}}else{Invoke-Retry {if(Test-Path -LiteralPath $item.destination){Remove-Item -LiteralPath $item.destination -Force}}}}catch{$recovery.Add($_.Exception.Message)}}
 $state=if($changed.Count -eq 0){'No app files were replaced.'}elseif($recovery.Count -eq 0){'Previous app files were restored.'}else{'Some files could not be restored. Extract the latest download into a new folder before running it.'}
 $message='Update could not finish. '+$state+' Close every BridgesShopFloor.exe in Task Manager and retry. '+$failure
 if($backup){$message+=' Backup: '+$backup}
 if($NoLaunch){Write-Error $message -ErrorAction Continue}else{Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.MessageBox]::Show($message,'Bridges update') | Out-Null}
 exit 1
}
