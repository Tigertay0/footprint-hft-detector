# Sets up the Footprint watcher on an always-on Windows PC (a NUC, for example).
# Right-click > Run with PowerShell. It asks for administrator approval once, only to register the startup task.
# The watcher itself then runs as YOU, not as an administrator or the system account.
#
#   1. checks that this PC can run it (Windows version, memory, disk, S mode)
#   2. makes the Python environment
#   3. saves your private ntfy topic (alerts go to the phone app subscribed to that topic)
#   4. sends a test notification
#   5. registers a task that starts the watcher at boot and restarts it if it stops
param([switch]$NoTask)   # -NoTask: do steps 1 to 4 only

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSCommandPath
$taskName = "FootprintWatcher"

$me = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = ([Security.Principal.WindowsPrincipal]$me).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin -and -not $NoTask) {
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

function Step($n, $text) { Write-Host "`nStep $n of 5: $text" -ForegroundColor Cyan }
function Warn($text) { Write-Host $text -ForegroundColor Yellow }
function Fail($text) { Write-Host "`n$text" -ForegroundColor Red; Read-Host "Press Enter to close"; exit 1 }

Set-Location $root

# ------------------------------------------------------------ 1. This PC
Step 1 "Checking this PC"
$os = [Environment]::OSVersion.Version
if ($os.Major -lt 10) { Fail "This needs Windows 10 or newer (this PC reports Windows $($os.Major).$($os.Minor)). The Python it needs will not install on older Windows." }
$arch = $env:PROCESSOR_ARCHITECTURE
if ($arch -eq "x86") { Fail "This is 32-bit Windows. The packages the watcher needs are not available for it." }
if ($arch -eq "ARM64") { Warn "Note: this is an ARM PC. Install the 64-bit Python. If the package install fails below, use an Intel or AMD PC instead." }
$sMode = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy" -ErrorAction SilentlyContinue).SkuPolicyRequired
if ($sMode -eq 1) { Fail "This PC is in Windows S mode, which blocks Python. Switch out of S mode (Settings > Update & Security > Activation. It is free and cannot be undone), then run this again." }
$ramGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
$freeGb = [math]::Round((Get-PSDrive -Name $root.Substring(0, 1)).Free / 1GB, 1)
Write-Host "Windows build $($os.Build), $arch, $ramGb GB memory, $freeGb GB free on this drive."
if ($freeGb -lt 2) { Fail "Less than 2 GB is free on this drive, and the Python packages need about 1 GB. Free some space and run this again." }
if ($ramGb -lt 3.5) { Warn "Low memory. Keep the watchlist in watcher.json to about 5 tickers on this PC." }
if (Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue) {
    Warn "This PC has a battery. Keep it plugged in, or it will stop watching when the battery runs out."
    Warn "An old battery that is always at 100% can wear out or swell. If the maker offers a charge limit, turn it on."
}

# ------------------------------------------------------------ 2. Python environment
Step 2 "Python environment (about 2 minutes on a new PC, up to 10 on an old one)"
if (-not (Test-Path ".venv\Scripts\python.exe")) {
    $pythonVersion = 0
    try { $pythonVersion = [int](& python -c "import sys; print(sys.version_info[0] * 100 + sys.version_info[1])" 2>$null) } catch { $pythonVersion = 0 }
    if ($pythonVersion -lt 310) { Fail "Python 3.10 or newer is needed. Install it from https://www.python.org/downloads/ (tick 'Add python.exe to PATH') and run this again." }
    python -m venv .venv
    & .\.venv\Scripts\python.exe -m pip install --quiet --upgrade pip
    & .\.venv\Scripts\python.exe -m pip install --quiet -r requirements.txt
}
Write-Host "Ready."

# ------------------------------------------------------------ 2. ntfy topic
Step 3 "Your private alert topic"
$envFile = Join-Path $root "watcher.env"
$existing = @(); if (Test-Path $envFile) { $existing = @(Get-Content $envFile) }
$haveTopic = [bool]($existing -match "^NTFY_TOPIC=.{16,}")
if ($haveTopic) {
    Write-Host "watcher.env already has a topic. Keeping it."
} else {
    Write-Host "Anyone who knows your topic name can read your alerts (and send you fake ones), so it works like a password."
    Write-Host "Press Enter for a random one, or type your own (letters, digits, - and _; at least 16 characters)."
    $typed = Read-Host "Topic (hidden while you type)" -AsSecureString
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($typed))
    $generated = $false
    if ([string]::IsNullOrWhiteSpace($plain)) {
        $bytes = New-Object byte[] 16
        [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        $plain = "footprint-" + (($bytes | ForEach-Object { $_.ToString("x2") }) -join "")
        $generated = $true
    }
    if ($plain -notmatch "^[A-Za-z0-9_-]{16,64}$") { Fail "That topic is not allowed. Use 16 to 64 letters, digits, - or _." }
    # Lock the file down first, then write the secret into it. Other settings in the file are kept.
    if (-not (Test-Path $envFile)) { New-Item -ItemType File -Path $envFile | Out-Null }
    icacls $envFile /inheritance:r /grant:r "*$($me.User.Value):(R,W)" "*S-1-5-18:(R)" "*S-1-5-32-544:(F)" | Out-Null
    $kept = $existing | Where-Object { $_ -notmatch "^NTFY_TOPIC=" }
    Set-Content -Path $envFile -Value (@($kept) + "NTFY_TOPIC=$plain") -Encoding ascii
    if ($generated) { Write-Host "`nYour topic is: $plain" -ForegroundColor Yellow }
    Write-Host "`nOn your phone: install the free 'ntfy' app, tap +, and subscribe to that topic name."
    Read-Host "Press Enter when you have subscribed"
}

# ------------------------------------------------------------ 3. test notification
Step 4 "Test notification"
& .\.venv\Scripts\python.exe server\watcher.py --test-notify
if ($LASTEXITCODE -ne 0) { Fail "The test did not go through. Check the internet connection and the topic in watcher.env, then run this again." }
$ok = Read-Host "Did the notification arrive on your phone? (y/n)"
if ($ok -notmatch "^[yY]") { Fail "Check that the topic in the ntfy app matches the one in watcher.env, then run this again." }

if ($NoTask) { Write-Host "`nDone (no startup task, as requested)." -ForegroundColor Green; Read-Host "Press Enter to close"; exit 0 }

# ------------------------------------------------------------ 4. startup task
Step 5 "Start at boot and restart if it stops"
# Runs as the signed-in user with normal rights (S4U: no password stored, works before anyone logs in).
# Nothing here runs as an administrator or as SYSTEM, so a program running as you cannot use this task to gain more rights.
$action = New-ScheduledTaskAction -Execute "$root\run-watcher.bat" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $me.Name -LogonType S4U -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host "The watcher is running as the task '$taskName' (as $($me.Name))."

$sleep = Read-Host "`nTurn off sleep while plugged in, so the PC keeps watching? (y/n)"
if ($sleep -match "^[yY]") {
    powercfg /change standby-timeout-ac 0
    powercfg /change hibernate-timeout-ac 0
    Write-Host "Sleep is off while plugged in."
} else {
    Write-Host "Left as is. If the PC sleeps, it stops watching."
}

Write-Host "`nAll set." -ForegroundColor Green
Write-Host "  See activity:  open the Alerts tab, or read data\logs\watcher.log"
Write-Host "  Stop it:       Stop-ScheduledTask -TaskName $taskName"
Write-Host "  Remove it:     Unregister-ScheduledTask -TaskName $taskName -Confirm:`$false"
Read-Host "`nPress Enter to close"
