# Builds the app question bank from the annotated corpus.
#   data/corpus-annotated.psv  +  data/corpus-index.csv   ->   data/bank.js
#
# Emits a plain .js file assigning a global so the app works from file:// as
# well as over http (no fetch, no CORS, no build step).

param(
    [string]$Repo = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = 'Stop'

$psv = Join-Path $Repo 'data\corpus-annotated.psv'
$idx = Join-Path $Repo 'data\corpus-index.csv'
$out = Join-Path $Repo 'data\bank.js'

# ---------------------------------------------------------------- index lookup
$meta = @{}
foreach ($r in (Import-Csv $idx)) { $meta[$r.id] = $r }

$DOMAIN_FULL = @{
    'Algebra'           = 'Algebra'
    'Advanced Math'     = 'Advanced Math'
    'PSDA'              = 'Problem-Solving and Data Analysis'
    'Geometry and Trig' = 'Geometry and Trigonometry'
}

# Figure families that cannot be reconstructed from the stem alone: the student
# must read values off a picture, or the answer choices are themselves pictures.
$NEEDS_IMAGE = @(
    'scatterplot', 'line-graph', 'bar-graph', 'box-plot', 'box-plots', 'dot-plot',
    'histogram', 'two-histograms', 'graph', 'curve', 'exponential-graph',
    'parabola', 'polynomial-graph', 'rational-function-graph', 'grid',
    'figure', 'trapezoid', 'circle-on-grid', 'unit-circle'
)

function Test-NeedsImage([string]$fig) {
    if ([string]::IsNullOrWhiteSpace($fig) -or $fig -eq '-') { return $false }
    foreach ($p in $NEEDS_IMAGE) { if ($fig -like "$p*") { return $true } }
    return $false
}

function Get-Tier([int]$d) {
    if ($d -lt 400) { return 'easy' }
    if ($d -lt 560) { return 'medium' }
    return 'hard'
}

# ------------------------------------------------- distractor-logic decomposer
# The logic field looks like:
#   "A=2s (doubled instead of squared); B=4s (perimeter); C=s^2 CORRECT; D=(2s)^2"
# Clauses may cover several letters at once ("A/B=", "B/C/D=") and SPR rows are
# free prose beginning "SPR:".
function Split-Logic {
    param([string]$logic, [string[]]$letters)

    $perLetter = @{}
    $leftover = New-Object System.Collections.ArrayList

    foreach ($clause in ($logic -split ';')) {
        $c = $clause.Trim()
        if ($c -eq '') { continue }
        if ($c -match '^\s*((?:[A-D])(?:\s*/\s*[A-D])*)\s*=\s*(.+)$') {
            $who = $matches[1] -split '\s*/\s*'
            $txt = $matches[2].Trim()
            foreach ($w in $who) {
                if ($perLetter.ContainsKey($w)) { $perLetter[$w] += '; ' + $txt }
                else { $perLetter[$w] = $txt }
            }
        }
        else { [void]$leftover.Add($c) }
    }
    return @{ perLetter = $perLetter; leftover = ($leftover -join '; ') }
}

# Turn "s^2 CORRECT" into a clean correct-answer note, and a distractor clause
# into a sentence describing the error.
function Format-Note([string]$t, [bool]$isCorrect) {
    if ([string]::IsNullOrWhiteSpace($t)) { return '' }
    $s = $t.Trim()
    $s = $s -replace '\s*\bCORRECT\b\s*', ' '
    $s = $s.Trim(' ', ';', ',')
    if ($s -eq '') {
        if ($isCorrect) { return 'Correct.' } else { return '' }
    }
    # Capitalise, add a period.
    $s = $s.Substring(0, 1).ToUpper() + $s.Substring(1)
    if ($s -notmatch '[.!?]$') { $s += '.' }
    return $s
}

# ------------------------------------------------------------------ main parse
$questions = New-Object System.Collections.ArrayList
$skipped = New-Object System.Collections.ArrayList
$letters = @('A', 'B', 'C', 'D')

foreach ($line in (Get-Content -LiteralPath $psv)) {
    if ($line -match '^\s*#' -or $line.Trim() -eq '') { continue }
    $f = $line -split '\|'
    if ($f.Count -lt 10) { [void]$skipped.Add("short row: $($f[2])"); continue }

    $set = $f[0].Trim(); $num = $f[1].Trim(); $id = $f[2].Trim()
    $diff = [int]$f[3].Trim(); $key = $f[4].Trim(); $fmt = $f[5].Trim().ToLower()
    $fig = $f[6].Trim(); $stem = $f[7].Trim()
    $choicesRaw = $f[8].Trim(); $logic = ($f[9..($f.Count - 1)] -join '|').Trim()

    $m = $meta[$id]
    if (-not $m) { [void]$skipped.Add("no index row: $id"); continue }

    $needsImg = Test-NeedsImage $fig

    $q = [ordered]@{
        id         = $id
        source     = 'official'
        set        = $set
        num        = $num
        domain     = $DOMAIN_FULL[$m.domain]
        skill      = $m.skill
        difficulty = $diff
        tier       = Get-Tier $diff
        format     = $fmt
        figure     = $(if ($fig -eq '-') { $null } else { $fig })
        needsImage = $needsImg
        stem       = $stem
    }

    $split = Split-Logic -logic $logic -letters $letters

    if ($fmt -eq 'mcq') {
        $choices = @($choicesRaw -split ';' | ForEach-Object { $_.Trim() })
        if ($choices.Count -ne 4) { [void]$skipped.Add("choice count $($choices.Count): $id"); continue }
        if ($key -notmatch '^[A-D]$') { [void]$skipped.Add("bad mcq key '$key': $id"); continue }

        $expl = [ordered]@{}
        foreach ($L in $letters) {
            $isC = ($L -eq $key)
            $raw = $split.perLetter[$L]
            $note = Format-Note $raw $isC
            if ($note -eq '') {
                $note = if ($isC) { 'Correct.' } else { 'A plausible-looking value that does not follow from the given information.' }
            }
            $expl[$L] = $note
        }
        $q.choices = $choices
        $q.answer = $key
        $q.answerIndex = [array]::IndexOf($letters, $key)
        $q.explanations = $expl
        $q.method = $split.leftover
    }
    else {
        # Student-produced response: the key may list several accepted values.
        $accepted = @($key -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
        if ($accepted.Count -eq 0) { [void]$skipped.Add("empty spr key: $id"); continue }
        $q.accepted = $accepted
        $q.answer = ($accepted -join ', ')
        $note = $split.leftover
        $note = $note -replace '^\s*SPR\s*:\s*', ''
        $q.method = $note.Trim()
        $q.explanations = $null
    }

    [void]$questions.Add([pscustomobject]$q)
}

# ------------------------------------------------------------------- summarise
$total = $questions.Count
$servable = @($questions | Where-Object { -not $_.needsImage })
"parsed       : $total"
"skipped      : $($skipped.Count)"
$skipped | Select-Object -First 10 | ForEach-Object { "   $_" }
""
"needs image  : $($total - $servable.Count)"
"servable     : $($servable.Count)"
""
"servable by domain:"
$servable | Group-Object domain | Sort-Object Count -Descending | ForEach-Object {
    "   {0,-38} {1,4}  ({2:P1})" -f $_.Name, $_.Count, ($_.Count / $servable.Count)
}
""
"servable by tier:"
$servable | Group-Object tier | Sort-Object Name | ForEach-Object { "   {0,-8} {1,4}" -f $_.Name, $_.Count }
""
"servable by format:"
$servable | Group-Object format | ForEach-Object { "   {0,-8} {1,4}" -f $_.Name, $_.Count }

# ------------------------------------------------------------------ emit bank
$payload = [ordered]@{
    generated = (Get-Date -Format 'yyyy-MM-dd')
    counts    = [ordered]@{ total = $total; servable = $servable.Count }
    questions = $questions
}

$json = $payload | ConvertTo-Json -Depth 8 -Compress
$header = "/* Generated by tools/build-bank.ps1 - do not edit by hand. */" + [Environment]::NewLine
$body = $header + "window.SAT_BANK = " + $json + ";" + [Environment]::NewLine

[System.IO.File]::WriteAllText($out, $body, (New-Object System.Text.UTF8Encoding $false))
""
"wrote $out  ({0:N0} KB)" -f ((Get-Item $out).Length / 1KB)
