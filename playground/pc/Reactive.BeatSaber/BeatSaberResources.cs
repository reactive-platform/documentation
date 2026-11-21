using System.IO;
using System.Reflection;
using UnityEngine;

namespace Reactive.BeatSaber;

public static class BeatSaberResources {
    public static SpriteCollection Sprites { get; } = LoadSprites();

    public static MaterialCollection Materials { get; } = new() {
        uiAdditiveGlowMaterial = new Material { name = "UIAdditiveGlow" }
    };

    private static SpriteCollection LoadSprites() {
        var sheet = Load("Background.png");

        return new SpriteCollection {
            background = Slice(sheet, 0f, 0f, 400f, 400f, 128f, 128f, 128f, 128f),
            rectangle = Slice(sheet, 128f, 128f, 144f, 144f, 0f, 0f, 0f, 0f),
            backgroundTop = Slice(sheet, 0f, 272f, 400f, 128f, 128f, 0f, 128f, 128f),
            backgroundBottom = Slice(sheet, 0f, 0f, 400f, 128f, 128f, 128f, 128f, 0f),
            backgroundRight = Slice(sheet, 272f, 0f, 128f, 400f, 0f, 128f, 128f, 128f),
            backgroundLeft = Slice(sheet, 0f, 0f, 128f, 400f, 128f, 128f, 0f, 128f),
            backgroundUnderline = Whole("Underline.png", 128f),
            spinnerIcon = Whole("Spinner.png", 0f),
            crossIcon = Whole("Cross.png", 0f),
            frame = Whole("Frame.png", 128f),
            transparentPixel = Whole("TransparentPixel.png", 0f)
        };
    }

    private static Texture2D Load(string name) {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)!;
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        return SpriteUtils.CreateTexture(buffer.ToArray())!;
    }

    private static Sprite Whole(string name, float border) {
        var texture = Load(name);
        return Slice(texture, 0f, 0f, texture.width, texture.height, border, border, border, border);
    }

    private static Sprite Slice(Texture2D texture, float x, float y, float width, float height, float left, float bottom, float right, float top) {
        return Sprite.Create(texture, new Rect(x, y, width, height), new Vector2(0.5f, 0.5f), border: new Vector4(left, bottom, right, top));
    }
}
