$ErrorActionPreference = "Continue"
$root = "C:\Projects\Navitravel\frontend"
$legacy = @()
$all = @()
foreach ($f in (Get-ChildItem -Path $root -Recurse -Include *.tsx,*.ts -File -ErrorAction SilentlyContinue)) {
  $p = $f.FullName
  if ($p -match '\\node_modules\\|\\.next\|\\.next') { continue }
  $all += $p
  $t = Get-Content -Raw $p -ErrorAction SilentlyContinue
  if ($null -eq $t) { continue }
  if ($t -match '(slate|blue|indigo|sky|cyan|emerald|green|red|rose|amber|yellow|orange|teal|lime|purple|violet|pink)') {
    $legacy += $p
  }
}
Write-Output ("ALL_TSX_TS=" + $all.Count)
$legacy | ForEach-Object { $rel = $_.Substring($root.Length + 1); $parts = $rel.Split([IO.Path]::DirectorySeparatorChar); $dir = $parts[0]; Write-Output ($dir + "" + [char]9) } | Out-String | Out-Null
$groups = @{}
foreach ($p in $legacy) {
  $rel = $p.Substring($root.Length + 1)
  $parts = $rel.Split([IO.Path]::DirectorySeparatorChar)
  $key = $parts[0]
  if (-not $groups.ContainsKey($key)) { $groups[$key] = @() }
  $groups[$key] += $p
}
foreach ($k in ($groups.Keys | Sort-Object)) {
  Write-Output ("GROUP " + $k + " COUNT " + $groups[$k].Count)
}
