#include <algorithm>
#include <cmath>
#include <functional>

#include "reactive/beatsaber/BeatSaberResources.hpp"
#include "reactive/beatsaber/GameResources.hpp"
#include "reactive/beatsaber/VRScrollAdapter.hpp"

using namespace UnityEngine;

namespace {
constexpr uint8_t kBackground[] = {
#embed "Background.png"
};
constexpr uint8_t kUnderline[] = {
#embed "Underline.png"
};
constexpr uint8_t kSpinner[] = {
#embed "Spinner.png"
};
constexpr uint8_t kCross[] = {
#embed "Cross.png"
};
constexpr uint8_t kFrame[] = {
#embed "Frame.png"
};
constexpr uint8_t kTransparentPixel[] = {
#embed "TransparentPixel.png"
};

int ReadInt(uint8_t const* data) {
    return data[0] << 24 | data[1] << 16 | data[2] << 8 | data[3];
}

template <size_t Length>
Texture2D* Load(uint8_t const (&png)[Length]) {
    auto* texture = new Texture2D(ReadInt(png + 16), ReadInt(png + 20));
    texture->encoded = png;
    texture->encodedLength = Length;
    return texture;
}

Sprite* Slice(Texture2D* texture, float x, float y, float width, float height, float left, float bottom, float right, float top) {
    return Sprite::Create(texture, {x, y, width, height}, {0.5f, 0.5f}, 100.f, 1u, SpriteMeshType::FullRect, {left, bottom, right, top}, false);
}

template <size_t Length>
Sprite* Whole(uint8_t const (&png)[Length], float border) {
    auto* texture = Load(png);
    return Slice(texture, 0.f, 0.f, texture->width, texture->height, border, border, border, border);
}

float Clamp01(float value) {
    return std::clamp(value, 0.f, 1.f);
}

Sprite* Paint(int size, std::function<float(float, float)> const& coverage, float border = 0.f) {
    auto* texture = new Texture2D(size, size);
    texture->pixels.resize(size * size * 4);

    for (int y = 0; y < size; y++) {
        for (int x = 0; x < size; x++) {
            auto* pixel = &texture->pixels[(y * size + x) * 4];
            pixel[0] = pixel[1] = pixel[2] = 255;
            pixel[3] = static_cast<uint8_t>(std::round(coverage(x + 0.5f, y + 0.5f) * 255.f));
        }
    }

    return Slice(texture, 0.f, 0.f, size, size, border, border, border, border);
}

float Line(float x, float y, float ax, float ay, float bx, float by, float radius) {
    const float abx = bx - ax;
    const float aby = by - ay;
    const float t = Clamp01(((x - ax) * abx + (y - ay) * aby) / (abx * abx + aby * aby));
    const float dx = x - ax - abx * t;
    const float dy = y - ay - aby * t;
    return Clamp01(radius - std::sqrt(dx * dx + dy * dy) + 0.5f);
}

float RoundRect(float x, float y, float cx, float cy, float halfWidth, float halfHeight, float radius) {
    const float dx = std::max(std::abs(x - cx) - (halfWidth - radius), 0.f);
    const float dy = std::max(std::abs(y - cy) - (halfHeight - radius), 0.f);
    return Clamp01(0.5f - (std::sqrt(dx * dx + dy * dy) - radius));
}

Material* NamedMaterial(char const* name, Color color = {1.f, 1.f, 1.f, 1.f}) {
    auto* material = new Material();
    material->name = name;
    material->color = color;
    return material;
}
}

namespace playground {
void LoadResources() {
    auto* sheet = Load(kBackground);

    auto* sprites = new Reactive::BeatSaber::SpriteCollection();
    sprites->background = Slice(sheet, 0.f, 0.f, 400.f, 400.f, 128.f, 128.f, 128.f, 128.f);
    sprites->rectangle = Slice(sheet, 128.f, 128.f, 144.f, 144.f, 0.f, 0.f, 0.f, 0.f);
    sprites->backgroundTop = Slice(sheet, 0.f, 272.f, 400.f, 128.f, 128.f, 0.f, 128.f, 128.f);
    sprites->backgroundBottom = Slice(sheet, 0.f, 0.f, 400.f, 128.f, 128.f, 128.f, 128.f, 0.f);
    sprites->backgroundRight = Slice(sheet, 272.f, 0.f, 128.f, 400.f, 0.f, 128.f, 128.f, 128.f);
    sprites->backgroundLeft = Slice(sheet, 0.f, 0.f, 128.f, 400.f, 128.f, 128.f, 0.f, 128.f);
    sprites->backgroundUnderline = Whole(kUnderline, 128.f);
    sprites->spinnerIcon = Whole(kSpinner, 0.f);
    sprites->crossIcon = Whole(kCross, 0.f);
    sprites->frame = Whole(kFrame, 128.f);
    sprites->transparentPixel = Whole(kTransparentPixel, 0.f);

    auto* materials = new Reactive::BeatSaber::MaterialCollection();
    materials->uiAdditiveGlowMaterial = NamedMaterial("UIAdditiveGlow");

    auto* resources = new Reactive::BeatSaber::BeatSaberResources();
    resources->sprites = sprites;
    resources->materials = materials;

    auto* host = Root()->gameObject->AddComponent<Reactive::BeatSaber::BundleHost*>();
    host->resources = resources;
    reactive::beatsaber::BundleLoader::host = host;
}
}

namespace reactive::beatsaber {
AssetBundle* BundleLoader::assetBundle = nullptr;
Reactive::BeatSaber::BundleHost* BundleLoader::host = nullptr;

custom_types::Helpers::Coroutine BundleLoader::LoadBundle(GameObject*) {
    co_return;
}

Material* UIFontMaterial() {
    static auto* material = NamedMaterial("UIFont");
    return material;
}

Material* UINoGlowMaterial() {
    static auto* material = NamedMaterial("UINoGlow");
    return material;
}

Material* UIFogBackgroundMaterial() {
    static auto* material = NamedMaterial("UIFogBG", {0.235f, 0.235f, 0.235f, 0.96f});
    return material;
}

TMPro::TMP_FontAsset* MainTextFont() {
    static auto* font = new TMPro::TMP_FontAsset();
    return font;
}

Sprite* ArrowIcon() {
    static auto* sprite = Paint(64, [](float x, float y) {
        return std::max(Line(x, y, 14.f, 42.f, 32.f, 24.f, 3.5f), Line(x, y, 32.f, 24.f, 50.f, 42.f, 3.5f));
    });
    return sprite;
}

Sprite* VerticalIndicatorIcon() {
    static auto* sprite = Paint(32, [](float x, float y) { return RoundRect(x, y, 16.f, 16.f, 16.f, 16.f, 8.f); }, 12.f);
    return sprite;
}

void RaiseButtonClickSignal() {}
}

void Reactive::BeatSaber::VRScrollAdapter::Awake() {}
void Reactive::BeatSaber::VRScrollAdapter::Update() {}
