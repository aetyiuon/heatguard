param([Parameter(Mandatory=$true)][string]$Url)
$ErrorActionPreference='Stop'
$sourceUri=[Uri]$Url
if ($sourceUri.Scheme -ne 'https' -or $sourceUri.Host -ne 'tpwd.texas.gov' -or -not $sourceUri.AbsolutePath.StartsWith('/arcgis/rest/services/')) {
  throw 'Only the official TPWD HTTPS ArcGIS service is supported.'
}
# Windows validates the chain using its normal certificate store and intermediate retrieval.
# No certificate checks or trust settings are disabled.
$response=Invoke-WebRequest -Uri $sourceUri -UseBasicParsing -TimeoutSec 45
[Console]::Out.Write($response.Content)
