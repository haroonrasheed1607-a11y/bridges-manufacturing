using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;

namespace BridgesShopFloor;

// Foreground Raw Input keeps the scanner independent of WebView control focus.
sealed class AttendanceScanner
{
    const int RawInputMessage = 0x00FF;
    readonly StringBuilder buffer = new();
    IntPtr device;
    long lastKey;
    public bool Enabled { get; set; }
    public bool Pairing { get; set; }
    public bool Paired => device != IntPtr.Zero;

    [StructLayout(LayoutKind.Sequential)]
    struct Registration
    {
        public ushort Page, Usage;
        public uint Flags;
        public IntPtr Window;
    }

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool RegisterRawInputDevices(Registration[] devices, uint count, uint size);

    [DllImport("user32.dll")]
    static extern uint GetRawInputData(IntPtr input, uint command, byte[] data, ref uint size, uint headerSize);

    public bool Register(IntPtr window) =>
        RegisterRawInputDevices([new() { Page = 1, Usage = 6, Window = window }], 1,
            (uint)Marshal.SizeOf<Registration>());

    public void Reset() => buffer.Clear();

    public void Receive(Message message, Action paired, Action<string> scanned)
    {
        if (message.Msg != RawInputMessage || !Enabled || (!Pairing && !Paired)) return;
        uint header = (uint)(8 + 2 * IntPtr.Size);
        var data = new byte[64];
        uint size = (uint)data.Length;
        uint read = GetRawInputData(message.LParam, 0x10000003, data, ref size, header);
        if (read == uint.MaxValue || read < header + 16 || BitConverter.ToUInt32(data, 0) != 1) return;
        var source = IntPtr.Size == 8 ? new IntPtr(BitConverter.ToInt64(data, 8)) : new IntPtr(BitConverter.ToInt32(data, 8));
        if (source == IntPtr.Zero || (!Pairing && source != device)) return;
        int offset = (int)header;
        if ((BitConverter.ToUInt16(data, offset + 2) & 1) != 0) return;
        ushort key = BitConverter.ToUInt16(data, offset + 6);
        if (key is 0x10 or 0xA0 or 0xA1) return;
        long now = Environment.TickCount64;
        if (now - lastKey > 350 || (Pairing && source != candidate)) buffer.Clear();
        candidate = source;
        lastKey = now;
        if (key == 13)
        {
            string code = buffer.ToString();
            buffer.Clear();
            if (!Regex.IsMatch(code, @"\A(?:IND-[A-F0-9]{16}|ATT-[A-F0-9]{32})\z")) return;
            if (Pairing)
            {
                device = source;
                Pairing = false;
                paired();
            }
            else scanned(code);
            return;
        }
        if (buffer.Length >= 36) { buffer.Clear(); return; }
        if (key is >= 48 and <= 57 or >= 65 and <= 90) buffer.Append((char)key);
        else if (key is 0xBD or 0x6D) buffer.Append('-');
        else buffer.Clear();
    }

    IntPtr candidate;
}
