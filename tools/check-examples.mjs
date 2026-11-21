// Compiles every C# example in the docs that should compile against the last Playground build, and fails if any of
// them reports an error or a warning. Examples that show an error or a warning on purpose are skipped.
//
//   node tools/check-examples.mjs

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { PATHS, ROOT, listFiles, remove } from '../playground/scripts/common.mjs';

const WORK = join(PATHS.pcBuild, 'examples');
const REACTIVE_SRC = join(PATHS.reactiveMono, 'src');

const FENCE = /^```(\w+)([^\n]*)\n([\s\S]*?)^```/gm;
const PLAYGROUND_TAG = /<Playground\b((?:[^>"]|"[^"]*")*)>([\s\S]*?)<\/Playground>/g;
const COMPILE_EXAMPLE_TAG = /<CompileExample\b((?:[^>"]|"[^"]*")*)>([\s\S]*?)<\/CompileExample>/g;
const DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\): (error|warning) ([A-Z]+\d+): (.*?)(?: \[[^\]]+\.csproj\])?$/;

const MODIFIER = '(public|internal|sealed|abstract|static|partial|file)';
const DECLARES_TYPE = new RegExp(
    `^\\s*(\\[[^\\]]*\\]\\s*)*(${MODIFIER}\\s+)*(class|record|struct|interface|enum)\\s`,
    'm',
);

// Code without a type declaration is a method body, so it gets wrapped in a component
const WRAPPER = 'class __Example : ReactiveComponent { protected override GameObject Construct() { ';

// The Playground compiler adds these usings itself
const COMPILER_USINGS = [
    'global using System;',
    'global using System.Collections.Generic;',
    'global using System.Linq;',
];

async function importTypeScript(path) {
    const source = readFileSync(join(ROOT, path), 'utf8');
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
        },
    });

    return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { assemble, CSHARP_PRELUDE } = await importTypeScript('app/components/playground/files.ts');
const { samples } = await importTypeScript('app/components/playground/samples.ts');

function lineAt(text, index) {
    return text.slice(0, index).split('\n').length;
}

function fences(text) {
    return [...text.matchAll(FENCE)].map((x) => ({
        lang: x[1],
        meta: x[2],
        code: x[3],
    }));
}

function attribute(attributes, name) {
    return new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1];
}

// Names a file like the Playground does: by its title, else its first type, else by position
function fileName(fence, index) {
    const title = /title="([^"]+)"/.exec(fence.meta)?.[1];
    if (title) {
        return title;
    }

    const type =
        /(?<!\brecord\s+)\bclass\s+([A-Za-z_]\w*)/.exec(fence.code) ??
        /\b(?:record(?:\s+(?:class|struct))?|struct|interface|enum)\s+([A-Za-z_]\w*)/.exec(fence.code);

    if (type) {
        return `${type[1]}.cs`;
    }
    return index === 0 ? 'Program.cs' : `File${index + 1}.cs`;
}

function collectDocsExamples() {
    const examples = [];
    const docs = join(ROOT, 'content', 'docs');

    for (const file of listFiles(docs, '.mdx').sort()) {
        const text = readFileSync(file, 'utf8');
        const page = relative(docs, file);

        for (const match of text.matchAll(PLAYGROUND_TAG)) {
            const files = fences(match[2]).filter((x) => x.lang === 'csharp' && !/\bexcerpt\b/.test(x.meta));

            if (files.length === 0 || attribute(match[1], 'runnable') === 'false') {
                continue;
            }

            examples.push({
                kind: 'playground',
                origin: `${page}:${lineAt(text, match.index)}`,
                files: files.map((x, index) => ({ name: fileName(x, index), code: x.code })),
            });
        }

        for (const match of text.matchAll(COMPILE_EXAMPLE_TAG)) {
            if (attribute(match[1], 'status') !== 'compiles') {
                continue;
            }

            examples.push({
                kind: 'compile',
                origin: `${page}:${lineAt(text, match.index)}`,
                code: fences(match[2]).map((x) => x.code).join('\n'),
            });
        }
    }

    return examples;
}

function collectSamples() {
    return samples.map((sample) => ({
        kind: 'playground',
        origin: `sample: ${sample.name}`,
        files: [{ name: 'Program.cs', code: sample.code }],
    }));
}

function collectCaptureExamples() {
    const dir = join(ROOT, 'tools', 'docs-capture', 'web');

    return readdirSync(dir)
        .filter((x) => x.endsWith('.cs'))
        .sort()
        .map((file) => ({
            kind: 'playground',
            origin: `tools/docs-capture/web/${file}`,
            files: [{ name: file, code: readFileSync(join(dir, file), 'utf8') }],
        }));
}

function projectFile() {
    const reference = (path) => `        <ProjectReference Include="${path}" />`;
    const compiler = join(REACTIVE_SRC, 'Reactive.Compiler', 'Reactive.Compiler.csproj');

    const references = [
        reference(join(PATHS.pc, 'UnityEngine', 'UnityEngine.csproj')),
        reference(join(PATHS.pc, 'Reactive', 'Reactive.csproj')),
        reference(join(PATHS.pc, 'Reactive.Components', 'Reactive.Components.csproj')),
        reference(join(PATHS.pc, 'Reactive.BeatSaber', 'Reactive.BeatSaber.csproj')),
        `        <ProjectReference Include="${compiler}"`
        + ' ReferenceOutputAssembly="false" OutputItemType="Analyzer" />',
    ];

    return [
        '<Project Sdk="Microsoft.NET.Sdk">',
        '    <PropertyGroup>',
        '        <OutputType>Library</OutputType>',
        '        <Nullable>enable</Nullable>',
        '    </PropertyGroup>',
        '    <ItemGroup>',
        ...references,
        '    </ItemGroup>',
        '</Project>',
        '',
    ].join('\n');
}

function writePlaygroundExample(example) {
    const codes = example.files.map((x) => x.code);
    const assembled = assemble(codes, 'pc');

    writeFileSync(join(example.dir, 'Example.cs'), assembled.text);
    writeFileSync(join(example.dir, 'GlobalUsings.cs'), COMPILER_USINGS.join('\n') + '\n');

    // Maps a position in the assembled file back to the docs file it came from
    example.locate = (line, column) => {
        const lineStart = assembled.text
            .split('\n')
            .slice(0, line - 1)
            .reduce((total, x) => total + x.length + 1, 0);
        const offset = lineStart + column - 1;

        for (let i = codes.length - 1; i >= 0; i--) {
            if (offset < assembled.starts[i]) {
                continue;
            }

            const before = assembled.text.slice(assembled.starts[i], offset);
            const row = before.split('\n').length;
            const col = offset - assembled.starts[i] - before.lastIndexOf('\n');
            return `${example.files[i].name}(${row},${col})`;
        }

        return `Example.cs(${line},${column})`;
    };
}

function writeCompileExample(example) {
    const own = new Set(example.code.split('\n').map((x) => x.trim()));
    const usings = CSHARP_PRELUDE
        .split('\n')
        .filter((x) => !own.has(x))
        .map((x) => `global ${x}`);

    writeFileSync(join(example.dir, 'Usings.cs'), usings.join('\n') + '\n');

    if (DECLARES_TYPE.test(example.code)) {
        writeFileSync(join(example.dir, 'App.cs'), example.code);
        example.locate = (line, column) => `App.cs(${line},${column})`;
        return;
    }

    writeFileSync(join(example.dir, 'App.cs'), `${WRAPPER}${example.code}\nreturn null!; } }\n`);
    example.locate = (line, column) => {
        const col = line === 1 ? column - WRAPPER.length : column;
        return `App.cs(${line},${col})`;
    };
}

function writeProjects(examples) {
    remove(WORK);
    mkdirSync(WORK, { recursive: true });

    // The examples sit outside playground/pc, so they import its settings themselves
    const settings = join(PATHS.pc, 'Directory.Build.props');
    writeFileSync(
        join(WORK, 'Directory.Build.props'),
        `<Project>\n    <Import Project="${settings}" />\n</Project>\n`,
    );

    examples.forEach((example, index) => {
        example.name = `E${String(index).padStart(3, '0')}`;
        example.dir = join(WORK, example.name);

        mkdirSync(example.dir, { recursive: true });
        writeFileSync(join(example.dir, `${example.name}.csproj`), projectFile());

        if (example.kind === 'playground') {
            writePlaygroundExample(example);
        } else {
            writeCompileExample(example);
        }
    });

    const projects = examples.map((x) => `    <Project Path="${x.name}/${x.name}.csproj" />`);
    writeFileSync(join(WORK, 'Examples.slnx'), `<Solution>\n${projects.join('\n')}\n</Solution>\n`);
}

function buildProjects() {
    const result = spawnSync(
        'dotnet',
        ['build', join(WORK, 'Examples.slnx'), '-m', '-nologo', '-v:q', '-clp:NoSummary'],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );

    if (result.error) {
        throw result.error;
    }
    return `${result.stdout}\n${result.stderr}`;
}

function attributeDiagnostics(examples, output) {
    const unattributed = [];

    for (const example of examples) {
        example.diagnostics = [];
    }

    for (const line of output.split('\n').map((x) => x.trim())) {
        const match = DIAGNOSTIC.exec(line);

        if (!match) {
            if (/\berror (MSB|NU|NETSDK)\d+/.test(line)) {
                unattributed.push(line);
            }
            continue;
        }

        const [, file, row, column, severity, id, message] = match;
        const example = examples.find((x) => file.startsWith(x.dir + '/') || file.startsWith(x.dir + '\\'));

        if (!example) {
            if (severity === 'error') {
                unattributed.push(line);
            }
            continue;
        }

        const text = `${example.locate(Number(row), Number(column))}: ${severity} ${id}: ${message}`;
        if (!example.diagnostics.includes(text)) {
            example.diagnostics.push(text);
        }
    }

    return unattributed;
}

function report(examples, unattributed) {
    const failures = examples.filter((x) => x.diagnostics.length > 0);
    const runnable = examples.filter((x) => x.kind === 'playground').length;

    console.log(`Built ${runnable} runnable examples and ${examples.length - runnable} compile examples`);

    for (const example of failures) {
        console.log(`\n${example.origin} should compile cleanly`);

        for (const line of example.diagnostics) {
            console.log(`  ${line}`);
        }
    }

    for (const line of unattributed) {
        console.log(`\n${line}`);
    }

    if (failures.length > 0 || unattributed.length > 0) {
        const other = unattributed.length > 0 ? ', and the build reported other errors' : '';
        console.log(`\n${failures.length} examples failed${other}`);
        return false;
    }

    console.log('All examples match');
    return true;
}

function main() {
    if (!existsSync(REACTIVE_SRC)) {
        throw new Error('No Reactive download, run yarn build:playground first');
    }

    const examples = [
        ...collectDocsExamples(),
        ...collectSamples(),
        ...collectCaptureExamples(),
    ];

    writeProjects(examples);
    const unattributed = attributeDiagnostics(examples, buildProjects());

    if (!report(examples, unattributed)) {
        process.exit(1);
    }
}

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
