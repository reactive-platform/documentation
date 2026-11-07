import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { cpp, csharp } from '@codemirror/legacy-modes/mode/clike';
import { type Diagnostic, setDiagnostics } from '@codemirror/lint';
import { Compartment, EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';
import { basicSetup } from 'codemirror';
import './playground.css';
import type { CompilerDiagnostic, CompletionResponse, PlatformName } from './runtime';

const LANGUAGES = {
    pc: { syntax: csharp, completeAfter: /[\w.]/ },
    quest: { syntax: cpp, completeAfter: /[\w.]|->|::/ },
};

// The same metrics as the docs' code blocks, so a block turning into an editor doesn't move
const editorTheme = EditorView.theme({
    '&': { fontSize: '13px' },
    '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        lineHeight: '1.4286',
    },
    '.cm-content': { padding: '12px 0' },
    '.cm-line': { padding: '0 16px' },
});

function isDark() {
    return document.documentElement.classList.contains('dark');
}

export interface EditorOptions {
    parent: HTMLElement;
    doc: string;
    platform: PlatformName;
    onChange?: () => void;
    complete?: (code: string, position: number) => Promise<CompletionResponse | null>;
}

/** A CodeMirror editor set up for one platform's language, styled like the docs' code blocks. Lines don't wrap. */
export class Editor {
    readonly view: EditorView;

    private readonly themeObserver: MutationObserver;

    constructor({ parent, doc, platform, onChange, complete }: EditorOptions) {
        const language = LANGUAGES[platform];
        const themeCompartment = new Compartment();

        const completionSource = async (context: CompletionContext): Promise<CompletionResult | null> => {
            if (!complete) return null;
            if (!context.explicit && !context.matchBefore(language.completeAfter)) return null;
            const result = await complete(context.state.doc.toString(), context.pos);
            return result && { from: result.from, options: result.options, validFor: /^\w*$/ };
        };

        this.view = new EditorView({
            parent,
            state: EditorState.create({
                doc,
                extensions: [
                    basicSetup,
                    StreamLanguage.define(language.syntax),
                    syntaxHighlighting(classHighlighter),
                    autocompletion({ override: [completionSource] }),
                    editorTheme,
                    themeCompartment.of(EditorView.theme({}, { dark: isDark() })),
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) onChange?.();
                    }),
                ],
            }),
        });

        this.themeObserver = new MutationObserver(() => {
            this.view.dispatch({ effects: themeCompartment.reconfigure(EditorView.theme({}, { dark: isDark() })) });
        });
        this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }

    get code() {
        return this.view.state.doc.toString();
    }

    setCode(code: string) {
        this.view.dispatch({
            changes: { from: 0, to: this.view.state.doc.length, insert: code },
            selection: EditorSelection.single(0),
        });
    }

    /** Underlines the diagnostics that point into the document. */
    showDiagnostics(diagnostics: CompilerDiagnostic[]) {
        const length = this.view.state.doc.length;
        const marks: Diagnostic[] = diagnostics
            .filter((x) => x.severity !== 'info' && x.from >= 0 && x.from <= length)
            .map((x) => ({
                from: x.from,
                to: Math.min(Math.max(x.to, x.from + 1), length),
                severity: x.severity,
                message: `${x.id}: ${x.message}`,
            }));
        this.view.dispatch(setDiagnostics(this.view.state, marks));
    }

    jumpTo(position: number) {
        this.view.dispatch({
            selection: EditorSelection.single(position),
            effects: EditorView.scrollIntoView(position, { y: 'center' }),
        });
        this.view.focus();
    }

    destroy() {
        this.themeObserver.disconnect();
        this.view.destroy();
    }
}
