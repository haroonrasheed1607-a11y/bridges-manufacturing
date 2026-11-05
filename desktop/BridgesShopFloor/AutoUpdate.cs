using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;
namespace BridgesShopFloor;
static class AutoUpdate {
 const string Release="https://api.github.com/repos/haroonrasheed1607-a11y/bridges-manufacturing/releases/tags/shop-floor-v1";
 public static async Task<bool> Check(Action<string> status){
  using var http=new HttpClient{Timeout=TimeSpan.FromMinutes(3)};http.DefaultRequestHeaders.UserAgent.ParseAdd("BridgesShopFloor/1.5");
  using var release=JsonDocument.Parse(await http.GetStringAsync(Release));
  var assets=release.RootElement.GetProperty("assets").EnumerateArray().ToArray();
  var manifest=assets.FirstOrDefault(a=>a.GetProperty("name").GetString()=="shop-floor-update.json");
  if(manifest.ValueKind==JsonValueKind.Undefined)return false;
  using var meta=JsonDocument.Parse(await http.GetStringAsync(manifest.GetProperty("browser_download_url").GetString()));
  var newer=Version.Parse(meta.RootElement.GetProperty("version").GetString()!);
  if(newer<=Assembly.GetExecutingAssembly().GetName().Version!)return false;
  var asset=assets.Single(a=>a.GetProperty("name").GetString()=="Bridges-Shop-Floor-Windows-x64.zip");
  string url=asset.GetProperty("browser_download_url").GetString()!;
  if(!url.StartsWith("https://github.com/haroonrasheed1607-a11y/bridges-manufacturing/releases/download/",StringComparison.Ordinal))throw new Exception("Untrusted update URL.");
  string folder=Path.Combine(Path.GetTempPath(),"BridgesUpdate-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(folder);
  status("Downloading update "+newer+"…");
  byte[] zip=await http.GetByteArrayAsync(url);
  string hash=Convert.ToHexString(SHA256.HashData(zip));
  if(!hash.Equals(meta.RootElement.GetProperty("sha256").GetString(),StringComparison.OrdinalIgnoreCase))throw new Exception("Update checksum mismatch; keeping current app.");
  string archive=Path.Combine(folder,"update.zip"),staged=Path.Combine(folder,"app");await File.WriteAllBytesAsync(archive,zip);ZipFile.ExtractToDirectory(archive,staged);
  string target=AppContext.BaseDirectory;
  string probe=Path.Combine(target,".update-write-test");File.WriteAllText(probe,"");File.Delete(probe);
  string script=Path.Combine(folder,"update.ps1");
  await File.WriteAllTextAsync(script,"""
param([int]$AppPid,[string]$Source,[string]$Target)
$ErrorActionPreference='Stop'
try {
 Wait-Process -Id $AppPid -ErrorAction SilentlyContinue
 $backup=Join-Path $env:TEMP ('BridgesBackup-'+[guid]::NewGuid().ToString('N'))
 New-Item -ItemType Directory $backup | Out-Null
 Copy-Item (Join-Path $Target '*') $backup -Recurse -Force
 try { Copy-Item (Join-Path $Source '*') $Target -Recurse -Force }
 catch { Copy-Item (Join-Path $backup '*') $Target -Recurse -Force; throw }
 Start-Process (Join-Path $Target 'BridgesShopFloor.exe')
} catch {
 Add-Type -AssemblyName System.Windows.Forms
 [System.Windows.Forms.MessageBox]::Show('Update failed. Your current app files were retained. Restart the app or download the latest ZIP. '+$_.Exception.Message,'Bridges update')
}
""");
  var start=new ProcessStartInfo("powershell.exe"){UseShellExecute=false,CreateNoWindow=true};
  foreach(var arg in new[]{"-NoProfile","-ExecutionPolicy","Bypass","-File",script,"-AppPid",Environment.ProcessId.ToString(),"-Source",staged,"-Target",target})start.ArgumentList.Add(arg);
  _ = Process.Start(start)??throw new Exception("Unable to start updater.");
  return true;
 }
}
