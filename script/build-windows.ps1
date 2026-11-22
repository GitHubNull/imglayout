# imgLayout Windows 一键打包：自动装依赖、构建前端、编译 Rust 并生成 NSIS 安装包
# 由 build-windows.bat 启动器调用；也可在 PowerShell 里直接执行本文件
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

function Fail($msg) {
    Write-Host ''
    Write-Host "[错误] $msg" -ForegroundColor Red
    exit 1
}

Write-Host '=========================================='
Write-Host '  imgLayout Windows 一键打包'
Write-Host '=========================================='

# 1. Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail '未找到 Node.js，请先安装 Node.js 20+（https://nodejs.org）后重试。'
}

# 2. pnpm（先试 corepack，失败再走 npm 全局安装）
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host '未找到 pnpm，尝试通过 corepack 启用...'
    corepack enable 2>$null
    corepack prepare pnpm@latest --activate 2>$null
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Write-Host 'corepack 启用失败，改用 npm 全局安装 pnpm...'
        npm install -g pnpm
        $env:Path = [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + $env:Path
        if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
            Fail 'pnpm 安装失败，可尝试手动执行：npm install -g pnpm'
        }
    }
}

# 3. Rust 工具链
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host '未找到 Rust 工具链，请先安装：'
    Write-Host '  1. Visual Studio Build Tools（工作负载勾选「使用 C++ 的桌面开发」）'
    Write-Host '  2. rustup-init（https://rustup.rs，默认选 x86_64-pc-windows-msvc）'
    Write-Host '装好后重新双击本脚本即可。'
    exit 1
}

try {
    Write-Host ''
    Write-Host '==> 安装依赖（根 workspace）'
    pnpm install
    if ($LASTEXITCODE -ne 0) { throw 'pnpm install 失败' }

    Write-Host ''
    Write-Host '==> 构建前端'
    pnpm --dir src/frontend build
    if ($LASTEXITCODE -ne 0) { throw '前端构建失败' }

    Write-Host ''
    Write-Host '==> 编译 Rust 并打包 NSIS 安装包（首次全量编译较慢属正常现象）'
    Push-Location src/backend
    pnpm tauri build --bundles nsis
    if ($LASTEXITCODE -ne 0) { throw 'Rust 编译或打包失败' }
    Pop-Location

    Write-Host ''
    Write-Host '=========================================='
    Write-Host '  打包完成，安装包位置：'
    Get-ChildItem 'src/backend/target/release/bundle/nsis/*.exe' | ForEach-Object { Write-Host "  $($_.FullName)" }
    Write-Host '=========================================='
    exit 0
} catch {
    Fail $_.Exception.Message
}
