using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Reflection.Metadata;
using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Diagnostics;

namespace Compiler;

public static class Program {
    public static void Main() { }
}

public static partial class Bridge {
    private static byte[]? _image;

    [JSExport]
    public static string Compile(string code) {
        return JsonSerializer.Serialize(SnippetCompiler.Compile(code, out _image));
    }

    [JSExport]
    public static byte[]? TakeAssembly() {
        var image = _image;
        _image = null;
        return image;
    }

    [JSExport]
    public static async Task<string> Analyze() {
        return JsonSerializer.Serialize(await SnippetCompiler.Analyze());
    }

    [JSExport]
    public static string Complete(string code, int position) {
        return JsonSerializer.Serialize(SnippetCompiler.Complete(code, position));
    }
}

internal sealed record DiagnosticInfo(string severity, string id, string message, int from, int to, int line, int column);

internal sealed record CompletionInfo(string label, string type, string? detail);

internal sealed record CompletionList(int from, List<CompletionInfo> options);

internal static class SnippetCompiler {
    private const string FileName = "App.cs";

    private static readonly string[] keywords = SyntaxFacts.GetKeywordKinds()
        .Select(SyntaxFacts.GetText)
        .Where(static x => !x.StartsWith("__"))
        .ToArray();

    private static readonly CSharpParseOptions parseOptions = new(LanguageVersion.Latest);

    private static readonly SyntaxTree globalUsings = CSharpSyntaxTree.ParseText(
        "global using System;\nglobal using System.Collections.Generic;\nglobal using System.Linq;\n",
        parseOptions,
        "GlobalUsings.cs"
    );

    private static List<MetadataReference>? _references;
    private static ISourceGenerator[]? _generators;
    private static ImmutableArray<DiagnosticAnalyzer>? _analyzers;
    private static Compilation? _lastCompilation;
    private static int _compilations;

    private static ISourceGenerator[] Generators => _generators ??= Instances<IIncrementalGenerator>()
        .Select(static x => x.AsSourceGenerator())
        .ToArray();

    private static IEnumerable<T> Instances<T>() {
        return Assembly.Load("Reactive.Compiler").GetTypes()
            .Where(static x => !x.IsAbstract && typeof(T).IsAssignableFrom(x))
            .Select(static x => (T)Activator.CreateInstance(x, nonPublic: true)!);
    }

    private static CSharpCompilation CreateCompilation(SyntaxTree tree) {
        return CSharpCompilation.Create(
            $"PlaygroundSnippet{++_compilations}",
            new[] { tree, globalUsings },
            _references ??= LoadReferences(),
            new CSharpCompilationOptions(
                OutputKind.DynamicallyLinkedLibrary,
                optimizationLevel: OptimizationLevel.Release,
                concurrentBuild: false,
                nullableContextOptions: NullableContextOptions.Enable,
                allowUnsafe: true
            )
        );
    }

    public static List<DiagnosticInfo> Compile(string code, out byte[]? image) {
        _lastCompilation = null;

        var tree = CSharpSyntaxTree.ParseText(code, parseOptions, FileName);
        CSharpGeneratorDriver
            .Create(Generators, parseOptions: parseOptions)
            .RunGeneratorsAndUpdateCompilation(CreateCompilation(tree), out var compilation, out var generatorDiagnostics);

        using var stream = new MemoryStream();
        var emit = compilation.Emit(stream);

        image = emit.Success ? stream.ToArray() : null;
        _lastCompilation = emit.Success ? compilation : null;

        return ToInfos(generatorDiagnostics.Concat(emit.Diagnostics));
    }

    public static async Task<List<DiagnosticInfo>> Analyze() {
        var compilation = _lastCompilation!;
        _lastCompilation = null;

        var analyzers = _analyzers ??= Instances<DiagnosticAnalyzer>().ToImmutableArray();
        var diagnostics = await compilation
            .WithAnalyzers(analyzers, new CompilationWithAnalyzersOptions(null, null, concurrentAnalysis: false, logAnalyzerExecutionTime: false))
            .GetAnalyzerDiagnosticsAsync();

        return ToInfos(diagnostics.Where(InSnippet));
    }

    public static CompletionList Complete(string code, int position) {
        var tree = CSharpSyntaxTree.ParseText(code, parseOptions, FileName);

        CSharpGeneratorDriver
            .Create(Generators, parseOptions: parseOptions, optionsProvider: new DebugConfigurationProvider())
            .RunGeneratorsAndUpdateCompilation(CreateCompilation(tree), out var compilation, out _);

        var from = position;
        var token = tree.GetRoot().FindToken(Math.Max(0, position - 1));

        if (token.Span.End >= position && (token.IsKind(SyntaxKind.IdentifierToken) || token.IsKeyword())) {
            from = token.SpanStart;
            token = token.GetPreviousToken();
        }

        var symbols = Lookup(compilation.GetSemanticModel(tree), token, from, out var includeKeywords);

        var options = symbols
            .Where(static x => x.CanBeReferencedByName || x.ContainingType?.IsExtension == true)
            .DistinctBy(static x => x.Name)
            .Select(ToCompletion)
            .ToList();

        if (includeKeywords) {
            options.AddRange(keywords.Select(static x => new CompletionInfo(x, "keyword", null)));
        }

        return new CompletionList(from, options);
    }

    private static IEnumerable<ISymbol> Lookup(SemanticModel model, SyntaxToken token, int position, out bool includeKeywords) {
        includeKeywords = false;

        if (token.IsKind(SyntaxKind.DotToken) && token.Parent is MemberAccessExpressionSyntax access) {
            if (model.GetSymbolInfo(access.Expression).Symbol is INamespaceOrTypeSymbol container) {
                return model.LookupSymbols(position, container);
            }

            var type = model.GetTypeInfo(access.Expression).Type;
            return type == null
                ? Array.Empty<ISymbol>()
                : model.LookupSymbols(position, type, includeReducedExtensionMethods: true).Where(static x => !x.IsStatic);
        }

        if (token.IsKind(SyntaxKind.DotToken) && token.Parent is QualifiedNameSyntax qualified) {
            return model.GetSymbolInfo(qualified.Left).Symbol is INamespaceOrTypeSymbol container
                ? model.LookupSymbols(position, container)
                : Array.Empty<ISymbol>();
        }

        if (token.Kind() is SyntaxKind.OpenBraceToken or SyntaxKind.CommaToken
            && token.Parent is InitializerExpressionSyntax { Parent: var owner }
            && InitializedType(model, owner) is { } initialized) {
            return model.LookupSymbols(position, initialized, includeReducedExtensionMethods: true)
                .Where(static x => x is IPropertySymbol { IsStatic: false } or IFieldSymbol { IsReadOnly: false, IsStatic: false });
        }

        includeKeywords = true;
        return model.LookupSymbols(position);
    }

    private static ITypeSymbol? InitializedType(SemanticModel model, SyntaxNode? owner) {
        return owner switch {
            BaseObjectCreationExpressionSyntax creation => model.GetTypeInfo(creation).Type,
            AssignmentExpressionSyntax assignment when model.GetTypeInfo(assignment.Left).Type is { } type
                && !type.AllInterfaces.Any(static x => x.SpecialType == SpecialType.System_Collections_IEnumerable) => type,
            _ => null
        };
    }

    private static CompletionInfo ToCompletion(ISymbol symbol) {
        var type = symbol switch {
            IMethodSymbol => "method",
            IPropertySymbol or IFieldSymbol or IEventSymbol => "property",
            INamespaceSymbol => "namespace",
            INamedTypeSymbol { TypeKind: TypeKind.Enum } => "enum",
            INamedTypeSymbol { TypeKind: TypeKind.Interface } => "interface",
            INamedTypeSymbol => "class",
            _ => "variable"
        };

        ITypeSymbol? detail = symbol switch {
            IPropertySymbol property => property.Type,
            IFieldSymbol field => field.Type,
            ILocalSymbol local => local.Type,
            IParameterSymbol parameter => parameter.Type,
            IMethodSymbol method => method.ReturnType,
            _ => null
        };

        return new CompletionInfo(symbol.Name, type, detail?.ToDisplayString(SymbolDisplayFormat.MinimallyQualifiedFormat));
    }

    private static bool InSnippet(Diagnostic diagnostic) => diagnostic.Location.SourceTree?.FilePath == FileName;

    private static List<DiagnosticInfo> ToInfos(IEnumerable<Diagnostic> diagnostics) {
        return diagnostics
            .Where(static x => x.Severity == DiagnosticSeverity.Error || (x.Severity == DiagnosticSeverity.Warning && InSnippet(x)))
            .Select(ToInfo)
            .Distinct()
            .ToList();
    }

    private static DiagnosticInfo ToInfo(Diagnostic diagnostic) {
        var span = diagnostic.Location.GetLineSpan();
        var inSnippet = InSnippet(diagnostic);
        var source = diagnostic.Location.SourceSpan;

        return new DiagnosticInfo(
            diagnostic.Severity == DiagnosticSeverity.Error ? "error" : "warning",
            diagnostic.Id,
            diagnostic.GetMessage(),
            inSnippet ? source.Start : -1,
            inSnippet ? source.End : -1,
            span.StartLinePosition.Line + 1,
            span.StartLinePosition.Character + 1
        );
    }

    private static List<MetadataReference> LoadReferences() {
        var seen = new HashSet<string>();
        var result = new List<MetadataReference>();
        var queue = new Queue<AssemblyName>();

        foreach (var name in new[] { "System.Private.CoreLib", "System.Runtime", "System.Collections", "System.Linq", "System.Console", "UnityEngine", "Reactive", "Reactive.Components", "Reactive.BeatSaber" }) {
            queue.Enqueue(new AssemblyName(name));
        }

        while (queue.Count > 0) {
            var name = queue.Dequeue();
            if (name.Name == null || !seen.Add(name.Name)) continue;

            Assembly assembly;
            try {
                assembly = Assembly.Load(name);
            } catch (Exception) {
                continue;
            }

            unsafe {
                if (!assembly.TryGetRawMetadata(out var blob, out var length)) continue;

                var module = ModuleMetadata.CreateFromMetadata((IntPtr)blob, length);
                result.Add(AssemblyMetadata.Create(module).GetReference(display: name.Name));
            }

            foreach (var referenced in assembly.GetReferencedAssemblies()) queue.Enqueue(referenced);
        }

        return result;
    }

    private sealed class DebugConfigurationProvider : AnalyzerConfigOptionsProvider {
        public override AnalyzerConfigOptions GlobalOptions { get; } = new DebugOptions();

        public override AnalyzerConfigOptions GetOptions(SyntaxTree tree) => GlobalOptions;

        public override AnalyzerConfigOptions GetOptions(AdditionalText textFile) => GlobalOptions;

        private sealed class DebugOptions : AnalyzerConfigOptions {
            public override bool TryGetValue(string key, out string value) {
                value = "Debug";
                return key == "build_property.Configuration";
            }
        }
    }
}
