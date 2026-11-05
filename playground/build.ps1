param(
    [string] $ReactiveRepo,
    [string] $QuestRepo,
    [string] $YogaBinding,
    [switch] $RebuildYoga
)
$ErrorActionPreference = 'Stop'

$here = $PSScriptRoot
$root = Split-Path $here -Parent
$deps = Join-Path $here 'deps'
$output = Join-Path $root 'public\reactive-playground'
$yogaCommit = '51e6095005fd713dbfcbaf2c6296009de782d966'
New-Item -ItemType Directory -Force $deps | Out-Null

function Invoke-Checked([string] $file, [string[]] $arguments) {
    & $file @arguments
    if ($LASTEXITCODE -ne 0) { throw "$file $($arguments -join ' ') failed with $LASTEXITCODE" }
}

function Remove-IfExists([string] $path) {
    if (Test-Path $path) { Remove-Item -LiteralPath $path -Recurse -Force }
}

$reactive = Join-Path $deps 'reactive-mono'
Remove-IfExists $reactive
if ($ReactiveRepo) {
    New-Item -ItemType Directory -Force $reactive | Out-Null
    $archive = Join-Path $deps 'reactive-mono.tar'
    Invoke-Checked git @('-C', $ReactiveRepo, 'archive', '--format=tar', '-o', $archive, 'HEAD')
    Invoke-Checked tar @('-xf', $archive, '-C', $reactive)
    Remove-Item -LiteralPath $archive -Force
} else {
    Invoke-Checked git @('clone', '--depth', '1', '--branch', 'v2-dev', 'https://github.com/reactive-platform/reactive-mono.git', $reactive)
}

$bundle = Join-Path $deps 'beat-saber-sdk-bundle'
Remove-IfExists $bundle
Invoke-Checked git @('clone', '--depth', '1', 'https://github.com/reactive-platform/beat-saber-sdk-bundle.git', $bundle)

$yogaLib = Join-Path $here 'native\yoga.a'
if ($RebuildYoga -or -not (Test-Path $yogaLib)) {
    $binding = if ($YogaBinding) { $YogaBinding } else { Join-Path $root 'yoga-binding' }
    if (-not (Test-Path (Join-Path $binding 'lib\yoga\yoga'))) {
        $binding = Join-Path $deps 'yoga-binding'
        if (-not (Test-Path $binding)) {
            Invoke-Checked git @('clone', '--depth', '1', 'https://github.com/reactive-platform/yoga-binding.git', $binding)

            $yoga = Join-Path $binding 'lib\yoga'
            Invoke-Checked git @('-C', $yoga, 'init', '-q')
            Invoke-Checked git @('-C', $yoga, 'remote', 'add', 'origin', 'https://github.com/facebook/yoga.git')
            Invoke-Checked git @('-C', $yoga, 'fetch', '-q', '--depth', '1', 'origin', $yogaCommit)
            Invoke-Checked git @('-C', $yoga, 'checkout', '-q', 'FETCH_HEAD')
        }
    }

    $packs = Join-Path (Split-Path (Get-Command dotnet).Source -Parent) 'packs'
    function Get-Pack([string] $suffix) {
        $pack = Get-ChildItem $packs -Directory -Filter "Microsoft.NET.Runtime.Emscripten.*.$suffix.*" | Sort-Object Name | Select-Object -Last 1
        if (-not $pack) { throw "Emscripten isn't installed, run: dotnet workload install wasm-tools" }
        return (Get-ChildItem $pack.FullName -Directory | Sort-Object Name | Select-Object -Last 1).FullName + '\tools'
    }
    $sdk = Get-Pack 'Sdk'
    $node = Get-Pack 'Node'
    $python = Get-Pack 'Python'
    $cache = Get-Pack 'Cache'

    $env:DOTNET_EMSCRIPTEN_LLVM_ROOT = "$sdk\bin"
    $env:DOTNET_EMSCRIPTEN_BINARYEN_ROOT = "$sdk\"
    $env:DOTNET_EMSCRIPTEN_NODE_JS = "$node\bin\node.exe"
    $env:EMSDK_PYTHON = "$python\python.exe"
    $env:PYTHONPATH = $python
    $env:PYTHONHOME = ''
    $env:PYTHONUTF8 = '1'
    $env:EM_WORKAROUND_PYTHON_BUG_34780 = '1'
    $env:EM_CACHE = "$cache\emscripten\cache"
    $env:EM_FROZEN_CACHE = '1'
    $env:PATH = "$sdk\emscripten;$sdk\bin;$node\bin;$python;$env:PATH"

    $objects = Join-Path $here 'native\obj'
    New-Item -ItemType Directory -Force $objects | Out-Null
    $sources = @(Get-ChildItem (Join-Path $binding 'lib\yoga\yoga') -Recurse -Filter *.cpp | ForEach-Object { $_.FullName })
    $sources += Join-Path $binding 'src\bindings.cpp'
    $sources += Join-Path $here 'native\bridge.cpp'

    $built = foreach ($cpp in $sources) {
        $object = Join-Path $objects ([IO.Path]::GetFileNameWithoutExtension($cpp) + '.o')
        Invoke-Checked "$sdk\emscripten\emcc.bat" @('-c', $cpp, '-o', $object, '-std=c++20', '-O2', '-fno-exceptions', '-fno-rtti', "-I$(Join-Path $binding 'lib\yoga')", "-I$(Join-Path $binding 'src')")
        $object
    }

    Remove-IfExists $yogaLib
    Invoke-Checked "$sdk\emscripten\emar.bat" (@('rcs', $yogaLib) + $built)
}

$source = [IO.File]::ReadAllText((Join-Path $reactive 'src\Reactive\Layout\Flex\Yoga\YogaNative.cs'))
foreach ($name in 'YGConfigSetLogger', 'YGNodeSetMeasureFunc') {
    $import = "\[DllImport[^\]]*\]\s*public static extern \S+ $name\([^)]*\);"
    if ($source -notmatch $import) { throw "YogaNative.cs no longer imports $name, native\YogaNative.Bridge.cs needs another look" }
    $source = $source -replace $import, ''
}
if ($source -cmatch 'extern[^;]*\w(Delegate|Func)\??\s+\w+\s*[,)]') { throw "New delegate import, browser .NET can't marshal it: $($Matches[0])" }
$source = $source -replace 'static class YogaNative', 'static partial class YogaNative'
[IO.File]::WriteAllText((Join-Path $here 'Reactive\YogaNative.g.cs'), $source)

$apps = 'Preview', 'Compiler'
foreach ($app in $apps) {
    Remove-IfExists (Join-Path $here "$app\bin\Release\net10.0\publish")
    Invoke-Checked dotnet @('publish', (Join-Path $here "$app\$app.csproj"), '-c', 'Release', '-nologo', '-v:q', '-clp:NoSummary;ErrorsOnly')
}

Remove-IfExists $output
foreach ($app in $apps) {
    $target = Join-Path $output $app.ToLowerInvariant()
    New-Item -ItemType Directory -Force $target | Out-Null
    Copy-Item (Join-Path $here "$app\bin\Release\net10.0\publish\wwwroot\*") $target -Recurse -Force
}

Get-ChildItem $output -Recurse -File |
    Where-Object { $_.Extension -eq '.wasm' -or ($_.Extension -eq '.gz' -and $_.Name -notlike '*.wasm.gz') } |
    Remove-Item -Force

$questArguments = @((Join-Path $here 'Quest\build.mjs'), '--bundle', $bundle)
if ($QuestRepo) { $questArguments += @('--quest', $QuestRepo) }
Invoke-Checked node $questArguments

$size = (Get-ChildItem $output -Recurse -File | Measure-Object Length -Sum).Sum
Write-Host "Built $output ($([math]::Round($size / 1MB, 1)) MB)"
