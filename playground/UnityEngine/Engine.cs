using System;
using System.Buffers;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices.JavaScript;
using System.Text;
using System.Text.Json;
using UnityEngine.EventSystems;

namespace UnityEngine {
    internal static partial class Js {
        [JSImport("render", "preview.js")]
        public static partial void Render(string batch);

        [JSImport("log", "preview.js")]
        public static partial void Log(int level, string message);

        [JSImport("measureText", "preview.js")]
        public static partial double[] MeasureText(string text, double fontSize, int style, bool richText);

        [JSImport("uploadTexture", "preview.js")]
        public static partial void UploadTexture(int id, int width, int height, byte[] data, bool encoded);
    }

    public static class PlaygroundEngine {
        private static readonly List<MonoBehaviour> behaviours = new();
        private static readonly List<MonoBehaviour> starts = new();
        private static readonly List<Object> destroyQueue = new();
        private static RectTransform? _root;
        private static bool _dirty = true;

        public static RectTransform Root => _root ??= CreateRoot();

        private static RectTransform CreateRoot() {
            var go = new GameObject("PreviewRoot");
            var rect = go.AddComponent<RectTransform>();
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.zero;
            rect.pivot = Vector2.zero;
            go.AddComponent<Canvas>();
            return rect;
        }

        public static void SetRootSize(float width, float height) => Root.sizeDelta = new Vector2(width, height);

        internal static void MarkDirty() => _dirty = true;

        internal static Vector2 MeasureText(string text, float fontSize, TMPro.FontStyles style, bool richText) {
            var size = Js.MeasureText(text, fontSize, (int)style, richText);
            return new Vector2((float)size[0], (float)size[1]);
        }

        internal static void Register(MonoBehaviour behaviour, bool hasStart) {
            behaviours.Add(behaviour);
            if (hasStart) starts.Add(behaviour);
        }

        internal static void QueueDestroy(Object obj) => destroyQueue.Add(obj);

        internal static void DestroyNow(Object obj) {
            if (obj.destroyed) return;

            MarkDirty();

            if (obj is GameObject go) {
                foreach (var child in go.transform.children.ToArray()) DestroyNow(child.gameObject);
                foreach (var component in go.components.ToArray()) {
                    component.OnDestroying();
                    component.destroyed = true;
                }
                go.transform.parentValue?.children.Remove(go.transform);
                go.transform.parentValue = null;
                go.destroyed = true;
            } else if (obj is Component component) {
                component.OnDestroying();
                component.destroyed = true;
                component.gameObject.components.Remove(component);
            } else {
                obj.destroyed = true;
            }
        }

        public static void Tick(float deltaTime) {
            Time.deltaTime = deltaTime;
            Time.time += deltaTime;
            Time.frameCount++;

            behaviours.RemoveAll(static x => x.destroyed);
            starts.RemoveAll(static x => x.destroyed);

            foreach (var behaviour in starts.ToArray()) {
                if (behaviour.destroyed || !behaviour.isActiveAndEnabled) continue;
                starts.Remove(behaviour);
                behaviour.RunStart();
            }

            var frame = behaviours.ToArray();

            foreach (var behaviour in frame) {
                if (!behaviour.destroyed && behaviour.isActiveAndEnabled) behaviour.RunUpdate();
            }

            foreach (var behaviour in frame) {
                if (behaviour.destroyed || behaviour.coroutines.Count == 0 || !behaviour.isActiveAndEnabled) continue;
                foreach (var coroutine in behaviour.coroutines.ToArray()) StepCoroutine(coroutine);
                behaviour.coroutines.RemoveAll(static x => x.finished);
            }

            foreach (var behaviour in frame) {
                if (!behaviour.destroyed && behaviour.isActiveAndEnabled) behaviour.RunLateUpdate();
            }

            foreach (var obj in destroyQueue.ToArray()) DestroyNow(obj);
            destroyQueue.Clear();

            Canvas.RaisePreWillRender();

            if (_dirty) {
                _dirty = false;
                SceneSync.Flush(Root);
            }
        }

        internal static void StepCoroutine(Coroutine coroutine) {
            if (coroutine.finished || Time.time < coroutine.waitUntil) return;

            try {
                while (coroutine.stack.Count > 0) {
                    var top = coroutine.stack.Peek();

                    if (!top.MoveNext()) {
                        coroutine.stack.Pop();
                        continue;
                    }

                    switch (top.Current) {
                        case WaitForSeconds wait:
                            coroutine.waitUntil = Time.time + wait.seconds;
                            return;
                        case System.Collections.IEnumerator nested:
                            coroutine.stack.Push(nested);
                            continue;
                        default:
                            return;
                    }
                }
            } catch (Exception e) {
                Debug.LogException(e);
            }

            coroutine.finished = true;
        }

        private static readonly List<GameObject> hovered = new();
        private static GameObject? _pressed;
        private static bool _dragging;
        private static Vector2 _lastPosition;

        public static void PointerMove(int id, float x, float y) {
            var data = new PointerEventData { position = new Vector2(x, y), delta = new Vector2(x, y) - _lastPosition };
            _lastPosition = data.position;
            var target = SceneSync.Find(id);
            UpdateHover(target, data);

            if (target != null) ExecuteEvents.ExecuteHierarchy<IPointerMoveHandler>(target, data, static (h, d) => h.OnPointerMove(d));

            if (_pressed != null) {
                if (!_dragging) {
                    _dragging = true;
                    ExecuteEvents.ExecuteHierarchy<IBeginDragHandler>(_pressed, data, static (h, d) => h.OnBeginDrag(d));
                }
                ExecuteEvents.ExecuteHierarchy<IDragHandler>(_pressed, data, static (h, d) => h.OnDrag(d));
            }
        }

        private static void UpdateHover(GameObject? target, PointerEventData data) {
            var chain = new List<GameObject>();
            for (var t = target?.transform; t != null; t = t.parent) chain.Add(t.gameObject);

            foreach (var old in hovered.ToArray()) {
                if (!chain.Contains(old) && old) ExecuteEvents.Execute<IPointerExitHandler>(old, data, static (h, d) => h.OnPointerExit(d));
            }
            for (var i = chain.Count - 1; i >= 0; i--) {
                if (!hovered.Contains(chain[i])) ExecuteEvents.Execute<IPointerEnterHandler>(chain[i], data, static (h, d) => h.OnPointerEnter(d));
            }

            hovered.Clear();
            hovered.AddRange(chain);
        }

        public static void PointerDown(int id, float x, float y) {
            var target = SceneSync.Find(id);
            if (target == null) return;

            var data = new PointerEventData { position = new Vector2(x, y) };
            _pressed = ExecuteEvents.ExecuteHierarchy<IPointerDownHandler>(target, data, static (h, d) => h.OnPointerDown(d)) ?? target;
            _dragging = false;
        }

        public static void PointerUp(int id, float x, float y) {
            if (_pressed == null) return;

            var data = new PointerEventData { position = new Vector2(x, y) };
            ExecuteEvents.ExecuteHierarchy<IPointerUpHandler>(_pressed, data, static (h, d) => h.OnPointerUp(d));
            if (_dragging) ExecuteEvents.ExecuteHierarchy<IEndDragHandler>(_pressed, data, static (h, d) => h.OnEndDrag(d));

            var target = SceneSync.Find(id);
            if (target != null) ExecuteEvents.ExecuteHierarchy<IPointerClickHandler>(target, data, static (h, d) => h.OnPointerClick(d));

            _pressed = null;
            _dragging = false;
        }

        public static void PointerScroll(int id, float x, float y, float deltaY) {
            var target = SceneSync.Find(id);
            if (target == null) return;

            var data = new PointerEventData { position = new Vector2(x, y), scrollDelta = new Vector2(0f, deltaY) };
            ExecuteEvents.ExecuteHierarchy(target, data, ExecuteEvents.scrollHandler);
        }
    }

    internal static class SceneSync {
        private readonly record struct Node(
            int Parent,
            int Index,
            bool Active,
            float X,
            float Y,
            float W,
            float H,
            float ScaleX,
            float ScaleY,
            float PivotX,
            float PivotY,
            float Rotation,
            float Alpha,
            bool Clip,
            int Kind,
            Color Color,
            bool Raycast,
            string? Text,
            float FontSize,
            TMPro.FontStyles FontStyle,
            TMPro.TextAlignmentOptions Align,
            bool Wrap,
            bool RichText,
            TMPro.TextOverflowModes Overflow,
            Sprite? Sprite,
            int TextureVersion,
            UI.Image.Type ImageType,
            UI.Image.FillMethod FillMethod,
            float FillAmount,
            bool PreserveAspect,
            float PixelsPerUnitMultiplier,
            bool FillCenter,
            float Skew,
            bool Gradient,
            HMUI.ImageView.GradientDirection GradientDirection,
            Color Color0,
            Color Color1,
            string? Material,
            string Name
        );

        private static readonly Dictionary<int, Node> last = new();
        private static readonly Dictionary<int, GameObject> objects = new();
        private static readonly HashSet<int> visited = new();
        private static readonly List<int> changed = new();

        public static GameObject? Find(int id) => objects.TryGetValue(id, out var go) && go ? go : null;

        public static void Flush(RectTransform root) {
            visited.Clear();
            changed.Clear();
            Visit(root, 0, 0, 1f, true);

            var removed = last.Keys.Where(static x => !visited.Contains(x)).ToArray();
            if (changed.Count == 0 && removed.Length == 0) return;

            var buffer = new ArrayBufferWriter<byte>();
            using (var writer = new Utf8JsonWriter(buffer)) {
                writer.WriteStartObject();
                writer.WriteStartArray("s");
                foreach (var id in changed) Write(writer, id, last[id]);
                writer.WriteEndArray();
                writer.WriteStartArray("r");
                foreach (var id in removed) {
                    last.Remove(id);
                    objects.Remove(id);
                    writer.WriteNumberValue(id);
                }
                writer.WriteEndArray();
                writer.WriteEndObject();
            }

            Js.Render(Encoding.UTF8.GetString(buffer.WrittenSpan));
        }

        private static void Upload(Texture2D texture) {
            if (texture.uploadedVersion == texture.version) return;
            texture.uploadedVersion = texture.version;

            Js.UploadTexture(texture.id, texture.width, texture.height, texture.encoded ?? texture.ToBytes(), texture.encoded != null);
        }

        private static void Visit(RectTransform transform, int parent, int index, float parentAlpha, bool parentBlocks) {
            var go = transform.gameObject;
            var id = go.id;
            visited.Add(id);
            objects[id] = go;

            var box = parent == 0 ? (x: 0f, y: 0f, w: transform.rect.width, h: transform.rect.height) : transform.BoxInParent();
            var image = go.GetComponent<UI.Image>();
            var text = go.GetComponent<TMPro.TMP_Text>();
            UI.Graphic? graphic = (UI.Graphic?)text ?? image;
            var drawn = graphic is { enabled: true };
            var group = go.GetComponent<CanvasGroup>();
            var scale = transform.localScale;
            var pivot = transform.pivot;
            var sprite = drawn ? image?.sprite : null;
            var view = image as HMUI.ImageView;

            var alpha = parentAlpha;
            var blocks = parentBlocks;
            if (group is { enabled: true }) {
                alpha = group.ignoreParentGroups ? group.alpha : parentAlpha * group.alpha;
                blocks = (group.ignoreParentGroups || parentBlocks) && group.blocksRaycasts;
            }

            if (sprite != null) Upload(sprite.texture);

            var node = new Node(
                Parent: parent,
                Index: index,
                Active: go.activeSelf,
                X: box.x,
                Y: box.y,
                W: box.w,
                H: box.h,
                ScaleX: scale.x,
                ScaleY: scale.y,
                PivotX: pivot.x,
                PivotY: pivot.y,
                Rotation: transform.localEulerAngles.z,
                Alpha: alpha,
                Clip: go.GetComponent<UI.RectMask2D>() is { enabled: true },
                Kind: !drawn ? 0 : text != null ? 2 : 1,
                Color: (graphic?.color ?? Color.clear) * (graphic?.material?.color ?? Color.white),
                Raycast: blocks && graphic is { raycastTarget: true, enabled: true },
                Text: text?.text,
                FontSize: text?.FittedFontSize(box.w, box.h) ?? 0f,
                FontStyle: text?.fontStyle ?? default,
                Align: text?.alignment ?? default,
                Wrap: text?.enableWordWrapping ?? false,
                RichText: text?.HasRichText ?? false,
                Overflow: text?.overflowMode ?? default,
                Sprite: sprite,
                TextureVersion: sprite?.texture.version ?? 0,
                ImageType: image?.type ?? default,
                FillMethod: image?.fillMethod ?? default,
                FillAmount: image?.fillAmount ?? 1f,
                PreserveAspect: image?.preserveAspect ?? false,
                PixelsPerUnitMultiplier: image?.pixelsPerUnitMultiplier ?? 1f,
                FillCenter: image?.fillCenter ?? true,
                Skew: view?._skew ?? 0f,
                Gradient: view?.gradient ?? false,
                GradientDirection: view?._gradientDirection ?? default,
                Color0: view?.color0 ?? Color.white,
                Color1: view?.color1 ?? Color.white,
                Material: graphic?.material?.name,
                Name: go.name
            );

            if (!last.TryGetValue(id, out var previous) || previous != node) {
                last[id] = node;
                changed.Add(id);
            }

            var childIndex = 0;
            foreach (var child in transform.children) {
                if (child is RectTransform rect) Visit(rect, id, childIndex++, alpha, blocks);
            }
        }

        private static void Write(Utf8JsonWriter w, int id, in Node n) {
            w.WriteStartObject();
            w.WriteNumber("id", id);
            w.WriteNumber("p", n.Parent);
            w.WriteNumber("i", n.Index);
            w.WriteBoolean("a", n.Active);
            WriteFloat(w, "x", n.X);
            WriteFloat(w, "y", n.Y);
            WriteFloat(w, "w", n.W);
            WriteFloat(w, "h", n.H);
            WriteFloat(w, "sx", n.ScaleX);
            WriteFloat(w, "sy", n.ScaleY);
            WriteFloat(w, "px", n.PivotX);
            WriteFloat(w, "py", n.PivotY);
            WriteFloat(w, "rz", n.Rotation);
            WriteFloat(w, "o", n.Alpha);
            w.WriteBoolean("cl", n.Clip);
            w.WriteNumber("k", n.Kind);
            w.WriteBoolean("r", n.Raycast);
            WriteColor(w, "c", n.Color);
            if (n.Text != null) {
                w.WriteString("t", n.Text);
                WriteFloat(w, "fs", n.FontSize);
                w.WriteNumber("st", (int)n.FontStyle);
                w.WriteNumber("al", (int)n.Align);
                w.WriteBoolean("wr", n.Wrap);
                w.WriteBoolean("rt", n.RichText);
                w.WriteNumber("of", (int)n.Overflow);
            }
            if (n.Skew != 0f) WriteFloat(w, "sk", n.Skew);
            if (n.Material != null) w.WriteString("m", n.Material);
            if (n.Gradient) {
                w.WriteStartObject("g");
                w.WriteNumber("d", (int)n.GradientDirection);
                WriteColor(w, "a", n.Color0);
                WriteColor(w, "b", n.Color1);
                w.WriteEndObject();
            }
            if (n.Kind == 1) {
                w.WriteNumber("it", (int)n.ImageType);
                w.WriteNumber("fm", (int)n.FillMethod);
                WriteFloat(w, "fa", n.FillAmount);
                w.WriteBoolean("pa", n.PreserveAspect);
                w.WriteBoolean("fc", n.FillCenter);
            }
            if (n.Sprite is { } sprite) {
                w.WriteStartObject("sp");
                w.WriteNumber("t", sprite.texture.id);
                w.WriteNumber("v", n.TextureVersion);
                WriteFloat(w, "x", sprite.rect.x);
                WriteFloat(w, "y", sprite.rect.y);
                WriteFloat(w, "w", sprite.rect.width);
                WriteFloat(w, "h", sprite.rect.height);
                WriteFloats(w, "b", sprite.border.x, sprite.border.y, sprite.border.z, sprite.border.w);
                WriteFloat(w, "u", sprite.pixelsPerUnit * n.PixelsPerUnitMultiplier / UI.Image.ReferencePixelsPerUnit);
                w.WriteEndObject();
            }
            w.WriteString("n", n.Name);
            w.WriteEndObject();
        }

        private static float Rounded(float value) => float.IsFinite(value) ? MathF.Round(value, 3) : 0f;

        private static void WriteFloat(Utf8JsonWriter w, string name, float value) => w.WriteNumber(name, Rounded(value));

        private static void WriteColor(Utf8JsonWriter w, string name, Color c) => WriteFloats(w, name, c.r, c.g, c.b, c.a);

        private static void WriteFloats(Utf8JsonWriter w, string name, float a, float b, float c, float d) {
            w.WriteStartArray(name);
            w.WriteNumberValue(Rounded(a));
            w.WriteNumberValue(Rounded(b));
            w.WriteNumberValue(Rounded(c));
            w.WriteNumberValue(Rounded(d));
            w.WriteEndArray();
        }
    }
}
