param([string]$OutDir = (Join-Path $PSScriptRoot '..\assets'))
# Windows only (System.Drawing). Regenerates PNGs from the 48-grid BrandMark geometry.
# Keep src/ui/SunBuddy.tsx in sync; no external images or font downloads.
Add-Type -AssemblyName System.Drawing
function Col($hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }
function Draw-Mark($g, $k, $scale, $offset) {
  $p = { param($x, $y) [System.Drawing.PointF]::new(($offset + $scale * $x) * $k, ($offset + $scale * $y) * $k) }
  $u = $scale * $k
  $sun = [System.Drawing.Pen]::new((Col '#F0B879'), 2.5 * $u)
  $sun.StartCap = 'Round'; $sun.EndCap = 'Round'
  $top = & $p 16 16
  $g.DrawEllipse($sun, $top.X, $top.Y, 16 * $u, 16 * $u)
  for ($i = 0; $i -lt 8; $i++) {
    $a = $i * [Math]::PI / 4
    $g.DrawLine($sun, (& $p (24 + 13 * [Math]::Cos($a)) (24 + 13 * [Math]::Sin($a))), (& $p (24 + 18 * [Math]::Cos($a)) (24 + 18 * [Math]::Sin($a))))
  }
  $sun.Dispose()
}
function New-Canvas($size, $opaque = $false) {
  $format = if ($opaque) { [System.Drawing.Imaging.PixelFormat]::Format24bppRgb } else { [System.Drawing.Imaging.PixelFormat]::Format32bppArgb }
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, $format)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = 'AntiAlias'; $graphics.PixelOffsetMode = 'HighQuality'
  return @($bitmap, $graphics)
}
# Full-bleed opaque native icon; the OS applies its corner mask.
$bitmap, $graphics = New-Canvas 1024 $true
$graphics.Clear((Col '#0B1016'))
Draw-Mark $graphics (1024 / 48) 1 0
$graphics.Dispose()
$bitmap.Save((Join-Path $OutDir 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
# Adaptive foreground remains inside the central Android safe zone.
$bitmap, $graphics = New-Canvas 1024
$graphics.Clear([System.Drawing.Color]::Transparent)
Draw-Mark $graphics (1024 / 48) 0.7 7.2
$graphics.Dispose()
$bitmap.Save((Join-Path $OutDir 'adaptive-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
$bitmap, $graphics = New-Canvas 196
$graphics.Clear((Col '#142C2A'))
Draw-Mark $graphics (196 / 48) 1 0
$graphics.Dispose()
$bitmap.Save((Join-Path $OutDir 'favicon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
Get-ChildItem $OutDir | Select-Object Name, Length
