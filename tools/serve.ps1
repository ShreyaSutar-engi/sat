# Minimal static file server for local preview.
#   powershell -ExecutionPolicy Bypass -File tools\serve.ps1 [-Port 8777]
# Stop with Ctrl+C.

param(
    [int]$Port = 8777,
    [string]$Root = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = 'Stop'

$MIME = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.csv'  = 'text/csv; charset=utf-8'
    '.psv'  = 'text/plain; charset=utf-8'
    '.md'   = 'text/plain; charset=utf-8'
    '.ico'  = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "serving $Root on http://localhost:$Port/"

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response
        try {
            $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
            if ($rel -eq '') { $rel = 'index.html' }

            $full = Join-Path $Root $rel
            $fullResolved = [System.IO.Path]::GetFullPath($full)

            # never serve outside the root
            if (-not $fullResolved.StartsWith([System.IO.Path]::GetFullPath($Root))) {
                $res.StatusCode = 403
            }
            elseif (Test-Path -LiteralPath $fullResolved -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($fullResolved).ToLower()
                $res.ContentType = if ($MIME.ContainsKey($ext)) { $MIME[$ext] } else { 'application/octet-stream' }
                $bytes = [System.IO.File]::ReadAllBytes($fullResolved)
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            else {
                $res.StatusCode = 404
                $msg = [System.Text.Encoding]::UTF8.GetBytes("404 $rel")
                $res.OutputStream.Write($msg, 0, $msg.Length)
            }
        }
        catch {
            try { $res.StatusCode = 500 } catch {}
        }
        finally {
            try { $res.OutputStream.Close() } catch {}
        }
    }
}
finally {
    $listener.Stop()
    $listener.Close()
}
