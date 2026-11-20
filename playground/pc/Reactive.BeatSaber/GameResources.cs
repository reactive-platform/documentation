using System;
using UnityEngine;

namespace Reactive.BeatSaber;

public static class GameResources {
    public static Signal ButtonClickSignal { get; } = new();

    public static Material UIFogBackgroundMaterial { get; } = new() { name = "UIFogBG", color = new Color(0.235f, 0.235f, 0.235f, 0.96f) };
    public static Material UINoGlowMaterial { get; } = new() { name = "UINoGlow" };
    public static Material UIFontMaterial { get; } = new() { name = "UIFont" };

    internal static Material AnimatedButtonMaterial { get; } = new() { name = "AnimatedButton" };
    internal static Material AnimatedButtonBorderMaterial { get; } = new() { name = "AnimatedButtonBorder" };
    internal static Material UISVColorPickerMaterial { get; } = new() { name = "UISVColorPicker" };

    public static Sprite ArrowIcon => field ??= Paint(64, static (x, y) => Math.Max(
        Line(x, y, 14f, 42f, 32f, 24f, 3.5f),
        Line(x, y, 32f, 24f, 50f, 42f, 3.5f)
    ));

    public static Sprite ArrowOutlineIcon => field ??= Paint(64, static (x, y) => Outline(ArrowUpShape(x, y), 3f));

    public static Sprite ArrowUpIcon => field ??= Paint(64, static (x, y) => Mathf.Clamp01(0.5f - ArrowUpShape(x, y)));

    public static Sprite SearchIcon => field ??= Paint(64, static (x, y) => Math.Max(
        Ring(x, y, 27f, 37f, 17f, 2.5f),
        Line(x, y, 39f, 25f, 54f, 10f, 3.5f)
    ));

    public static Sprite CloseIcon => field ??= Paint(64, static (x, y) => Math.Max(
        Line(x, y, 14f, 14f, 50f, 50f, 3.5f),
        Line(x, y, 14f, 50f, 50f, 14f, 3.5f)
    ));

    public static Sprite EditIcon => field ??= Paint(64, static (x, y) => {
        var box = Mathf.Max(
            Line(x, y, 8f, 8f, 8f, 48f, 2.5f),
            Mathf.Max(Line(x, y, 8f, 8f, 48f, 8f, 2.5f), Mathf.Max(Line(x, y, 8f, 48f, 28f, 48f, 2.5f), Line(x, y, 48f, 8f, 48f, 28f, 2.5f)))
        );
        return Mathf.Max(box, Line(x, y, 24f, 24f, 54f, 54f, 4f));
    });

    public static Sprite CaretIcon => field ??= Paint(16, static (_, _) => 1f);

    public static Sprite CircleIcon => field ??= Paint(128, static (x, y) => RoundRect(x, y, 64f, 64f, 64f, 64f, 64f));

    public static Sprite VerticalIndicatorIcon => field ??= Paint(32, static (x, y) => RoundRect(x, y, 16f, 16f, 16f, 16f, 8f), 12f);

    public static Sprite HueWheelIcon => field ??= CreateHueWheel();

    public static Sprite HueWheelStrokeIcon => field ??= Create(new Texture2D(256, 256), 256, 0f);

    public static Sprite CircleSmallIcon => field ??= Paint(64, static (x, y) => Ring(x, y, 32f, 32f, 30f, 2.5f));

    public static Sprite CircleTinyIcon => field ??= Paint(64, static (x, y) => Ring(x, y, 32f, 32f, 28f, 5f));

    public static Sprite RoundRectTinyIcon => field ??= Paint(16, static (x, y) => RoundRect(x, y, 8f, 8f, 8f, 8f, 3f), 4f);

    public static Sprite RectOutlineIcon => field ??= Paint(16, static (x, y) => Outline(RoundRectDistance(x, y, 8f, 8f, 7f, 7f, 3f), 1f), 4f);

    public static Sprite RoundRect10Icon => field ??= Paint(64, static (x, y) => RoundRect(x, y, 32f, 32f, 32f, 32f, 10f), 12f);

    public static Sprite RoundRect10BorderIcon => field ??= Paint(64, static (x, y) => Outline(RoundRectDistance(x, y, 32f, 32f, 31f, 31f, 10f), 1f), 12f);

    public static Sprite RoundRect10OutlineIcon => field ??= Paint(64, static (x, y) => Outline(RoundRectDistance(x, y, 32f, 32f, 30f, 30f, 10f), 2f), 12f);

    private static Sprite CreateHueWheel() {
        const int size = 256;
        const float outer = size / 2f;
        const float inner = outer * 0.8f;

        var texture = new Texture2D(size, size);

        for (var y = 0; y < size; y++) {
            for (var x = 0; x < size; x++) {
                var dx = x + 0.5f - outer;
                var dy = y + 0.5f - outer;
                var distance = Mathf.Sqrt(dx * dx + dy * dy);
                var coverage = Mathf.Min(Mathf.Clamp01(outer - distance + 0.5f), Mathf.Clamp01(distance - inner + 0.5f));
                if (coverage == 0f) continue;

                var color = Color.HSVToRGB(Mathf.Atan2(dy, dx) * Mathf.Rad2Deg / 360f, 1f, 1f);
                color.a = coverage;
                texture.SetPixel(x, y, color);
            }
        }

        texture.Apply();
        return Create(texture, size, 0f);
    }

    private static Sprite Paint(int size, Func<float, float, float> coverage, float border = 0f) {
        var texture = new Texture2D(size, size);

        for (var y = 0; y < size; y++) {
            for (var x = 0; x < size; x++) {
                texture.SetPixel(x, y, new Color(1f, 1f, 1f, coverage(x + 0.5f, y + 0.5f)));
            }
        }

        texture.Apply();
        return Create(texture, size, border);
    }

    private static Sprite Create(Texture2D texture, int size, float border) {
        return Sprite.Create(texture, new Rect(0f, 0f, size, size), new Vector2(0.5f, 0.5f), border: new Vector4(border, border, border, border));
    }

    private static float Line(float x, float y, float ax, float ay, float bx, float by, float radius) {
        var abx = bx - ax;
        var aby = by - ay;
        var t = Mathf.Clamp01(((x - ax) * abx + (y - ay) * aby) / (abx * abx + aby * aby));
        var dx = x - ax - abx * t;
        var dy = y - ay - aby * t;
        return Mathf.Clamp01(radius - Mathf.Sqrt(dx * dx + dy * dy) + 0.5f);
    }

    private static float Ring(float x, float y, float cx, float cy, float radius, float thickness) {
        var dx = x - cx;
        var dy = y - cy;
        return Mathf.Clamp01(thickness - Mathf.Abs(Mathf.Sqrt(dx * dx + dy * dy) - radius) + 0.5f);
    }

    private static float RoundRectDistance(float x, float y, float cx, float cy, float halfWidth, float halfHeight, float radius) {
        var dx = Mathf.Max(Mathf.Abs(x - cx) - (halfWidth - radius), 0f);
        var dy = Mathf.Max(Mathf.Abs(y - cy) - (halfHeight - radius), 0f);
        return Mathf.Sqrt(dx * dx + dy * dy) - radius;
    }

    private static float RoundRect(float x, float y, float cx, float cy, float halfWidth, float halfHeight, float radius) {
        return Mathf.Clamp01(0.5f - RoundRectDistance(x, y, cx, cy, halfWidth, halfHeight, radius));
    }

    private static float Outline(float distance, float thickness) {
        return Mathf.Clamp01(thickness - Mathf.Abs(distance) + 0.5f);
    }

    private static float ArrowUpShape(float x, float y) {
        var stem = RoundRectDistance(x, y, 32f, 20f, 8f, 16f, 1f);
        var slant = (Mathf.Abs(x - 32f) + (y - 58f)) * 0.7071f;
        var head = Mathf.Max(slant, 30f - y);
        return Mathf.Min(stem, head);
    }
}
