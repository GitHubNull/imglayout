@echo off
chcp 65001 >nul
setlocal
rem Windows 一键打包：双击即自动编译前端并生成 NSIS 安装包，无需手动敲命令
cd /d "%~dp0.."

echo ==========================================
echo   imgLayout Windows 一键打包
echo ==========================================

rem ---- 1. 检查 Node.js / pnpm ----
where node >nul 2>nul
if errorlevel 1 goto :no_node
where pnpm >nul 2>nul
if errorlevel 1 goto :fix_pnpm

:have_pnpm
rem ---- 2. 检查 Rust 工具链 ----
where cargo >nul 2>nul
if errorlevel 1 goto :no_rust

echo.
echo ==^> 安装依赖（根 workspace）
call pnpm install
if errorlevel 1 goto :fail

echo.
echo ==^> 构建前端
call pnpm --dir src/frontend build
if errorlevel 1 goto :fail

echo.
echo ==^> 编译 Rust 并打包 NSIS 安装包（首次全量编译较慢属正常现象）
pushd src\backend
call pnpm tauri build --bundles nsis
if errorlevel 1 (popd & goto :fail)
popd

echo.
echo ==========================================
echo   打包完成，安装包位置：
for %%f in (src\backend\target\release\bundle\nsis\*.exe) do echo   %%~ff
echo ==========================================
pause
exit /b 0

:fix_pnpm
echo 未找到 pnpm，尝试通过 corepack 启用...
call corepack enable >nul 2>nul
call corepack prepare pnpm@latest --activate >nul 2>nul
where pnpm >nul 2>nul
if not errorlevel 1 goto :have_pnpm
echo corepack 启用失败，改用 npm 全局安装 pnpm...
call npm install -g pnpm
if errorlevel 1 goto :fail
goto :have_pnpm

:no_node
echo [错误] 未找到 Node.js，请先安装 Node.js 20+（https://nodejs.org）后重试。
goto :end_fail

:no_rust
echo [错误] 未找到 Rust 工具链，请先安装：
echo   1. Visual Studio Build Tools（工作负载勾选「使用 C++ 的桌面开发」）
echo   2. rustup-init（https://rustup.rs，默认选 x86_64-pc-windows-msvc）
echo 装好后重新双击本脚本即可。
goto :end_fail

:fail
echo [错误] 构建失败，请向上翻看具体报错排查。

:end_fail
pause
exit /b 1
