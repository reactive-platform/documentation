using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;

namespace UnityEngine {
    public class Object {
        private static int nextId = 1;

        internal readonly int id = nextId++;
        internal bool destroyed;

        public virtual string name {
            get => field ?? string.Empty;
            set;
        }

        public static void Destroy(Object? obj) {
            if (obj is not null && !obj.destroyed) PlaygroundEngine.QueueDestroy(obj);
        }

        public static void DontDestroyOnLoad(Object target) { }

        public static bool operator ==(Object? a, Object? b) {
            var aNull = a is null || a.destroyed;
            var bNull = b is null || b.destroyed;
            if (aNull || bNull) return aNull && bNull;
            return ReferenceEquals(a, b);
        }

        public static bool operator !=(Object? a, Object? b) => !(a == b);
        public static implicit operator bool(Object? obj) => obj is not null && !obj.destroyed;

        public override bool Equals(object? other) => other is Object o ? this == o : other is null && destroyed;
        public override int GetHashCode() => id;
        public override string ToString() => name;
    }

    [AttributeUsage(AttributeTargets.Class, AllowMultiple = true)]
    public sealed class RequireComponent : Attribute {
        public Type m_Type0;

        public RequireComponent(Type requiredComponent) => m_Type0 = requiredComponent;
    }

    public sealed class GameObject : Object {
        internal readonly List<Component> components = new();
        private bool _lastActive = true;

        public GameObject() : this("New Game Object") { }

        public GameObject(string name) {
            this.name = name;
            transform = new Transform { gameObject = this };
            components.Add(transform);
        }

        public Transform transform { get; private set; }
        public bool activeSelf { get; private set; } = true;

        public bool activeInHierarchy {
            get {
                for (var t = transform; t != null; t = t.parentValue) {
                    if (!t.gameObject.activeSelf) return false;
                }
                return true;
            }
        }

        public void SetActive(bool value) {
            if (activeSelf == value) return;
            activeSelf = value;
            PlaygroundEngine.MarkDirty();
            RefreshActivation();
        }

        internal void RefreshActivation() {
            var now = activeInHierarchy;

            if (now != _lastActive) {
                _lastActive = now;

                foreach (var component in components.ToArray()) {
                    if (now) component.OnObjectActivated();
                    else component.OnObjectDeactivated();
                }
            }

            foreach (var child in transform.children.ToArray()) {
                child.gameObject.RefreshActivation();
            }
        }

        public T AddComponent<T>() where T : Component => (T)AddComponent(typeof(T));

        public Component AddComponent(Type type) {
            foreach (var required in MessageTable.For(type).Required) {
                if (GetComponent(required.m_Type0) is null) AddComponent(required.m_Type0);
            }

            if (type == typeof(RectTransform)) return ReplaceTransform();

            var component = (Component)Activator.CreateInstance(type, nonPublic: true)!;
            component.gameObject = this;
            components.Add(component);
            component.OnAdded();
            PlaygroundEngine.MarkDirty();

            return component;
        }

        private RectTransform ReplaceTransform() {
            if (transform is RectTransform existing) return existing;

            var old = transform;
            var rect = new RectTransform { gameObject = this };

            rect.parentValue = old.parentValue;
            rect.children.AddRange(old.children);
            foreach (var child in rect.children) child.parentValue = rect;

            if (old.parentValue != null) {
                var index = old.parentValue.children.IndexOf(old);
                old.parentValue.children[index] = rect;
            }

            components[components.IndexOf(old)] = rect;
            transform = rect;
            return rect;
        }

        public T? GetComponent<T>() where T : class {
            foreach (var component in components) {
                if (component is T match && !component.destroyed) return match;
            }
            return null;
        }

        public Component? GetComponent(Type type) {
            foreach (var component in components) {
                if (type.IsInstanceOfType(component) && !component.destroyed) return component;
            }
            return null;
        }

        public bool TryGetComponent<T>(out T? component) where T : class {
            component = GetComponent<T>();
            return component != null;
        }

        public T[] GetComponents<T>() where T : class {
            var result = new List<T>();
            foreach (var component in components) {
                if (component is T match && !component.destroyed) result.Add(match);
            }
            return result.ToArray();
        }

        public void GetComponentsInParent<T>(bool includeInactive, List<T> results) where T : class {
            results.Clear();
            for (var t = transform; t != null; t = t.parentValue) {
                if (!includeInactive && !t.gameObject.activeInHierarchy) continue;
                results.AddRange(t.gameObject.GetComponents<T>());
            }
        }

        public T? GetComponentInParent<T>() where T : class {
            for (var t = transform; t != null; t = t.parentValue) {
                var match = t.gameObject.GetComponent<T>();
                if (match != null) return match;
            }
            return null;
        }

        public T? GetComponentInChildren<T>() where T : class {
            var match = GetComponent<T>();
            if (match != null) return match;

            foreach (var child in transform.children) {
                match = child.gameObject.GetComponentInChildren<T>();
                if (match != null) return match;
            }
            return null;
        }
    }

    public class Component : Object {
        public GameObject gameObject { get; internal set; } = null!;
        public Transform transform => gameObject.transform;

        public override string name {
            get => gameObject.name;
            set => gameObject.name = value;
        }

        public T? GetComponent<T>() where T : class => gameObject.GetComponent<T>();
        public T? GetComponentInParent<T>() where T : class => gameObject.GetComponentInParent<T>();
        public T? GetComponentInChildren<T>() where T : class => gameObject.GetComponentInChildren<T>();
        public void GetComponentsInParent<T>(bool includeInactive, List<T> results) where T : class => gameObject.GetComponentsInParent(includeInactive, results);

        internal virtual void OnAdded() { }
        internal virtual void OnObjectActivated() { }
        internal virtual void OnObjectDeactivated() { }
        internal virtual void OnDestroying() { }
    }

    public class Behaviour : Component {
        public bool enabled {
            get;
            set {
                if (field == value) return;
                field = value;
                PlaygroundEngine.MarkDirty();
                OnEnabledChanged();
            }
        } = true;

        public bool isActiveAndEnabled => enabled && gameObject.activeInHierarchy;

        internal virtual void OnEnabledChanged() { }
    }

    public sealed class Coroutine {
        internal readonly Stack<IEnumerator> stack = new();
        internal readonly IEnumerator source;
        internal float waitUntil;
        internal bool finished;

        internal Coroutine(IEnumerator routine) {
            source = routine;
            stack.Push(routine);
        }
    }

    public sealed class WaitForSeconds {
        internal readonly float seconds;
        public WaitForSeconds(float seconds) => this.seconds = seconds;
    }

    public sealed class WaitForEndOfFrame { }

    public class AsyncOperation {
        public event Action<AsyncOperation>? completed;

        internal void Complete() => completed?.Invoke(this);
    }

    internal sealed class MessageTable {
        private static readonly Dictionary<Type, MessageTable> cache = new();

        public readonly RequireComponent[] Required;
        public readonly MethodInfo? Awake, Start, Update, LateUpdate, OnEnable, OnDisable, OnDestroy;
        public readonly MethodInfo? OnTransformParentChanged, OnRectTransformDimensionsChange;

        private MessageTable(Type type) {
            Required = type.GetCustomAttributes<RequireComponent>(true).ToArray();
            Awake = Find(type, nameof(Awake));
            Start = Find(type, nameof(Start));
            Update = Find(type, nameof(Update));
            LateUpdate = Find(type, nameof(LateUpdate));
            OnEnable = Find(type, nameof(OnEnable));
            OnDisable = Find(type, nameof(OnDisable));
            OnDestroy = Find(type, nameof(OnDestroy));
            OnTransformParentChanged = Find(type, nameof(OnTransformParentChanged));
            OnRectTransformDimensionsChange = Find(type, nameof(OnRectTransformDimensionsChange));
        }

        public static MessageTable For(Type type) {
            if (!cache.TryGetValue(type, out var table)) {
                cache[type] = table = new MessageTable(type);
            }
            return table;
        }

        private static MethodInfo? Find(Type type, string name) {
            const BindingFlags flags = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

            for (var t = type; t != null && t != typeof(MonoBehaviour); t = t.BaseType) {
                var method = t.GetMethod(name, flags, null, Type.EmptyTypes, null);
                if (method != null) return method;
            }
            return null;
        }
    }

    public class MonoBehaviour : Behaviour {
        internal readonly List<Coroutine> coroutines = new();
        private MessageTable _messages = null!;
        private Action? _update;
        private Action? _lateUpdate;
        private bool _awoken;
        private bool _enabledFired;

        internal void Send(MethodInfo? method) {
            if (method == null) return;

            try {
                method.Invoke(this, null);
            } catch (TargetInvocationException e) {
                Debug.LogException(e.InnerException ?? e);
            }
        }

        internal override void OnAdded() {
            _messages = MessageTable.For(GetType());
            _update = _messages.Update?.CreateDelegate<Action>(this);
            _lateUpdate = _messages.LateUpdate?.CreateDelegate<Action>(this);
            PlaygroundEngine.Register(this, _messages.Start != null);
            if (gameObject.activeInHierarchy) OnObjectActivated();
        }

        internal override void OnObjectActivated() {
            if (!_awoken) {
                _awoken = true;
                Send(_messages.Awake);
            }
            if (enabled && !_enabledFired) {
                _enabledFired = true;
                Send(_messages.OnEnable);
            }
        }

        internal override void OnObjectDeactivated() {
            if (_enabledFired) {
                _enabledFired = false;
                Send(_messages.OnDisable);
            }
        }

        internal override void OnEnabledChanged() {
            if (!gameObject.activeInHierarchy) return;
            if (enabled) OnObjectActivated();
            else OnObjectDeactivated();
        }

        internal override void OnDestroying() {
            OnObjectDeactivated();
            if (_awoken) Send(_messages.OnDestroy);
            coroutines.Clear();
        }

        internal void RunStart() => Send(_messages.Start);
        internal void RunUpdate() => Guard(_update);
        internal void RunLateUpdate() => Guard(_lateUpdate);

        private static void Guard(Action? action) {
            if (action == null) return;

            try {
                action();
            } catch (Exception e) {
                Debug.LogException(e);
            }
        }

        internal void SendParentChanged() => Send(_messages.OnTransformParentChanged);
        internal void SendDimensionsChanged() => Send(_messages.OnRectTransformDimensionsChange);

        public Coroutine StartCoroutine(IEnumerator routine) {
            var coroutine = new Coroutine(routine);
            coroutines.Add(coroutine);
            PlaygroundEngine.StepCoroutine(coroutine);
            return coroutine;
        }

        public void StopCoroutine(IEnumerator routine) {
            foreach (var coroutine in coroutines) {
                if (coroutine.source == routine) coroutine.finished = true;
            }
        }

        public void StopCoroutine(Coroutine coroutine) => coroutine.finished = true;

        public void StopAllCoroutines() {
            foreach (var coroutine in coroutines) coroutine.finished = true;
        }
    }

    public class Transform : Component {
        internal Transform? parentValue;
        internal readonly List<Transform> children = new();

        public Transform? parent {
            get => parentValue;
            set => SetParent(value);
        }

        public int childCount => children.Count;
        public Transform GetChild(int index) => children[index];

        public virtual Vector3 localPosition { get; set { field = value; PlaygroundEngine.MarkDirty(); } }
        public Vector3 localScale { get; set { field = value; PlaygroundEngine.MarkDirty(); } } = Vector3.one;
        public Vector3 localEulerAngles { get; set { field = value; PlaygroundEngine.MarkDirty(); } }

        public Vector3 lossyScale => parentValue == null
            ? localScale
            : Vector3.Scale(parentValue.lossyScale, localScale);

        public Vector3 position {
            get => parentValue == null
                ? localPosition
                : parentValue.position + Vector3.Scale(parentValue.lossyScale, localPosition);
            set => localPosition = parentValue == null ? value : parentValue.InverseTransformPoint(value);
        }

        public Vector3 TransformPoint(Vector3 point) => position + Vector3.Scale(lossyScale, point);

        public Vector3 InverseTransformPoint(Vector3 point) {
            var offset = point - position;
            var scale = lossyScale;
            return new Vector3(
                scale.x == 0f ? 0f : offset.x / scale.x,
                scale.y == 0f ? 0f : offset.y / scale.y,
                scale.z == 0f ? 0f : offset.z / scale.z
            );
        }

        public void SetParent(Transform? newParent) => SetParent(newParent, true);

        public void SetParent(Transform? newParent, bool worldPositionStays) {
            if (ReferenceEquals(newParent, parentValue)) return;

            var world = worldPositionStays ? position : default;

            parentValue?.children.Remove(this);
            parentValue = newParent;
            newParent?.children.Add(this);
            PlaygroundEngine.MarkDirty();

            if (worldPositionStays) position = world;

            NotifyParentChanged();
            gameObject.RefreshActivation();
            AfterParentChanged();
        }

        private void NotifyParentChanged() {
            foreach (var component in gameObject.components.ToArray()) {
                if (component is MonoBehaviour behaviour) behaviour.SendParentChanged();
            }
            foreach (var child in children.ToArray()) child.NotifyParentChanged();
        }

        internal virtual void AfterParentChanged() { }

        public int GetSiblingIndex() => parentValue?.children.IndexOf(this) ?? 0;

        public void SetSiblingIndex(int index) {
            if (parentValue == null) return;
            var list = parentValue.children;
            list.Remove(this);
            list.Insert(Math.Clamp(index, 0, list.Count), this);
            PlaygroundEngine.MarkDirty();
        }

        public void SetAsLastSibling() => SetSiblingIndex(int.MaxValue);
    }

    public sealed class RectTransform : Transform {
        public enum Axis {
            Horizontal,
            Vertical
        }

        public enum Edge {
            Left,
            Right,
            Top,
            Bottom
        }

        private Vector2 _anchorMin = new(0.5f, 0.5f);
        private Vector2 _anchorMax = new(0.5f, 0.5f);
        private Vector2 _pivot = new(0.5f, 0.5f);
        private Vector2 _anchoredPosition;
        private Vector2 _sizeDelta = new(100f, 100f);
        private Vector2 _lastSize = new(100f, 100f);

        public Vector2 anchorMin {
            get => _anchorMin;
            set {
                _anchorMin = value;
                CheckDimensions();
            }
        }

        public Vector2 anchorMax {
            get => _anchorMax;
            set {
                _anchorMax = value;
                CheckDimensions();
            }
        }

        public Vector2 pivot {
            get => _pivot;
            set {
                _pivot = value;
                PlaygroundEngine.MarkDirty();
            }
        }

        public Vector2 anchoredPosition {
            get => _anchoredPosition;
            set {
                _anchoredPosition = value;
                PlaygroundEngine.MarkDirty();
            }
        }

        public Vector2 sizeDelta {
            get => _sizeDelta;
            set {
                _sizeDelta = value;
                CheckDimensions();
            }
        }

        private Vector2 ParentSize => parentValue is RectTransform parent ? parent.rect.size : Vector2.zero;

        private Vector2 AnchorPoint => _anchorMin + Vector2.Scale(_anchorMax - _anchorMin, _pivot);

        private Vector2 AnchorRelativeToParentPivot => parentValue is RectTransform parent
            ? parent.rect.min + Vector2.Scale(parent.rect.size, AnchorPoint)
            : Vector2.zero;

        public Rect rect {
            get {
                var span = _anchorMax - _anchorMin;
                var parentSize = span.x == 0f && span.y == 0f ? Vector2.zero : ParentSize;
                var size = Vector2.Scale(parentSize, span) + _sizeDelta;
                return new Rect(-_pivot.x * size.x, -_pivot.y * size.y, size.x, size.y);
            }
        }

        public Vector2 offsetMin {
            get => _anchoredPosition - Vector2.Scale(_sizeDelta, _pivot);
            set {
                var offset = value - offsetMin;
                _sizeDelta -= offset;
                _anchoredPosition += Vector2.Scale(offset, Vector2.one - _pivot);
                CheckDimensions();
            }
        }

        public Vector2 offsetMax {
            get => _anchoredPosition + Vector2.Scale(_sizeDelta, Vector2.one - _pivot);
            set {
                var offset = value - offsetMax;
                _sizeDelta += offset;
                _anchoredPosition += Vector2.Scale(offset, _pivot);
                CheckDimensions();
            }
        }

        public override Vector3 localPosition {
            get => AnchorRelativeToParentPivot + _anchoredPosition;
            set {
                _anchoredPosition = (Vector2)value - AnchorRelativeToParentPivot;
                PlaygroundEngine.MarkDirty();
            }
        }

        public void SetInsetAndSizeFromParentEdge(Edge edge, float inset, float size) {
            var axis = edge is Edge.Top or Edge.Bottom ? 1 : 0;
            var end = edge is Edge.Top or Edge.Right;
            var anchorValue = end ? 1f : 0f;

            _anchorMin[axis] = anchorValue;
            _anchorMax[axis] = anchorValue;
            _sizeDelta[axis] = size;
            _anchoredPosition[axis] = end ? -inset - size * (1f - _pivot[axis]) : inset + size * _pivot[axis];

            CheckDimensions();
        }

        public void SetSizeWithCurrentAnchors(Axis axis, float size) {
            var i = (int)axis;
            _sizeDelta[i] = size - ParentSize[i] * (_anchorMax[i] - _anchorMin[i]);
            CheckDimensions();
        }

        public void GetLocalCorners(Vector3[] corners) {
            var r = rect;
            corners[0] = new Vector3(r.xMin, r.yMin);
            corners[1] = new Vector3(r.xMin, r.yMax);
            corners[2] = new Vector3(r.xMax, r.yMax);
            corners[3] = new Vector3(r.xMax, r.yMin);
        }

        public void GetWorldCorners(Vector3[] corners) {
            GetLocalCorners(corners);
            for (var i = 0; i < 4; i++) corners[i] = TransformPoint(corners[i]);
        }

        internal override void AfterParentChanged() => CheckDimensions();

        private void CheckDimensions() {
            PlaygroundEngine.MarkDirty();

            var size = rect.size;
            if (size.x == _lastSize.x && size.y == _lastSize.y) return;

            _lastSize = size;

            foreach (var component in gameObject.components.ToArray()) {
                if (component is MonoBehaviour behaviour && behaviour.isActiveAndEnabled) {
                    behaviour.SendDimensionsChanged();
                }
            }

            foreach (var child in children.ToArray()) {
                (child as RectTransform)?.CheckDimensions();
            }
        }

        internal (float x, float y, float w, float h) BoxInParent() {
            var parentSize = ParentSize;
            var r = rect;
            var pivotPosition = Vector2.Scale(parentSize, AnchorPoint) + _anchoredPosition;
            var left = pivotPosition.x - _pivot.x * r.width;
            var bottom = pivotPosition.y - _pivot.y * r.height;
            return (left, parentSize.y - bottom - r.height, r.width, r.height);
        }
    }

    public enum RenderMode {
        ScreenSpaceOverlay,
        WorldSpace
    }

    public class Camera : Behaviour { }

    public static class RectTransformUtility {
        public static bool ScreenPointToLocalPointInRectangle(RectTransform rect, Vector2 screenPoint, Camera? camera, out Vector2 localPoint) {
            localPoint = rect.InverseTransformPoint(screenPoint);
            return true;
        }
    }

    public class ScriptableObject : Object { }

    public sealed class CreateAssetMenuAttribute : Attribute {
        public string fileName { get; set; } = "";
        public string menuName { get; set; } = "";
    }

    public sealed class SpaceAttribute : Attribute { }

    public sealed class HeaderAttribute : Attribute {
        public HeaderAttribute(string header) { }
    }

    public sealed class DefaultExecutionOrder : Attribute {
        public DefaultExecutionOrder(int order) { }
    }

    public class Canvas : Behaviour {
        public RenderMode renderMode => RenderMode.ScreenSpaceOverlay;
        public Camera? worldCamera => null;

        public static event Action? preWillRenderCanvases;

        internal static void RaisePreWillRender() => preWillRenderCanvases?.Invoke();

        public Canvas rootCanvas {
            get {
                var root = this;
                for (var t = transform.parentValue; t != null; t = t.parentValue) {
                    var canvas = t.gameObject.GetComponent<Canvas>();
                    if (canvas != null) root = canvas;
                }
                return root;
            }
        }
    }

    public class CanvasGroup : Behaviour {
        public float alpha { get; set { field = value; PlaygroundEngine.MarkDirty(); } } = 1f;
        public bool ignoreParentGroups { get; set { field = value; PlaygroundEngine.MarkDirty(); } }
        public bool interactable { get; set; } = true;
        public bool blocksRaycasts { get; set { field = value; PlaygroundEngine.MarkDirty(); } } = true;
    }

    public class Material : Object {
        public Color color { get; set; } = Color.white;
    }

    public class Texture : Object {
        public int width { get; set; }
        public int height { get; set; }
        public TextureWrapMode wrapMode { get; set; }
    }

    public enum TextureWrapMode {
        Repeat
    }

    public enum TextureFormat {
        RGBA32
    }

    public class Texture2D : Texture {
        internal Color32[]? pixels;
        internal byte[]? encoded;
        internal int version;
        internal int uploadedVersion = -1;

        public Texture2D(int width, int height) {
            this.width = width;
            this.height = height;
        }

        public Texture2D(int width, int height, TextureFormat textureFormat, bool mipChain) : this(width, height) { }
        public Texture2D(int width, int height, TextureFormat textureFormat, bool mipChain, bool linear) : this(width, height) { }

        public void Apply(bool updateMipmaps = true) {
            version++;
            PlaygroundEngine.MarkDirty();
        }

        public void ReadPixels(Rect source, int destX, int destY) { }

        public void SetPixel(int x, int y, Color color) {
            pixels ??= new Color32[width * height];
            pixels[y * width + x] = color;
        }

        public void SetPixels32(Color32[] colors) {
            pixels = (Color32[])colors.Clone();
        }

        internal byte[] ToBytes() => MemoryMarshal.AsBytes((pixels ?? new Color32[width * height]).AsSpan()).ToArray();
    }

    public class RenderTexture : Texture {
        public static RenderTexture? active { get; set; }
    }

    public static class ImageConversion {
        public static bool LoadImage(this Texture2D tex, byte[] data) {
            if (!TryReadSize(data, out var width, out var height)) return false;

            tex.width = width;
            tex.height = height;
            tex.encoded = data;
            tex.pixels = null;
            tex.Apply();
            return true;
        }

        private static bool TryReadSize(byte[] d, out int width, out int height) {
            width = height = 0;

            if (d.Length > 24 && d[0] == 0x89 && d[1] == 0x50) {
                width = d[16] << 24 | d[17] << 16 | d[18] << 8 | d[19];
                height = d[20] << 24 | d[21] << 16 | d[22] << 8 | d[23];
                return true;
            }

            if (d.Length > 10 && d[0] == 0x47 && d[1] == 0x49 && d[2] == 0x46) {
                width = d[6] | d[7] << 8;
                height = d[8] | d[9] << 8;
                return true;
            }

            if (d.Length > 4 && d[0] == 0xFF && d[1] == 0xD8) {
                for (var i = 2; i + 9 < d.Length;) {
                    if (d[i] != 0xFF) return false;

                    var marker = d[i + 1];
                    if (marker is >= 0xC0 and <= 0xCF and not 0xC4 and not 0xC8 and not 0xCC) {
                        height = d[i + 5] << 8 | d[i + 6];
                        width = d[i + 7] << 8 | d[i + 8];
                        return true;
                    }
                    i += 2 + (d[i + 2] << 8 | d[i + 3]);
                }
            }

            return false;
        }
    }

    public class Sprite : Object {
        public Texture2D texture { get; private set; } = null!;
        public Rect rect { get; private set; }
        public float pixelsPerUnit { get; private set; } = 100f;
        public Vector4 border { get; private set; }

        public static Sprite Create(Texture2D texture, Rect rect, Vector2 pivot, float pixelsPerUnit = 100f, Vector4 border = default) {
            return new Sprite { texture = texture, rect = rect, pixelsPerUnit = pixelsPerUnit, border = border };
        }
    }

    public struct Vector4 {
        public float x, y, z, w;

        public Vector4(float x, float y, float z, float w) {
            this.x = x;
            this.y = y;
            this.z = z;
            this.w = w;
        }
    }
}

namespace UnityEngine.Networking {
    public class UnityWebRequest : IDisposable {
        private static readonly HttpClient client = new();

        private readonly string _url;

        internal Texture2D? texture;

        internal UnityWebRequest(string url) => _url = url;

        public AsyncOperation SendWebRequest() {
            var operation = new AsyncOperation();
            _ = Load(operation);
            return operation;
        }

        private async Task Load(AsyncOperation operation) {
            texture = new Texture2D(1, 1);
            await Task.Yield();

            try {
                var bytes = await client.GetByteArrayAsync(_url);
                if (!texture.LoadImage(bytes)) Debug.LogError($"Failed to load {_url}: unsupported image format");
            } catch (Exception e) {
                Debug.LogError($"Failed to load {_url}: {e.Message}");
            }

            operation.Complete();
        }

        public void Dispose() { }
    }

    public static class UnityWebRequestTexture {
        public static UnityWebRequest GetTexture(string uri) => new(uri);
    }

    public static class DownloadHandlerTexture {
        public static Texture2D? GetContent(UnityWebRequest request) => request.texture;
    }
}
