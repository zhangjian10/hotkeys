# 一次性脚本：生成应用图标。
# 输出：
#   - app.ico                       （多分辨率综合图标）
#   - src-tauri/icons/icon.ico
#   - src-tauri/icons/32x32.png
#   - src-tauri/icons/128x128.png
#   - src-tauri/icons/128x128@2x.png   （256x256）
#   - src-tauri/icons/icon.png         （Tauri 默认要求，512x512）
#
# 直接运行：powershell -NoProfile -ExecutionPolicy Bypass -File generate_icon.ps1

$src = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Collections.Generic;

public static class IconGen
{
    public static Bitmap Render(int sz)
    {
        var bmp = new Bitmap(sz, sz, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
            g.Clear(Color.Transparent);

            // 圆角矩形背景：深蓝渐变
            float r = sz * 0.22f;
            var rect = new RectangleF(sz * 0.04f, sz * 0.04f, sz * 0.92f, sz * 0.92f);
            using (var path = new GraphicsPath())
            {
                path.AddArc(rect.X, rect.Y, r * 2, r * 2, 180, 90);
                path.AddArc(rect.Right - r * 2, rect.Y, r * 2, r * 2, 270, 90);
                path.AddArc(rect.Right - r * 2, rect.Bottom - r * 2, r * 2, r * 2, 0, 90);
                path.AddArc(rect.X, rect.Bottom - r * 2, r * 2, r * 2, 90, 90);
                path.CloseFigure();
                using (var br = new LinearGradientBrush(rect,
                    Color.FromArgb(255, 60, 90, 170),
                    Color.FromArgb(255, 30, 50, 110), 90f))
                {
                    g.FillPath(br, path);
                }
                using (var pen = new Pen(Color.FromArgb(180, 20, 35, 80), Math.Max(1f, sz / 64f)))
                {
                    g.DrawPath(pen, path);
                }
            }

            // 中央键帽：白色圆角矩形
            float kw = sz * 0.58f, kh = sz * 0.58f;
            float kx = (sz - kw) / 2f, ky = (sz - kh) / 2f + sz * 0.02f;
            float kr = sz * 0.10f;
            var krect = new RectangleF(kx, ky, kw, kh);
            using (var path = new GraphicsPath())
            {
                path.AddArc(krect.X, krect.Y, kr * 2, kr * 2, 180, 90);
                path.AddArc(krect.Right - kr * 2, krect.Y, kr * 2, kr * 2, 270, 90);
                path.AddArc(krect.Right - kr * 2, krect.Bottom - kr * 2, kr * 2, kr * 2, 0, 90);
                path.AddArc(krect.X, krect.Bottom - kr * 2, kr * 2, kr * 2, 90, 90);
                path.CloseFigure();
                using (var br = new LinearGradientBrush(krect,
                    Color.FromArgb(255, 255, 255, 255),
                    Color.FromArgb(255, 215, 225, 245), 90f))
                {
                    g.FillPath(br, path);
                }
                using (var pen = new Pen(Color.FromArgb(220, 80, 100, 150), Math.Max(1f, sz / 96f)))
                {
                    g.DrawPath(pen, path);
                }
            }

            // 中央字符：H（hotkey）
            string txt = "H";
            float fontSize = sz * 0.42f;
            using (var fnt = new Font("Segoe UI", fontSize, FontStyle.Bold, GraphicsUnit.Pixel))
            {
                var sf = new StringFormat();
                sf.Alignment = StringAlignment.Center;
                sf.LineAlignment = StringAlignment.Center;
                var trect = new RectangleF(kx, ky + sz * 0.01f, kw, kh);
                using (var br = new SolidBrush(Color.FromArgb(255, 30, 50, 110)))
                {
                    g.DrawString(txt, fnt, br, trect, sf);
                }
            }
        }
        return bmp;
    }

    public static void SavePng(string path, int sz)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path));
        using (var bmp = Render(sz))
        {
            bmp.Save(path, ImageFormat.Png);
        }
    }

    public static void SaveIco(string path, int[] sizes)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path));
        var pngs = new List<byte[]>();
        foreach (var sz in sizes)
        {
            using (var bmp = Render(sz))
            using (var ms = new MemoryStream())
            {
                bmp.Save(ms, ImageFormat.Png);
                pngs.Add(ms.ToArray());
            }
        }

        using (var fs = new FileStream(path, FileMode.Create))
        using (var bw = new BinaryWriter(fs))
        {
            bw.Write((ushort)0);
            bw.Write((ushort)1);
            bw.Write((ushort)sizes.Length);
            int offset = 6 + 16 * sizes.Length;
            for (int i = 0; i < sizes.Length; i++)
            {
                int sz = sizes[i];
                byte sb = (byte)(sz >= 256 ? 0 : sz);
                bw.Write(sb);
                bw.Write(sb);
                bw.Write((byte)0);
                bw.Write((byte)0);
                bw.Write((ushort)1);
                bw.Write((ushort)32);
                bw.Write((uint)pngs[i].Length);
                bw.Write((uint)offset);
                offset += pngs[i].Length;
            }
            for (int i = 0; i < sizes.Length; i++)
            {
                bw.Write(pngs[i]);
            }
        }
    }
}
'@

Add-Type -TypeDefinition $src -ReferencedAssemblies System.Drawing -Language CSharp

$root = $PSScriptRoot
$tauriIcons = Join-Path $root 'src-tauri\icons'

# 多分辨率 ICO（综合）
[IconGen]::SaveIco((Join-Path $root 'app.ico'), @(256, 128, 64, 48, 32, 24, 16))
[IconGen]::SaveIco((Join-Path $tauriIcons 'icon.ico'), @(256, 128, 64, 48, 32, 24, 16))

# Tauri 需要的 PNG 尺寸
[IconGen]::SavePng((Join-Path $tauriIcons '32x32.png'), 32)
[IconGen]::SavePng((Join-Path $tauriIcons '128x128.png'), 128)
[IconGen]::SavePng((Join-Path $tauriIcons '128x128@2x.png'), 256)
[IconGen]::SavePng((Join-Path $tauriIcons 'icon.png'), 512)

Write-Host "icons saved under: $tauriIcons"
