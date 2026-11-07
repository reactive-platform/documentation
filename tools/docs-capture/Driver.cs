using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using IPA.Utilities;
using Reactive;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace DocsCapture;

/// <summary>
/// Reads UserData/docs-capture.cmd (one command per line), runs one command per frame and writes the
/// results to UserData/docs-capture.out once the whole batch is done. Renders samples on a flat
/// screen-space canvas drawn by its own camera, so a screenshot shows only the sample.
/// </summary>
public class Driver : MonoBehaviour {
    public static void Boot() {
        try {
            var go = new GameObject("DocsCaptureDriver");
            DontDestroyOnLoad(go);
            go.AddComponent<Driver>();
            Plugin.Log.Info("Docs capture driver started");
        } catch (Exception e) {
            Plugin.Log.Error(e);
        }
    }

    private static string CmdPath => Path.Combine(UnityGame.UserDataPath, "docs-capture.cmd");
    private static string OutPath => Path.Combine(UnityGame.UserDataPath, "docs-capture.out");

    private readonly Queue<string> _pending = new();
    private readonly StringBuilder _out = new();
    private int _waitFrames;
    private bool _consoleOff;
    private float _pollTimer;

    private Coroutine? _recording;
    private string? _recDir;
    private int _recFrame;

    private Camera? _camera;
    private Canvas? _canvas;
    private RectTransform? _root;
    private GameObject? _current;

    private void Update() {
        if (_consoleOff) {
            Debug.developerConsoleVisible = false;
        }

        if (_waitFrames > 0) {
            _waitFrames--;
            return;
        }

        if (_pending.Count == 0) {
            _pollTimer += Time.unscaledDeltaTime;
            if (_pollTimer < 0.1f) return;
            _pollTimer = 0f;

            if (!File.Exists(CmdPath)) return;

            string text;
            try {
                text = File.ReadAllText(CmdPath);
                File.Delete(CmdPath);
            } catch (Exception e) {
                Plugin.Log.Error(e);
                return;
            }

            foreach (var line in text.Split('\n')) {
                var trimmed = line.Trim();
                if (trimmed.Length > 0 && !trimmed.StartsWith("#")) {
                    _pending.Enqueue(trimmed);
                }
            }

            _out.Clear();
            if (_pending.Count == 0) {
                Finish();
                return;
            }
        }

        var cmd = _pending.Dequeue();
        try {
            Execute(cmd);
        } catch (Exception e) {
            var inner = e is TargetInvocationException { InnerException: { } i } ? i : e;
            _out.AppendLine($"ERR {cmd}: {inner.GetType().Name}: {inner.Message}");
            Plugin.Log.Error(inner);
        }

        if (_pending.Count == 0 && _waitFrames == 0) {
            Finish();
        } else if (_pending.Count == 0) {
            _pending.Enqueue("nop");
        }
    }

    private void LateUpdate() {
        if (_consoleOff) {
            Debug.developerConsoleVisible = false;
        }
    }

    private void Finish() {
        try {
            var tmp = OutPath + ".tmp";
            File.WriteAllText(tmp, _out.Length == 0 ? "ok\n" : _out.ToString());
            if (File.Exists(OutPath)) File.Delete(OutPath);
            File.Move(tmp, OutPath);
        } catch (Exception e) {
            Plugin.Log.Error(e);
        }
    }

    #region Canvas

    private readonly List<Camera> _disabledCameras = new();

    private void SetOtherCameras(bool enabled) {
        if (!enabled) {
            foreach (var cam in Camera.allCameras) {
                if (cam != _camera && cam.enabled) {
                    cam.enabled = false;
                    _disabledCameras.Add(cam);
                }
            }
        } else {
            foreach (var cam in _disabledCameras) {
                if (cam != null) cam.enabled = true;
            }
            _disabledCameras.Clear();
        }
    }

    private void EnsureCanvas(float pixelsPerPoint) {
        if (_canvas != null) {
            _camera!.enabled = true;
            _canvas.gameObject.SetActive(true);
            _canvas.GetComponent<CanvasScaler>().scaleFactor = pixelsPerPoint;
            SetOtherCameras(false);
            return;
        }

        var camGo = new GameObject("DocsCaptureCamera");
        DontDestroyOnLoad(camGo);
        camGo.transform.position = new Vector3(0f, -500f, 0f);
        _camera = camGo.AddComponent<Camera>();
        _camera.clearFlags = CameraClearFlags.SolidColor;
        _camera.backgroundColor = Color.black;
        _camera.cullingMask = 1 << 5;
        _camera.depth = 100f;
        _camera.orthographic = true;
        _camera.nearClipPlane = 0.1f;
        _camera.farClipPlane = 10f;
        _camera.allowHDR = false;
        _camera.allowMSAA = true;

        var canvasGo = new GameObject("DocsCaptureCanvas") { layer = 5 };
        DontDestroyOnLoad(canvasGo);
        _canvas = canvasGo.AddComponent<Canvas>();
        _canvas.renderMode = RenderMode.ScreenSpaceCamera;
        _canvas.worldCamera = _camera;
        _canvas.planeDistance = 1f;
        _canvas.sortingOrder = 100;
        _canvas.additionalShaderChannels = AdditionalCanvasShaderChannels.TexCoord1 | AdditionalCanvasShaderChannels.TexCoord2 | AdditionalCanvasShaderChannels.Normal | AdditionalCanvasShaderChannels.Tangent;

        var scaler = canvasGo.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ConstantPixelSize;
        scaler.scaleFactor = pixelsPerPoint;

        var rootGo = new GameObject("Root") { layer = 5 };
        _root = rootGo.AddComponent<RectTransform>();
        _root.SetParent(canvasGo.transform, false);
        _root.anchorMin = Vector2.zero;
        _root.anchorMax = Vector2.one;
        _root.offsetMin = Vector2.zero;
        _root.offsetMax = Vector2.zero;
        rootGo.AddComponent<Composition>();
        SetOtherCameras(false);
    }

    // Pushed overlays get reparented under the root, so everything under it goes, not just the sample
    private void ClearRoot() {
        if (_root == null) return;
        for (var i = _root.childCount - 1; i >= 0; i--) {
            var child = _root.GetChild(i).gameObject;
            child.SetActive(false);
            Destroy(child);
        }
        // Overlays destroyed without popping leave the composition dimmed, so start it over
        var composition = _root.GetComponent<Composition>();
        if (composition != null) Destroy(composition);
        var group = _root.GetComponent<CanvasGroup>();
        if (group != null) Destroy(group);
        _root.gameObject.AddComponent<Composition>();
        _current = null;
    }

    private void SetRootSize(float? width, float? height) {
        if (_root == null) return;
        if (width == null && height == null) {
            _root.anchorMin = Vector2.zero;
            _root.anchorMax = Vector2.one;
            _root.offsetMin = Vector2.zero;
            _root.offsetMax = Vector2.zero;
            return;
        }
        _root.anchorMin = new Vector2(0.5f, 0.5f);
        _root.anchorMax = new Vector2(0.5f, 0.5f);
        _root.pivot = new Vector2(0.5f, 0.5f);
        var canvasRect = ((RectTransform)_canvas!.transform).rect;
        _root.sizeDelta = new Vector2(width ?? canvasRect.width, height ?? canvasRect.height);
        _root.anchoredPosition = Vector2.zero;
    }

    #endregion

    #region Commands

    private void Execute(string cmd) {
        var parts = SplitArgs(cmd);
        var name = parts[0];
        var args = parts.Skip(1).ToArray();

        switch (name) {
            case "nop":
                break;

            case "wait":
                _waitFrames = int.Parse(args[0]);
                break;

            case "console":
                _consoleOff = args.Length == 0 || args[0] == "off";
                Debug.developerConsoleVisible = !_consoleOff;
                typeof(Debug).GetProperty("developerConsoleEnabled", BindingFlags.Public | BindingFlags.Static)?.SetValue(null, !_consoleOff);
                _out.AppendLine("ok console");
                break;

            case "canvas": {
                EnsureCanvas(args.Length > 0 ? F(args[0]) : 10f);
                var rect = ((RectTransform)_canvas!.transform).rect;
                _out.AppendLine($"ok canvas {rect.width}x{rect.height}pt");
                break;
            }

            case "hide":
                SetOtherCameras(true);
                if (_camera != null) _camera.enabled = false;
                if (_canvas != null) _canvas.gameObject.SetActive(false);
                _out.AppendLine("ok hide");
                break;

            case "bg":
                EnsureCanvas(10f);
                _camera!.backgroundColor = new Color(F(args[0]), F(args[1]), F(args[2]), 1f);
                _out.AppendLine("ok bg");
                break;

            case "clear":
                ClearRoot();
                _out.AppendLine("ok clear");
                break;

            case "show": {
                EnsureCanvas(10f);
                ClearRoot();
                SetRootSize(args.Length > 1 ? F(args[1]) : null, args.Length > 2 ? F(args[2]) : null);
                var comp = Samples.Create(args[0]);
                _current = comp.Use(_root);
                _out.AppendLine($"ok show {args[0]}");
                break;
            }

            case "campos":
                _camera!.transform.position = new Vector3(F(args[0]), F(args[1]), F(args[2]));
                _out.AppendLine("ok campos");
                break;

            case "canvasinfo": {
                foreach (var c in Resources.FindObjectsOfTypeAll<Canvas>()) {
                    if (!c.gameObject.activeInHierarchy && c != _canvas) continue;
                    var sc = c.GetComponent<CanvasScaler>();
                    _out.AppendLine($"{HierarchyPath(c.transform)} mode={c.renderMode} refPPU={c.referencePixelsPerUnit} scale={c.scaleFactor} lossyScale={c.transform.lossyScale} scaler={(sc == null ? "-" : $"{sc.uiScaleMode}/{sc.referencePixelsPerUnit}/{sc.scaleFactor}/{sc.dynamicPixelsPerUnit}")}");
                }
                break;
            }

            case "canvasref": {
                var sc = _canvas!.GetComponent<CanvasScaler>();
                sc.referencePixelsPerUnit = F(args[0]);
                if (args.Length > 1) sc.dynamicPixelsPerUnit = F(args[1]);
                _out.AppendLine($"ok canvasref {sc.referencePixelsPerUnit} {sc.dynamicPixelsPerUnit}");
                break;
            }

            case "rec": {
                if (args[0] == "start") {
                    _recDir = System.IO.Path.Combine(UnityGame.UserDataPath, "docs-rec", args[1]);
                    if (Directory.Exists(_recDir)) Directory.Delete(_recDir, true);
                    Directory.CreateDirectory(_recDir);
                    _recFrame = 0;
                    Time.captureFramerate = args.Length > 2 ? int.Parse(args[2]) : 20;
                    _recording = StartCoroutine(Record());
                    _out.AppendLine($"ok rec start {args[1]} {Time.captureFramerate}fps");
                } else {
                    if (_recording != null) StopCoroutine(_recording);
                    _recording = null;
                    Time.captureFramerate = 0;
                    _out.AppendLine($"ok rec stop {_recFrame} frames");
                }
                break;
            }

            case "timescale":
                Time.timeScale = F(args[0]);
                _out.AppendLine($"ok timescale {Time.timeScale}");
                break;

            case "find": {
                var i = 0;
                foreach (var comp in FindComponents(args[0])) {
                    _out.AppendLine($"{i++} {TypeName(comp.GetType())} {HierarchyPath(comp)}");
                }
                if (i == 0) _out.AppendLine("none");
                break;
            }

            case "dump": {
                var comp = Pick(args[0], args[1]);
                foreach (var prop in comp.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance)) {
                    if (prop.GetIndexParameters().Length > 0) continue;
                    object? value;
                    try {
                        value = prop.GetValue(comp);
                    } catch (Exception e) {
                        value = $"<{e.GetType().Name}>";
                    }
                    _out.AppendLine($"{prop.Name} ({TypeName(prop.PropertyType)}) = {value}");
                }
                break;
            }

            case "set": {
                var comp = Pick(args[0], args[1]);
                var (target, member) = Resolve(comp, args[2]);
                var value = string.Join(" ", args.Skip(3));
                switch (member) {
                    case PropertyInfo p:
                        p.SetValue(target, Parse(value, p.PropertyType));
                        break;
                    case FieldInfo f:
                        f.SetValue(target, Parse(value, f.FieldType));
                        break;
                    default:
                        throw new ArgumentException($"{args[2]} is not settable");
                }
                _out.AppendLine($"ok set {args[2]}");
                break;
            }

            case "get": {
                var comp = Pick(args[0], args[1]);
                var (target, member) = Resolve(comp, args[2]);
                var value = member switch {
                    PropertyInfo p => p.GetValue(target),
                    FieldInfo f => f.GetValue(target),
                    _ => null
                };
                _out.AppendLine($"{args[2]} = {value}");
                break;
            }

            case "call": {
                var comp = Pick(args[0], args[1]);
                var (target, member) = Resolve(comp, args[2]);
                var rest = args.Skip(3).ToArray();
                object? result;
                switch (member) {
                    case MethodInfo m: {
                        var ps = m.GetParameters();
                        var values = ps.Select((p, i) => i < rest.Length ? Parse(rest[i], p.ParameterType) : (p.HasDefaultValue ? p.DefaultValue : null)).ToArray();
                        result = m.Invoke(target, values);
                        break;
                    }
                    case PropertyInfo p when typeof(Delegate).IsAssignableFrom(p.PropertyType): {
                        var del = p.GetValue(target) as Delegate ?? throw new InvalidOperationException($"{args[2]} is null");
                        var ps = del.GetType().GetMethod("Invoke")!.GetParameters();
                        var values = ps.Select((q, i) => i < rest.Length ? Parse(rest[i], q.ParameterType) : null).ToArray();
                        result = del.DynamicInvoke(values);
                        break;
                    }
                    default:
                        throw new ArgumentException($"{args[2]} is not callable");
                }
                _out.AppendLine($"ok call {args[2]} = {result}");
                break;
            }

            case "pointer": {
                var comp = Pick(args[0], args[1]);
                // The handler usually sits on an inner background, and events only bubble upwards
                var handler = comp.Content.GetComponentInChildren<Reactive.Components.PointerEventsHandler>(true);
                var go = handler != null ? handler.gameObject : comp.Content;
                var data = new PointerEventData(EventSystem.current) {
                    position = new Vector2(UnityEngine.Screen.width / 2f, UnityEngine.Screen.height / 2f),
                    button = PointerEventData.InputButton.Left
                };
                switch (args[2]) {
                    case "enter":
                        ExecuteEvents.ExecuteHierarchy(go, data, ExecuteEvents.pointerEnterHandler);
                        break;
                    case "exit":
                        ExecuteEvents.ExecuteHierarchy(go, data, ExecuteEvents.pointerExitHandler);
                        break;
                    case "down":
                        ExecuteEvents.ExecuteHierarchy(go, data, ExecuteEvents.pointerDownHandler);
                        break;
                    case "up":
                        ExecuteEvents.ExecuteHierarchy(go, data, ExecuteEvents.pointerUpHandler);
                        break;
                    case "click":
                        ExecuteEvents.ExecuteHierarchy(go, data, ExecuteEvents.pointerDownHandler);
                        ExecuteEvents.ExecuteHierarchy(go, data, ExecuteEvents.pointerUpHandler);
                        ExecuteEvents.ExecuteHierarchy(go, data, ExecuteEvents.pointerClickHandler);
                        break;
                    default:
                        throw new ArgumentException(args[2]);
                }
                _out.AppendLine($"ok pointer {args[2]}");
                break;
            }

            case "screen":
                _out.AppendLine($"{UnityEngine.Screen.width}x{UnityEngine.Screen.height}");
                break;

            default:
                throw new ArgumentException($"unknown command {name}");
        }
    }

    #endregion

    private IEnumerator Record() {
        while (true) {
            yield return new WaitForEndOfFrame();
            var tex = ScreenCapture.CaptureScreenshotAsTexture();
            var bytes = tex.EncodeToPNG();
            Destroy(tex);
            File.WriteAllBytes(System.IO.Path.Combine(_recDir!, $"f{_recFrame++:D4}.png"), bytes);
        }
    }

    #region Lookup

    private static readonly Type hostType = typeof(ReactiveComponent).GetNestedType("ReactiveHost", BindingFlags.NonPublic)!;
    private static readonly FieldInfo componentsField = hostType.GetField("_components", BindingFlags.NonPublic | BindingFlags.Instance)!;

    private IEnumerable<ReactiveComponent> AllComponents() {
        var hosts = Resources.FindObjectsOfTypeAll(hostType).Cast<MonoBehaviour>();
        return hosts
            .Where(x => x != null && (_canvas == null || x.transform.IsChildOf(_canvas.transform)))
            .OrderBy(x => SiblingPath(x.transform))
            .SelectMany(x => (IEnumerable<ReactiveComponent>)componentsField.GetValue(x));
    }

    private IEnumerable<ReactiveComponent> FindComponents(string typeName) {
        return AllComponents().Where(x => Matches(x.GetType(), typeName));
    }

    private static bool Matches(Type type, string name) {
        for (var t = type; t != null; t = t.BaseType) {
            if (TypeName(t) == name) return true;
        }
        return false;
    }

    private ReactiveComponent Pick(string typeName, string index) {
        var list = FindComponents(typeName).ToList();
        if (list.Count == 0) throw new ArgumentException($"no {typeName}");
        var i = int.Parse(index);
        if (i < 0 || i >= list.Count) throw new ArgumentException($"{typeName} has {list.Count} instances");
        return list[i];
    }

    private static (object target, MemberInfo member) Resolve(object root, string path) {
        var segments = path.Split('.');
        var target = root;
        for (var i = 0; i < segments.Length; i++) {
            var type = target.GetType();
            const BindingFlags flags = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance;
            MemberInfo member = (MemberInfo?)type.GetProperty(segments[i], flags)
                ?? (MemberInfo?)type.GetField(segments[i], flags)
                ?? type.GetMethods(flags).FirstOrDefault(m => m.Name == segments[i])
                ?? throw new ArgumentException($"{TypeName(type)} has no {segments[i]}");
            if (i == segments.Length - 1) {
                return (target, member);
            }
            target = member switch {
                PropertyInfo p => p.GetValue(target),
                FieldInfo f => f.GetValue(target),
                _ => null
            } ?? throw new ArgumentException($"{segments[i]} is null");
        }
        throw new ArgumentException(path);
    }

    private static string TypeName(Type type) {
        var name = type.Name;
        var tick = name.IndexOf('`');
        return tick >= 0 ? name.Substring(0, tick) : name;
    }

    private static string HierarchyPath(ReactiveComponent comp) {
        try {
            return HierarchyPath(comp.ContentTransform);
        } catch {
            return "?";
        }
    }

    // Siblings often share a name, so order by position in the tree rather than by name
    private static string SiblingPath(Transform t) {
        var sb = new StringBuilder();
        for (; t != null; t = t.parent) {
            sb.Insert(0, t.GetSiblingIndex().ToString("D4") + "/");
        }
        return sb.ToString();
    }

    private static string HierarchyPath(Transform t) {
        var sb = new StringBuilder(t.name);
        while (t.parent != null) {
            t = t.parent;
            sb.Insert(0, t.name + "/");
        }
        return sb.ToString();
    }

    #endregion

    #region Parsing

    private static float F(string s) => float.Parse(s, CultureInfo.InvariantCulture);

    private static object? Parse(string value, Type type) {
        var underlying = Nullable.GetUnderlyingType(type) ?? type;
        if (value == "null") return null;
        if (underlying == typeof(string)) return value;
        if (underlying == typeof(bool)) return bool.Parse(value);
        if (underlying == typeof(int)) return int.Parse(value);
        if (underlying == typeof(float)) return F(value);
        if (underlying == typeof(double)) return double.Parse(value, CultureInfo.InvariantCulture);
        if (underlying.IsEnum) return Enum.Parse(underlying, value, true);
        if (underlying == typeof(Color)) {
            var p = value.Split(',').Select(F).ToArray();
            return new Color(p[0], p[1], p[2], p.Length > 3 ? p[3] : 1f);
        }
        if (underlying == typeof(Vector2)) {
            var p = value.Split(',').Select(F).ToArray();
            return new Vector2(p[0], p[1]);
        }
        if (underlying == typeof(Vector3)) {
            var p = value.Split(',').Select(F).ToArray();
            return new Vector3(p[0], p[1], p[2]);
        }
        if (underlying == typeof(object)) return value;
        throw new ArgumentException($"cannot parse {TypeName(type)} from '{value}'");
    }

    private static string[] SplitArgs(string line) {
        var result = new List<string>();
        var sb = new StringBuilder();
        var quoted = false;
        foreach (var c in line) {
            if (c == '"') {
                quoted = !quoted;
            } else if (c == ' ' && !quoted) {
                if (sb.Length > 0) {
                    result.Add(sb.ToString());
                    sb.Clear();
                }
            } else {
                sb.Append(c);
            }
        }
        if (sb.Length > 0) result.Add(sb.ToString());
        return result.ToArray();
    }

    #endregion
}
