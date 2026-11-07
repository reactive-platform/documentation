import type { CompilerDiagnostic, PlatformName } from './runtime';

/** One file of an example: what a tab shows and what the compiler gets, together with the other files. */
export interface SourceFile {
    name: string;
    code: string;
}

/** Prepended to a C# example that imports no namespaces itself, so docs can show the component alone. */
export const CSHARP_PRELUDE = [
    'using System;',
    'using System.Collections;',
    'using System.Collections.Generic;',
    'using System.Linq;',
    'using Reactive;',
    'using Reactive.Compiler;',
    'using Reactive.BeatSaber;',
    'using Reactive.BeatSaber.Components;',
    'using Reactive.Components;',
    'using Reactive.Components.Basic;',
    'using Reactive.Yoga;',
    'using TMPro;',
    'using HMUI;',
    'using UnityEngine;',
    'using UnityEngine.EventSystems;',
    'using AnimationCurve = Reactive.AnimationCurve;',
    'using MeasureMode = Reactive.MeasureMode;',
    'using Background = Reactive.BeatSaber.Components.Background;',
    'using Image = Reactive.BeatSaber.Components.Image;',
    'using Label = Reactive.BeatSaber.Components.Label;',
    'using ScrollArea = Reactive.BeatSaber.Components.ScrollArea;',
].join('\n');

// Only lines at the start of a line count: an indented `using` belongs to a namespace, a class or a method body.
// `using X;` and `using namespace X;` have no `=`, which also keeps `using var x = y;` out of it.
const USING = /^using\s+[^=;]+;[ \t]*$/gm;
const HAS_USING = /^using\s+[^=;]+;[ \t]*$/m;
// A C# alias has to come before any type too. C++ aliases stay put, since they can depend on the code above them
const ALIAS = /^using\s+(?!var\b)\w+\s*=\s*[^;]+;[ \t]*$/gm;
const INCLUDE = /^[ \t]*#include\s.*$/gm;

export interface Assembled {
    /** The text handed to the compiler. */
    text: string;
    /** Where each file's text starts in it. The files keep their length, so positions map back directly. */
    starts: number[];
}

/**
 * Joins the files into one compilation. Includes, `using` lines and C# aliases are hoisted to the top, since they
 * have to come before any type, and are blanked out in place so every offset in a file is the same in the compiled
 * text. Files are joined in order, so in C++ a file sees only what the files before it declare.
 */
export function assemble(codes: string[], platform: PlatformName): Assembled {
    const includes = new Set<string>();
    const usings = new Set<string>();
    const aliases = new Set<string>();
    const hoist = (into: Set<string>) => (line: string) => {
        into.add(line.trim());
        return ' '.repeat(line.length);
    };
    const bodies = codes.map((code) => {
        const body = code.replace(INCLUDE, hoist(includes)).replace(USING, hoist(usings));
        return platform === 'pc' ? body.replace(ALIAS, hoist(aliases)) : body;
    });

    const prelude = platform === 'pc' && usings.size === 0 ? CSHARP_PRELUDE.split('\n') : [];
    const head = [...new Set([...includes, ...prelude, ...usings, ...aliases])].join('\n') + '\n\n';
    const starts: number[] = [];
    let text = head;
    for (const body of bodies) {
        starts.push(text.length);
        text += body + '\n\n';
    }
    return { text, starts };
}

/** Moves a diagnostic from the compiled text onto the file it points into. */
export function locate(diagnostic: CompilerDiagnostic, assembled: Assembled, codes: string[]) {
    if (diagnostic.from >= 0) {
        for (let i = codes.length - 1; i >= 0; i--) {
            const start = assembled.starts[i];
            if (diagnostic.from >= start && diagnostic.from <= start + codes[i].length) {
                const from = diagnostic.from - start;
                const before = codes[i].slice(0, from);
                return { file: i, from, to: diagnostic.to - start, line: before.split('\n').length, column: from - before.lastIndexOf('\n') };
            }
        }
    }
    return { file: 0, from: -1, to: -1, line: diagnostic.line, column: diagnostic.column };
}

/**
 * The files as the playground page should receive them. A docs example that relies on the prelude gets it written
 * into its first file, so the page shows everything the code needs to compile in a real project.
 */
export function withPrelude(files: SourceFile[], platform: PlatformName): SourceFile[] {
    if (platform !== 'pc' || files.length === 0 || files.some((file) => HAS_USING.test(file.code))) return files;
    return [{ ...files[0], code: `${CSHARP_PRELUDE}\n\n${files[0].code}` }, ...files.slice(1)];
}

export function fileExtension(platform: PlatformName) {
    return platform === 'quest' ? 'cpp' : 'cs';
}

/** A name for a file that has none: after the first type it declares, or a plain default. */
export function defaultFileName(code: string, platform: PlatformName) {
    const type = /\b(?:class|struct|record|interface|enum)\s+([A-Za-z_]\w*)/.exec(code);
    if (type) return `${type[1]}.${fileExtension(platform)}`;
    return platform === 'quest' ? 'main.cpp' : 'Program.cs';
}

/** A name no other file has, for a file the user adds. */
export function freshFileName(taken: string[], platform: PlatformName) {
    for (let n = taken.length + 1; ; n++) {
        const name = `File${n}.${fileExtension(platform)}`;
        if (!taken.includes(name)) return name;
    }
}
