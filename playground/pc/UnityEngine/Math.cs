using System;

namespace UnityEngine {
    public struct Vector2 : IEquatable<Vector2> {
        public float x;
        public float y;

        public Vector2(float x, float y) {
            this.x = x;
            this.y = y;
        }

        public static Vector2 zero => new(0f, 0f);
        public static Vector2 one => new(1f, 1f);
        public static Vector2 up => new(0f, 1f);
        public static Vector2 down => new(0f, -1f);
        public static Vector2 left => new(-1f, 0f);
        public static Vector2 right => new(1f, 0f);

        public float magnitude => MathF.Sqrt(x * x + y * y);
        public float sqrMagnitude => x * x + y * y;

        public float this[int index] {
            get => index == 0 ? x : y;
            set {
                if (index == 0) x = value; else y = value;
            }
        }

        public static Vector2 Lerp(Vector2 a, Vector2 b, float t) => LerpUnclamped(a, b, Mathf.Clamp01(t));
        public static Vector2 LerpUnclamped(Vector2 a, Vector2 b, float t) => new(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        public static Vector2 Scale(Vector2 a, Vector2 b) => new(a.x * b.x, a.y * b.y);
        public static float Distance(Vector2 a, Vector2 b) => (a - b).magnitude;

        public static Vector2 operator +(Vector2 a, Vector2 b) => new(a.x + b.x, a.y + b.y);
        public static Vector2 operator -(Vector2 a, Vector2 b) => new(a.x - b.x, a.y - b.y);
        public static Vector2 operator -(Vector2 a) => new(-a.x, -a.y);
        public static Vector2 operator *(Vector2 a, float d) => new(a.x * d, a.y * d);
        public static Vector2 operator *(float d, Vector2 a) => new(a.x * d, a.y * d);
        public static Vector2 operator *(Vector2 a, Vector2 b) => new(a.x * b.x, a.y * b.y);
        public static Vector2 operator /(Vector2 a, float d) => new(a.x / d, a.y / d);
        public static bool operator ==(Vector2 a, Vector2 b) => (a - b).sqrMagnitude < 1e-10f;
        public static bool operator !=(Vector2 a, Vector2 b) => !(a == b);
        public static implicit operator Vector2(Vector3 v) => new(v.x, v.y);
        public static implicit operator Vector3(Vector2 v) => new(v.x, v.y, 0f);

        public bool Equals(Vector2 other) => x.Equals(other.x) && y.Equals(other.y);
        public override bool Equals(object? obj) => obj is Vector2 other && Equals(other);
        public override int GetHashCode() => HashCode.Combine(x, y);
        public override string ToString() => $"({x:F2}, {y:F2})";
    }

    public struct Vector3 : IEquatable<Vector3> {
        public float x;
        public float y;
        public float z;

        public Vector3(float x, float y, float z) {
            this.x = x;
            this.y = y;
            this.z = z;
        }

        public Vector3(float x, float y) : this(x, y, 0f) { }

        public static Vector3 zero => new(0f, 0f, 0f);
        public static Vector3 one => new(1f, 1f, 1f);

        public static Vector3 Lerp(Vector3 a, Vector3 b, float t) => LerpUnclamped(a, b, Mathf.Clamp01(t));
        public static Vector3 LerpUnclamped(Vector3 a, Vector3 b, float t) => new(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
        public static Vector3 Scale(Vector3 a, Vector3 b) => new(a.x * b.x, a.y * b.y, a.z * b.z);

        public static Vector3 operator +(Vector3 a, Vector3 b) => new(a.x + b.x, a.y + b.y, a.z + b.z);
        public static Vector3 operator -(Vector3 a, Vector3 b) => new(a.x - b.x, a.y - b.y, a.z - b.z);
        public static Vector3 operator *(Vector3 a, float d) => new(a.x * d, a.y * d, a.z * d);
        public static Vector3 operator *(float d, Vector3 a) => new(a.x * d, a.y * d, a.z * d);
        public static Vector3 operator /(Vector3 a, float d) => new(a.x / d, a.y / d, a.z / d);
        public static bool operator ==(Vector3 a, Vector3 b) => a.Equals(b);
        public static bool operator !=(Vector3 a, Vector3 b) => !a.Equals(b);

        public bool Equals(Vector3 other) => x.Equals(other.x) && y.Equals(other.y) && z.Equals(other.z);
        public override bool Equals(object? obj) => obj is Vector3 other && Equals(other);
        public override int GetHashCode() => HashCode.Combine(x, y, z);
        public override string ToString() => $"({x:F2}, {y:F2}, {z:F2})";
    }

    public struct Quaternion : IEquatable<Quaternion> {
        public float x;
        public float y;
        public float z;
        public float w;

        public Quaternion(float x, float y, float z, float w) {
            this.x = x;
            this.y = y;
            this.z = z;
            this.w = w;
        }

        public static Quaternion LerpUnclamped(Quaternion a, Quaternion b, float t) => new(
            a.x + (b.x - a.x) * t,
            a.y + (b.y - a.y) * t,
            a.z + (b.z - a.z) * t,
            a.w + (b.w - a.w) * t
        );

        public bool Equals(Quaternion other) => x.Equals(other.x) && y.Equals(other.y) && z.Equals(other.z) && w.Equals(other.w);
        public override bool Equals(object? obj) => obj is Quaternion other && Equals(other);
        public override int GetHashCode() => HashCode.Combine(x, y, z, w);
    }

    public struct Color : IEquatable<Color> {
        public float r;
        public float g;
        public float b;
        public float a;

        public Color(float r, float g, float b, float a) {
            this.r = r;
            this.g = g;
            this.b = b;
            this.a = a;
        }

        public Color(float r, float g, float b) : this(r, g, b, 1f) { }

        public static Color clear => new(0f, 0f, 0f, 0f);
        public static Color white => new(1f, 1f, 1f, 1f);
        public static Color black => new(0f, 0f, 0f, 1f);
        public static Color gray => new(0.5f, 0.5f, 0.5f, 1f);
        public static Color grey => gray;
        public static Color red => new(1f, 0f, 0f, 1f);
        public static Color green => new(0f, 1f, 0f, 1f);
        public static Color blue => new(0f, 0f, 1f, 1f);
        public static Color cyan => new(0f, 1f, 1f, 1f);
        public static Color magenta => new(1f, 0f, 1f, 1f);
        public static Color yellow => new(1f, 0.92156863f, 0.015686275f, 1f);

        public static Color Lerp(Color a, Color b, float t) => LerpUnclamped(a, b, Mathf.Clamp01(t));
        public static Color LerpUnclamped(Color a, Color b, float t) => new(
            a.r + (b.r - a.r) * t,
            a.g + (b.g - a.g) * t,
            a.b + (b.b - a.b) * t,
            a.a + (b.a - a.a) * t
        );

        public float grayscale => 0.299f * r + 0.587f * g + 0.114f * b;

        public static Color HSVToRGB(float h, float s, float v) {
            h = (h % 1f + 1f) % 1f * 6f;
            var i = (int)h;
            var f = h - i;
            var p = v * (1f - s);
            var q = v * (1f - s * f);
            var t = v * (1f - s * (1f - f));
            return i switch {
                0 => new Color(v, t, p),
                1 => new Color(q, v, p),
                2 => new Color(p, v, t),
                3 => new Color(p, q, v),
                4 => new Color(t, p, v),
                _ => new Color(v, p, q)
            };
        }

        public static void RGBToHSV(Color color, out float h, out float s, out float v) {
            var max = Mathf.Max(color.r, Mathf.Max(color.g, color.b));
            var min = Mathf.Min(color.r, Mathf.Min(color.g, color.b));
            var delta = max - min;

            v = max;
            s = max <= 0f ? 0f : delta / max;

            if (delta <= 0f) {
                h = 0f;
            } else if (max == color.r) {
                h = ((color.g - color.b) / delta + 6f) % 6f / 6f;
            } else if (max == color.g) {
                h = ((color.b - color.r) / delta + 2f) / 6f;
            } else {
                h = ((color.r - color.g) / delta + 4f) / 6f;
            }
        }

        public static Color operator *(Color c, float d) => new(c.r * d, c.g * d, c.b * d, c.a * d);
        public static Color operator *(float d, Color c) => c * d;
        public static Color operator *(Color a, Color b) => new(a.r * b.r, a.g * b.g, a.b * b.b, a.a * b.a);
        public static Color operator +(Color a, Color b) => new(a.r + b.r, a.g + b.g, a.b + b.b, a.a + b.a);
        public static bool operator ==(Color a, Color b) => a.Equals(b);
        public static bool operator !=(Color a, Color b) => !a.Equals(b);
        public static implicit operator Color(Color32 c) => new(c.r / 255f, c.g / 255f, c.b / 255f, c.a / 255f);

        public bool Equals(Color other) => r.Equals(other.r) && g.Equals(other.g) && b.Equals(other.b) && a.Equals(other.a);
        public override bool Equals(object? obj) => obj is Color other && Equals(other);
        public override int GetHashCode() => HashCode.Combine(r, g, b, a);
    }

    public struct Color32 {
        public byte r;
        public byte g;
        public byte b;
        public byte a;

        public Color32(byte r, byte g, byte b, byte a) {
            this.r = r;
            this.g = g;
            this.b = b;
            this.a = a;
        }

        public static implicit operator Color32(Color c) => new(
            (byte)Mathf.Round(Mathf.Clamp01(c.r) * 255f),
            (byte)Mathf.Round(Mathf.Clamp01(c.g) * 255f),
            (byte)Mathf.Round(Mathf.Clamp01(c.b) * 255f),
            (byte)Mathf.Round(Mathf.Clamp01(c.a) * 255f)
        );
    }

    public struct Rect : IEquatable<Rect> {
        public float x;
        public float y;
        public float width;
        public float height;

        public Rect(float x, float y, float width, float height) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
        }

        public Vector2 size => new(width, height);
        public Vector2 min => new(x, y);
        public Vector2 max => new(x + width, y + height);
        public Vector2 center => new(x + width / 2f, y + height / 2f);
        public float xMin => x;
        public float yMin => y;
        public float xMax => x + width;
        public float yMax => y + height;

        public bool Contains(Vector2 point) => point.x >= xMin && point.x < xMax && point.y >= yMin && point.y < yMax;

        public static Rect MinMaxRect(float xmin, float ymin, float xmax, float ymax) => new(xmin, ymin, xmax - xmin, ymax - ymin);

        public bool Equals(Rect other) => x.Equals(other.x) && y.Equals(other.y) && width.Equals(other.width) && height.Equals(other.height);
        public override bool Equals(object? obj) => obj is Rect other && Equals(other);
        public override int GetHashCode() => HashCode.Combine(x, y, width, height);
    }

    public static class Mathf {
        public const float PI = MathF.PI;
        public const float Infinity = float.PositiveInfinity;
        public const float Epsilon = float.Epsilon;
        public const float Rad2Deg = 180f / MathF.PI;
        public const float Deg2Rad = MathF.PI / 180f;

        public static float Atan2(float y, float x) => MathF.Atan2(y, x);
        public static float Asin(float f) => MathF.Asin(f);
        public static float Sign(float f) => f >= 0f ? 1f : -1f;

        public static float Abs(float f) => MathF.Abs(f);
        public static int Abs(int f) => Math.Abs(f);
        public static float Exp(float f) => MathF.Exp(f);
        public static float Pow(float f, float p) => MathF.Pow(f, p);
        public static float Sqrt(float f) => MathF.Sqrt(f);
        public static float Sin(float f) => MathF.Sin(f);
        public static float Cos(float f) => MathF.Cos(f);
        public static float Round(float f) => MathF.Round(f);
        public static float Floor(float f) => MathF.Floor(f);
        public static float Ceil(float f) => MathF.Ceiling(f);
        public static int RoundToInt(float f) => (int)MathF.Round(f);
        public static int CeilToInt(float f) => (int)MathF.Ceiling(f);
        public static int FloorToInt(float f) => (int)MathF.Floor(f);
        public static float Min(float a, float b) => a < b ? a : b;
        public static int Min(int a, int b) => a < b ? a : b;
        public static float Min(params float[] values) {
            var min = values[0];
            foreach (var value in values) min = value < min ? value : min;
            return min;
        }
        public static float Max(float a, float b) => a > b ? a : b;
        public static int Max(int a, int b) => a > b ? a : b;
        public static float Clamp(float v, float min, float max) => v < min ? min : v > max ? max : v;
        public static int Clamp(int v, int min, int max) => v < min ? min : v > max ? max : v;
        public static float Clamp01(float v) => v < 0f ? 0f : v > 1f ? 1f : v;
        public static float Lerp(float a, float b, float t) => a + (b - a) * Clamp01(t);
        public static float LerpUnclamped(float a, float b, float t) => a + (b - a) * t;
        public static bool Approximately(float a, float b) => MathF.Abs(b - a) < MathF.Max(1E-06f * MathF.Max(MathF.Abs(a), MathF.Abs(b)), 1E-45f * 8f);
    }

    public static class Time {
        public static float deltaTime { get; internal set; }
        public static float unscaledDeltaTime => deltaTime;
        public static float time { get; internal set; }
        public static float unscaledTime => time;
        public static int frameCount { get; internal set; }
    }

    public enum LogType {
        Error,
        Assert,
        Warning,
        Log,
        Exception
    }

    public static class Debug {
        public sealed class Logger {
            public void Log(LogType logType, object message) => Write(logType, message);
        }

        public static Logger unityLogger { get; } = new();

        private static void Write(LogType type, object? message) => Js.Log((int)type, message?.ToString() ?? "null");

        public static void Log(object message) => Write(LogType.Log, message);
        public static void LogWarning(object message) => Write(LogType.Warning, message);
        public static void LogError(object message) => Write(LogType.Error, message);
        public static void LogException(Exception exception) => Write(LogType.Exception, exception);
    }
}

namespace JetBrains.Annotations {
    public sealed class PublicAPIAttribute : Attribute { }

    public sealed class UsedImplicitlyAttribute : Attribute { }

    public sealed class PureAttribute : Attribute { }
}

namespace UnityEngine.XR {
    public static class XRSettings {
        public static bool isDeviceActive => false;
    }
}

namespace UnityEngine.Pool {
    using System.Collections.Generic;

    public static class HashSetPool<T> {
        private static readonly Stack<HashSet<T>> pool = new();

        public static HashSet<T> Get() => pool.Count > 0 ? pool.Pop() : new HashSet<T>();

        public static void Release(HashSet<T> toRelease) {
            toRelease.Clear();
            pool.Push(toRelease);
        }
    }
}
