# 電脳会社 ファイル自動整理スクリプト
# 3時間以上放置されたファイルをタイトルで自動振り分け

$baseDir = "C:\Users\user\Desktop\電脳会社"
$threshold = 3  # 時間

# 振り分け先フォルダ定義
$destinations = @{
    "競馬"     = "$baseDir\02_競馬"
    "ダービー" = "$baseDir\02_競馬"
    "オークス" = "$baseDir\02_競馬"
    "予想"     = "$baseDir\02_競馬"
    "FIREスコア" = "$baseDir\02_競馬"
    "レース"   = "$baseDir\02_競馬"
    "メルカリ" = "$baseDir\03_メルカリ"
    "出品"     = "$baseDir\03_メルカリ"
    "仕入れ"   = "$baseDir\03_メルカリ"
    "相場"     = "$baseDir\03_メルカリ"
    "決算"     = "$baseDir\01_決算城\articles"
    "決算城"   = "$baseDir\01_決算城\articles"
    "記事"     = "$baseDir\01_決算城\articles"
    "企業"     = "$baseDir\01_決算城\articles"
}

# 宿題フォルダ内の細分類
$subDestinations = @{
    "アドバイス" = "$baseDir\05_宿題\アドバイス"
    "戦略"       = "$baseDir\05_宿題\アドバイス"
    "提案"       = "$baseDir\05_宿題\アドバイス"
    "分析"       = "$baseDir\05_宿題\アドバイス"
    "原稿"       = "$baseDir\05_宿題\原稿"
    "ドラフト"   = "$baseDir\05_宿題\原稿"
    "Opus"       = "$baseDir\05_宿題\アドバイス"
    "計画"       = "$baseDir\05_宿題\アドバイス"
    "プラン"     = "$baseDir\05_宿題\アドバイス"
}

$logPath = "$baseDir\05_宿題\auto_sort_log.txt"
$now = Get-Date
$moved = 0

# サブフォルダを先に作成
@("$baseDir\05_宿題\アドバイス", "$baseDir\05_宿題\原稿") | ForEach-Object {
    if (-not (Test-Path $_)) { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
}

# 電脳会社フォルダ直下の.txtファイルを対象
Get-ChildItem -Path $baseDir -Filter "*.txt" -File | ForEach-Object {
    $file = $_
    $age = ($now - $file.LastWriteTime).TotalHours

    if ($age -ge $threshold) {
        $name = $file.Name
        $dest = $null

        # 1. メインカテゴリで判定
        foreach ($key in $destinations.Keys) {
            if ($name -match $key) {
                $dest = $destinations[$key]
                break
            }
        }

        # 2. 宿題サブカテゴリで判定（メインに当てはまらない場合）
        if (-not $dest) {
            foreach ($key in $subDestinations.Keys) {
                if ($name -match $key) {
                    $dest = $subDestinations[$key]
                    break
                }
            }
        }

        # 3. どれにも当てはまらなければ宿題フォルダへ
        if (-not $dest) {
            $dest = "$baseDir\05_宿題"
        }

        # 既にその場所にいる場合はスキップ
        if ($file.DirectoryName -ne $dest) {
            if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
            $destFile = Join-Path $dest $file.Name
            if (Test-Path $destFile) {
                $destFile = Join-Path $dest ($file.BaseName + "_" + (Get-Date -Format "HHmm") + $file.Extension)
            }
            Move-Item -Path $file.FullName -Destination $destFile
            $logLine = "[$($now.ToString('yyyy-MM-dd HH:mm'))] MOVED: $name → $dest"
            Add-Content -Path $logPath -Value $logLine -Encoding UTF8
            $moved++
        }
    }
}

# 各カテゴリフォルダ内も整理（05_宿題の直下のみ）
Get-ChildItem -Path "$baseDir\05_宿題" -Filter "*.txt" -File | ForEach-Object {
    $file = $_
    $age = ($now - $file.LastWriteTime).TotalHours
    if ($age -ge $threshold) {
        $name = $file.Name
        $dest = $null
        foreach ($key in $subDestinations.Keys) {
            if ($name -match $key) {
                $dest = $subDestinations[$key]
                break
            }
        }
        if ($dest -and $file.DirectoryName -ne $dest) {
            if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
            Move-Item -Path $file.FullName -Destination (Join-Path $dest $file.Name) -ErrorAction SilentlyContinue
            Add-Content -Path $logPath -Value "[$($now.ToString('yyyy-MM-dd HH:mm'))] SORTED: $name → $dest" -Encoding UTF8
            $moved++
        }
    }
}

if ($moved -gt 0) {
    Write-Host "✅ $moved 件のファイルを整理しました"
} else {
    Write-Host "✅ 整理対象なし"
}
