# 一次性脚本：生成 GameMacro 应用图标。
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
            g.Clear(Color.Transparent);

            var tile = new RectangleF(sz * 0.045f, sz * 0.045f, sz * 0.91f, sz * 0.91f);
            using (var shadow = RoundedRect(new RectangleF(sz * 0.07f, sz * 0.085f, sz * 0.86f, sz * 0.86f), sz * 0.24f))
            using (var br = new SolidBrush(Color.FromArgb(70, 8, 16, 48)))
            {
                g.FillPath(br, shadow);
            }

            using (var bg = RoundedRect(tile, sz * 0.24f))
            using (var br = new LinearGradientBrush(tile,
                Color.FromArgb(255, 74, 86, 255),
                Color.FromArgb(255, 0, 163, 224), 135f))
            {
                var blend = new ColorBlend
                {
                    Positions = new[] { 0f, 0.58f, 1f },
                    Colors = new[]
                    {
                        Color.FromArgb(255, 96, 78, 255),
                        Color.FromArgb(255, 23, 94, 210),
                        Color.FromArgb(255, 0, 177, 210)
                    }
                };
                br.InterpolationColors = blend;
                g.FillPath(br, bg);
                using (var pen = new Pen(Color.FromArgb(105, 255, 255, 255), Math.Max(1f, sz * 0.012f)))
                {
                    g.DrawPath(pen, bg);
                }
            }

            // 宏录制轨迹：暗示自动化脚本和快捷连招。
            DrawMacroTrace(g, sz);

            using (var pad = GamepadPath(sz))
            using (var br = new LinearGradientBrush(
                new RectangleF(sz * 0.15f, sz * 0.34f, sz * 0.7f, sz * 0.43f),
                Color.FromArgb(255, 255, 255, 255),
                Color.FromArgb(255, 214, 232, 255), 90f))
            {
                g.FillPath(br, pad);
                using (var pen = new Pen(Color.FromArgb(205, 35, 70, 150), Math.Max(1f, sz * 0.018f)))
                {
                    g.DrawPath(pen, pad);
                }
            }

            DrawControls(g, sz);
            DrawBolt(g, sz);
        }
        return bmp;
    }

    private static GraphicsPath RoundedRect(RectangleF rect, float radius)
    {
        float d = radius * 2f;
        var path = new GraphicsPath();
        path.AddArc(rect.X, rect.Y, d, d, 180, 90);
        path.AddArc(rect.Right - d, rect.Y, d, d, 270, 90);
        path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
        path.AddArc(rect.X, rect.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }

    private static GraphicsPath GamepadPath(int sz)
    {
        float x = sz * 0.15f, y = sz * 0.36f, w = sz * 0.70f, h = sz * 0.36f;
        var path = new GraphicsPath();
        path.StartFigure();
        path.AddBezier(x + w * 0.20f, y, x + w * 0.08f, y, x, y + h * 0.21f, x, y + h * 0.47f);
        path.AddBezier(x, y + h * 0.47f, x, y + h * 0.96f, x + w * 0.18f, y + h * 1.06f, x + w * 0.34f, y + h * 0.78f);
        path.AddLine(x + w * 0.34f, y + h * 0.78f, x + w * 0.66f, y + h * 0.78f);
        path.AddBezier(x + w * 0.66f, y + h * 0.78f, x + w * 0.82f, y + h * 1.06f, x + w, y + h * 0.96f, x + w, y + h * 0.47f);
        path.AddBezier(x + w, y + h * 0.47f, x + w, y + h * 0.21f, x + w * 0.92f, y, x + w * 0.80f, y);
        path.AddBezier(x + w * 0.80f, y, x + w * 0.68f, y + h * 0.10f, x + w * 0.32f, y + h * 0.10f, x + w * 0.20f, y);
        path.CloseFigure();
        return path;
    }

    private static void DrawMacroTrace(Graphics g, int sz)
    {
        using (var pen = new Pen(Color.FromArgb(64, 255, 255, 255), Math.Max(1f, sz * 0.012f)))
        {
            pen.StartCap = LineCap.Round;
            pen.EndCap = LineCap.Round;
            pen.DashStyle = DashStyle.Dash;
            g.DrawBezier(pen, sz * 0.22f, sz * 0.29f, sz * 0.42f, sz * 0.17f, sz * 0.58f, sz * 0.85f, sz * 0.80f, sz * 0.68f);
        }

        using (var br = new SolidBrush(Color.FromArgb(92, 255, 255, 255)))
        {
            g.FillEllipse(br, sz * 0.205f, sz * 0.275f, sz * 0.045f, sz * 0.045f);
            g.FillEllipse(br, sz * 0.775f, sz * 0.655f, sz * 0.045f, sz * 0.045f);
        }
    }

    private static void DrawControls(Graphics g, int sz)
    {
        float unit = Math.Max(1f, sz * 0.035f);
        using (var br = new SolidBrush(Color.FromArgb(255, 35, 70, 150)))
        {
            g.FillRectangle(br, sz * 0.275f, sz * 0.515f, sz * 0.18f, unit);
            g.FillRectangle(br, sz * 0.345f, sz * 0.445f, unit, sz * 0.18f);
            g.FillEllipse(br, sz * 0.615f, sz * 0.475f, sz * 0.072f, sz * 0.072f);
            g.FillEllipse(br, sz * 0.705f, sz * 0.545f, sz * 0.072f, sz * 0.072f);
        }
    }

    private static void DrawBolt(Graphics g, int sz)
    {
        PointF[] pts = new[]
        {
            new PointF(sz * 0.535f, sz * 0.245f),
            new PointF(sz * 0.425f, sz * 0.535f),
            new PointF(sz * 0.525f, sz * 0.535f),
            new PointF(sz * 0.470f, sz * 0.765f),
            new PointF(sz * 0.645f, sz * 0.455f),
            new PointF(sz * 0.545f, sz * 0.455f),
        };

        using (var path = new GraphicsPath())
        {
            path.AddPolygon(pts);
            using (var pen = new Pen(Color.FromArgb(185, 145, 84, 0), Math.Max(1f, sz * 0.018f)))
            {
                pen.LineJoin = LineJoin.Round;
                g.DrawPath(pen, path);
            }
            using (var br = new LinearGradientBrush(
                new RectangleF(sz * 0.42f, sz * 0.24f, sz * 0.23f, sz * 0.53f),
                Color.FromArgb(255, 255, 236, 136),
                Color.FromArgb(255, 255, 165, 0), 90f))
            {
                g.FillPath(br, path);
            }
        }
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
