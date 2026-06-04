# auto_push_dashboard.ps1
$repoPath = "C:\Users\user\Desktop\電脳会社"
$logFile  = "$repoPath\push_log.txt"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Set-Location $repoPath

$status = git status --short
if (-not $status) {
    Add-Content $logFile "[$timestamp] 変更なし。スキップ。" -Encoding UTF8
    exit 0
}

git add dashboard.html kyun-workspace/index.html keiba-workspace/index.html
$commitMsg = "auto: dashboard自動push $timestamp"
git commit -m $commitMsg

$pushResult = git push origin master 2>&1
if ($LASTEXITCODE -eq 0) {
    Add-Content $logFile "[$timestamp] push成功" -Encoding UTF8
} else {
    Add-Content $logFile "[$timestamp] pushエラー" -Encoding UTF8
}