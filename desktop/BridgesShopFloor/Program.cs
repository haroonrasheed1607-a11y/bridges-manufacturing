using System.Drawing.Printing;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace BridgesShopFloor;
static class Program {
 [STAThread] static void Main(){ApplicationConfiguration.Initialize();Application.Run(new ShopFloor());}
}
sealed class ShopFloor : Form {
 const string Origin="https://bridges-manufacturing.haroonrasheed1607.workers.dev";
 readonly WebView2 web=new(){Dock=DockStyle.Fill};
 readonly ComboBox printers=new(){DropDownStyle=ComboBoxStyle.DropDownList,Width=220};
 readonly ToolStripStatusLabel status=new("Connecting…");
 readonly string directory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"BridgesShopFloor");
 bool printing;
 public ShopFloor(){
  Text="Bridges Shop Floor · QL-800";Width=680;Height=850;MinimumSize=new(480,600);
  var tools=new FlowLayoutPanel{Dock=DockStyle.Top,Height=48,Padding=new(6)};
  var refresh=new Button{Text="Reload",AutoSize=true};refresh.Click+=(_,_)=>web.Reload();
  var test=new Button{Text="Test printer",AutoSize=true};test.Click+=(_,_)=>TestPrinter();
  tools.Controls.AddRange([new Label{Text="Printer",AutoSize=true,Padding=new(0,7,0,0)},printers,test,refresh]);
  var strip=new StatusStrip();strip.Items.Add(status);Controls.Add(web);Controls.Add(tools);Controls.Add(strip);
  Directory.CreateDirectory(directory);
  foreach(string name in PrinterSettings.InstalledPrinters)if(name.Contains("QL-800",StringComparison.OrdinalIgnoreCase))printers.Items.Add(name);
  string saved=File.Exists(Path.Combine(directory,"printer.txt"))?File.ReadAllText(Path.Combine(directory,"printer.txt")):"";
  if(printers.Items.Count>0)printers.SelectedIndex=Math.Max(0,printers.Items.IndexOf(saved));
  printers.SelectedIndexChanged+=(_,_)=>File.WriteAllText(Path.Combine(directory,"printer.txt"),printers.Text);
  Shown+=async(_,_)=>await Start();
 }
 static bool Trusted(string source)=>Uri.TryCreate(source,UriKind.Absolute,out var uri)&&uri.GetLeftPart(UriPartial.Authority)==Origin;
 async Task Start(){try{
  var env=await CoreWebView2Environment.CreateAsync(null,Path.Combine(directory,"Browser"));
  await web.EnsureCoreWebView2Async(env);
  web.CoreWebView2.Settings.AreDevToolsEnabled=false;
  web.CoreWebView2.Settings.AreDefaultContextMenusEnabled=false;
  web.CoreWebView2.NavigationStarting+=(_,e)=>{if(!Trusted(e.Uri)){e.Cancel=true;status.Text="External navigation blocked.";}};
  web.CoreWebView2.NewWindowRequested+=(_,e)=>e.Handled=true;
  web.CoreWebView2.PermissionRequested+=(_,e)=>e.State=CoreWebView2PermissionState.Deny;
  web.CoreWebView2.WebMessageReceived+=Receive;
  await web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("if(location.origin==='"+Origin+"'){Object.defineProperty(window,'bridgesDesktop',{value:Object.freeze({version:1})});}");
  web.CoreWebView2.NavigationCompleted+=(_,e)=>status.Text=e.IsSuccess?"Ready · select boxer or scanner to begin":"Connection failed · check internet and Reload";
  web.Source=new Uri(Origin);
 }catch(Exception ex){MessageBox.Show("Install Microsoft Edge WebView2 Runtime, then restart.\n\n"+ex.Message,"Unable to start");}}
 void Receive(object? sender,CoreWebView2WebMessageReceivedEventArgs e){
  if(!Trusted(e.Source)||!Trusted(web.Source?.AbsoluteUri??""))return;
  try{
   if(e.WebMessageAsJson.Length>16000)throw new Exception("Label too large.");
   using var message=JsonDocument.Parse(e.WebMessageAsJson);var m=message.RootElement;
   if(m.GetProperty("type").GetString()!="bridges.print-box")return;
   var matrix=m.GetProperty("matrix").EnumerateArray().Select(r=>r.EnumerateArray().Select(c=>c.GetBoolean()).ToArray()).ToArray();
   if(matrix.Length!=25||matrix.Any(r=>r.Length!=25))throw new Exception("Invalid QR code.");
   string Read(string key,int max=160){var s=m.GetProperty(key).GetString()??"";if(s.Length>max||s.Any(char.IsControl))throw new Exception("Invalid label text.");return s;}
   string[] lines=[Read("person"),Read("orderTitle"),Read("orderId")+" / "+Read("workId"),Read("job")+" · "+Read("quantity",12)+" pcs",Read("boxId",32)];
   Print(lines,matrix);
  }catch(Exception ex){status.Text="Print failed · box remains saved";MessageBox.Show(ex.Message+"\nUse Reprint label after correcting the printer. Do not create a second box.","Printing failed");}
 }
 void Print(string[] lines,bool[][]? matrix){
  if(printing)throw new Exception("Printer busy. Wait before reprinting.");
  if(printers.SelectedItem is not string printer)throw new Exception("Install the Brother QL-800 driver and restart this app.");
  printing=true;
  try{
   using var doc=new PrintDocument();doc.PrinterSettings.PrinterName=printer;
   if(!doc.PrinterSettings.IsValid)throw new Exception("Selected QL-800 is unavailable.");
   doc.DocumentName="Bridges box label";doc.PrintController=new StandardPrintController();
   using var normal=new Font("Arial",8f);using var bold=new Font("Arial",9f,FontStyle.Bold);using var code=new Font("Consolas",6.5f);
   using var format=new StringFormat{Trimming=StringTrimming.EllipsisCharacter,FormatFlags=0};
   using var measure=doc.PrinterSettings.CreateMeasurementGraphics();measure.PageUnit=GraphicsUnit.Display;
   var heights=lines.Select((line,i)=>Math.Min(27f,Math.Max(14f,(float)Math.Ceiling(measure.MeasureString(line,i==0?bold:i==4?code:normal,133,format).Height)+2))).ToArray();
   int labelHeight=(int)Math.Ceiling(Math.Max(108f,heights.Sum()+20f));
   doc.DefaultPageSettings.PaperSize=new PaperSize("Bridges 62 mm auto length",244,labelHeight);
   doc.DefaultPageSettings.Margins=new Margins(0,0,0,0);doc.DefaultPageSettings.Landscape=false;
   doc.PrintPage+=(_,e)=>{
    var g=e.Graphics!;g.PageUnit=GraphicsUnit.Display;
    g.TranslateTransform(-e.PageSettings.HardMarginX,-e.PageSettings.HardMarginY);
    g.FillRectangle(Brushes.White,0,0,244,labelHeight);
    // 62 mm stock, 58 mm printable area. Integer 300-dpi module size: 8 dots.
    const float module=8f/3f;const float left=9f;float top=(labelHeight-88f)/2;
    if(matrix!=null)for(int y=0;y<25;y++)for(int x=0;x<25;x++)if(matrix[y][x])g.FillRectangle(Brushes.Black,left+(x+4)*module,top+(y+4)*module,module,module);
    float textY=10;
    for(int i=0;i<lines.Length;i++){
     g.DrawString(lines[i],i==0?bold:i==4?code:normal,Brushes.Black,new RectangleF(100,textY,133,heights[i]),format);
     textY+=heights[i];
    }
    e.HasMorePages=false;
   };
   doc.Print();status.Text="Sent to "+printer+" · "+lines[^1];
  }finally{printing=false;}
 }
 void TestPrinter(){try{Print(["BRIDGES SHOP FLOOR","QL-800 test label","62 mm · auto length","Check roll size and cutter","TEST — not a production box"],null);}catch(Exception ex){MessageBox.Show(ex.Message,"Printer test");}}
}
