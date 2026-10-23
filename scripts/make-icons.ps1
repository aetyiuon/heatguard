param([string]$OutDir = (Join-Path $PSScriptRoot '..\assets'))
# Windows only (System.Drawing). Run: powershell -File scripts/make-icons.ps1
# Renders the HeatGuard sun (src/ui/SunBuddy.tsx, 120x120 grid) into app icon PNGs.
Add-Type -AssemblyName System.Drawing
function Col($hex, $a = 255) { [System.Drawing.Color]::FromArgb($a, [Convert]::ToInt32($hex.Substring(1,2),16), [Convert]::ToInt32($hex.Substring(3,2),16), [Convert]::ToInt32($hex.Substring(5,2),16)) }
$green = '#58CC02'; $orange = '#FF9600'; $gold = '#F5A700'; $yellow = '#FFC800'; $ink = '#3C3C3C'

function Draw-Sun($g, $k, $s, $off) {
  # Maps a 120-grid point into pixels: (off + s*x) * k
  $P = { param($x, $y) [System.Drawing.PointF]::new(($off + $s * $x) * $k, ($off + $s * $y) * $k) }
  $u = $s * $k
  $pen = [System.Drawing.Pen]::new((Col $orange), 9 * $u)
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
  for ($i = 0; $i -lt 8; $i++) {
    $a = $i * [Math]::PI / 4
    $g.DrawLine($pen, (& $P (60 + 46 * [Math]::Cos($a)) (60 + 46 * [Math]::Sin($a))), (& $P (60 + 54 * [Math]::Cos($a)) (60 + 54 * [Math]::Sin($a))))
  }
  foreach ($c in @(@($gold, 64), @($yellow, 60))) {
    $tl = & $P 24 ($c[1] - 36)
    $g.FillEllipse([System.Drawing.SolidBrush]::new((Col $c[0])), $tl.X, $tl.Y, 72 * $u, 72 * $u)
  }
  $eye = [System.Drawing.Pen]::new((Col $ink), 9 * $u)
  $eye.StartCap = 'Round'; $eye.EndCap = 'Round'
  $g.DrawLine($eye, (& $P 48.5 53.5), (& $P 48.5 58.5))
  $g.DrawLine($eye, (& $P 71.5 53.5), (& $P 71.5 58.5))
  $mouth = [System.Drawing.Pen]::new((Col $ink), 4.5 * $u)
  $mouth.StartCap = 'Round'; $mouth.EndCap = 'Round'
  # Quadratic M51 72 q9 8 18 0 as a cubic Bezier
  $g.DrawBezier($mouth, (& $P 51 72), (& $P 57 77.333), (& $P 63 77.333), (& $P 69 72))
}
function New-Canvas($size) {
  $bmp = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'
  return @($bmp, $g)
}

# iOS / default icon: full-bleed green (iOS applies its own corner mask), no transparency.
$bmp, $g = New-Canvas 1024
$g.Clear((Col $green))
Draw-Sun $g (1024 / 120) 0.8 12
$g.Dispose()
$flat = [System.Drawing.Bitmap]::new(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$fg = [System.Drawing.Graphics]::FromImage($flat); $fg.DrawImage($bmp, 0, 0, 1024, 1024); $fg.Dispose()
$flat.Save((Join-Path $OutDir 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)

# Android adaptive foreground: transparent, sun kept inside the central safe zone.
$bmp, $g = New-Canvas 1024
$g.Clear([System.Drawing.Color]::Transparent)
Draw-Sun $g (1024 / 120) 0.56 26.4
$g.Dispose()
$bmp.Save((Join-Path $OutDir 'adaptive-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)

# Web favicon: rounded green tile, as in BrandMark.
$size = 196
$bmp, $g = New-Canvas $size
$g.Clear([System.Drawing.Color]::Transparent)
$r = $size * 28 / 120 * 2
$path = [System.Drawing.Drawing2D.GraphicsPath]::new()
$path.AddArc(0, 0, $r, $r, 180, 90); $path.AddArc($size - $r, 0, $r, $r, 270, 90)
$path.AddArc($size - $r, $size - $r, $r, $r, 0, 90); $path.AddArc(0, $size - $r, $r, $r, 90, 90)
$path.CloseFigure()
$g.FillPath([System.Drawing.SolidBrush]::new((Col $green)), $path)
Draw-Sun $g ($size / 120) 0.75 15
$g.Dispose()
$bmp.Save((Join-Path $OutDir 'favicon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
Get-ChildItem $OutDir | Select-Object Name, Length

