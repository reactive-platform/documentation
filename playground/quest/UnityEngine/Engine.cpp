#include "playground/Engine.hpp"

#include <algorithm>
#include <charconv>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <unordered_map>
#include <unordered_set>

#include "reactive/ReactiveScheduler.hpp"

#define JS_IMPORT(name) __attribute__((import_module("env"), import_name(#name)))

extern "C" {
JS_IMPORT(js_render) void js_render(char const* batch, int length);
JS_IMPORT(js_log) void js_log(int level, char const* message, int length);
JS_IMPORT(js_measure_text) void js_measure_text(char const* text, int length, float size, int style, int richText, float* result);
JS_IMPORT(js_upload_texture) void js_upload_texture(int id, int width, int height, uint8_t const* data, int length, int encoded);
JS_IMPORT(js_fetch_image) void js_fetch_image(int request, int texture, char const* url, int length);
}

using namespace UnityEngine;

namespace {
int g_nextObjectId = 1;
int g_nextTextureId = 1;
int g_nextRequestId = 1;

bool g_dirty = true;
float g_time = 0.f;
float g_deltaTime = 0.f;

RectTransform* g_root = nullptr;

std::vector<MonoBehaviour*> g_behaviours;
std::vector<Object*> g_destroyQueue;
std::unordered_map<int, Networking::UnityWebRequest*> g_requests;

std::unordered_map<int, std::string> g_lastNodes;
std::unordered_map<int, GameObject*> g_objects;
std::unordered_set<int> g_visited;
std::vector<int> g_changed;

std::vector<GameObject*> g_hovered;
GameObject* g_pressed = nullptr;
bool g_dragging = false;
Vector2 g_lastPosition{};

void DestroyNow(Object* object);

void AppendFloat(std::string& out, float value) {
    if (!std::isfinite(value)) value = 0.f;
    char buffer[32];
    auto result = std::to_chars(buffer, buffer + sizeof(buffer), std::round(value * 1000.f) / 1000.f);
    out.append(buffer, result.ptr);
}

void AppendJson(std::string& out, std::string_view value) {
    out += '"';
    for (char c : value) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    char buffer[8];
                    std::snprintf(buffer, sizeof(buffer), "\\u%04x", c);
                    out += buffer;
                } else {
                    out += c;
                }
        }
    }
    out += '"';
}

void Field(std::string& out, char const* name) {
    out += ",\"";
    out += name;
    out += "\":";
}

void FloatField(std::string& out, char const* name, float value) {
    Field(out, name);
    AppendFloat(out, value);
}

void IntField(std::string& out, char const* name, int value) {
    Field(out, name);
    out += std::to_string(value);
}

void BoolField(std::string& out, char const* name, bool value) {
    Field(out, name);
    out += value ? "true" : "false";
}

void StringField(std::string& out, char const* name, std::string_view value) {
    Field(out, name);
    AppendJson(out, value);
}

void Floats(std::string& out, char const* name, float a, float b, float c, float d) {
    Field(out, name);
    out += '[';
    AppendFloat(out, a);
    out += ',';
    AppendFloat(out, b);
    out += ',';
    AppendFloat(out, c);
    out += ',';
    AppendFloat(out, d);
    out += ']';
}

void ColorField(std::string& out, char const* name, Color c) {
    Floats(out, name, c.r, c.g, c.b, c.a);
}

void Upload(Texture2D* texture) {
    if (texture->external || texture->uploadedVersion == texture->version) return;
    texture->uploadedVersion = texture->version;

    if (texture->encoded) {
        js_upload_texture(texture->id, texture->width, texture->height, texture->encoded, texture->encodedLength, 1);
    } else {
        js_upload_texture(texture->id, texture->width, texture->height, texture->pixels.data(), static_cast<int>(texture->pixels.size()), 0);
    }
}

void Visit(RectTransform* transform, int parent, int index, float parentAlpha, bool parentBlocks) {
    auto* go = transform->gameObject;
    const int id = go->id;
    g_visited.insert(id);
    g_objects[id] = go;

    const auto rect = transform->get_rect();
    const auto parentSize = transform->ParentSize();
    const float anchorX = transform->anchorMin.x + (transform->anchorMax.x - transform->anchorMin.x) * transform->pivot.x;
    const float anchorY = transform->anchorMin.y + (transform->anchorMax.y - transform->anchorMin.y) * transform->pivot.y;
    const float left = parentSize.x * anchorX + transform->anchoredPosition.x - transform->pivot.x * rect.m_Width;
    const float bottom = parentSize.y * anchorY + transform->anchoredPosition.y - transform->pivot.y * rect.m_Height;

    auto* image = go->GetComponent<UI::Image*>();
    auto* text = go->GetComponent<TMPro::TMP_Text*>();
    UI::Graphic* graphic = text ? static_cast<UI::Graphic*>(text) : image;
    const bool drawn = graphic && graphic->enabled;
    auto* group = go->GetComponent<CanvasGroup*>();
    auto* mask = go->GetComponent<UI::RectMask2D*>();
    auto* view = dynamic_cast<HMUI::ImageView*>(image);
    auto* sprite = drawn && image ? image->sprite : nullptr;

    float alpha = parentAlpha;
    bool blocks = parentBlocks;
    if (group && group->enabled) {
        alpha = group->ignoreParentGroups ? group->alpha : parentAlpha * group->alpha;
        blocks = (group->ignoreParentGroups || parentBlocks) && group->blocksRaycasts;
    }

    if (sprite) Upload(sprite->texture);

    std::string node = "{\"id\":" + std::to_string(id);
    IntField(node, "p", parent);
    IntField(node, "i", index);
    BoolField(node, "a", go->activeSelf);
    FloatField(node, "x", parent == 0 ? 0.f : left);
    FloatField(node, "y", parent == 0 ? 0.f : parentSize.y - bottom - rect.m_Height);
    FloatField(node, "w", rect.m_Width);
    FloatField(node, "h", rect.m_Height);
    FloatField(node, "sx", transform->localScale.x);
    FloatField(node, "sy", transform->localScale.y);
    FloatField(node, "px", transform->pivot.x);
    FloatField(node, "py", transform->pivot.y);
    FloatField(node, "rz", transform->get_localEulerAngles().z);
    FloatField(node, "o", alpha);
    BoolField(node, "cl", mask && mask->enabled);
    IntField(node, "k", !drawn ? 0 : (text ? 2 : 1));
    BoolField(node, "r", blocks && drawn && graphic->raycastTarget);

    Color color = graphic ? graphic->color : Color{};
    if (graphic && graphic->material) {
        auto const& tint = graphic->material->color;
        color = {color.r * tint.r, color.g * tint.g, color.b * tint.b, color.a * tint.a};
    }
    ColorField(node, "c", color);

    if (text) {
        StringField(node, "t", text->text);
        FloatField(node, "fs", text->FittedFontSize(rect.m_Width, rect.m_Height));
        IntField(node, "st", static_cast<int>(text->fontStyle));
        IntField(node, "al", static_cast<int>(text->alignment));
        BoolField(node, "wr", text->enableWordWrapping);
        BoolField(node, "rt", text->HasRichText());
        IntField(node, "of", static_cast<int>(text->overflowMode));
    }
    if (view && view->_skew != 0.f) FloatField(node, "sk", view->_skew);
    if (graphic && graphic->material) StringField(node, "m", graphic->material->name);
    if (view && view->gradient) {
        Field(node, "g");
        node += "{\"d\":" + std::to_string(static_cast<int>(view->_gradientDirection));
        ColorField(node, "a", view->color0);
        ColorField(node, "b", view->color1);
        node += '}';
    }
    if (drawn && !text) {
        IntField(node, "it", image ? static_cast<int>(image->type) : 0);
        IntField(node, "fm", 4);
        FloatField(node, "fa", 1.f);
        BoolField(node, "pa", image && image->preserveAspect);
        BoolField(node, "fc", true);
    }
    if (sprite) {
        Field(node, "sp");
        node += "{\"t\":" + std::to_string(sprite->texture->id);
        IntField(node, "v", sprite->texture->version);
        FloatField(node, "x", sprite->rect.m_XMin);
        FloatField(node, "y", sprite->rect.m_YMin);
        FloatField(node, "w", sprite->rect.m_Width);
        FloatField(node, "h", sprite->rect.m_Height);
        Floats(node, "b", sprite->border.x, sprite->border.y, sprite->border.z, sprite->border.w);
        FloatField(node, "u", sprite->pixelsPerUnit * image->pixelsPerUnitMultiplier / UI::Image::ReferencePixelsPerUnit);
        node += '}';
    }
    StringField(node, "n", go->name);
    node += '}';

    auto& last = g_lastNodes[id];
    if (last != node) {
        last = std::move(node);
        g_changed.push_back(id);
    }

    int childIndex = 0;
    for (auto* child : transform->children) {
        Visit(static_cast<RectTransform*>(child), id, childIndex++, alpha, blocks);
    }
}

void Flush() {
    g_visited.clear();
    g_changed.clear();
    Visit(g_root, 0, 0, 1.f, true);

    std::vector<int> removed;
    for (auto const& [id, node] : g_lastNodes) {
        if (!g_visited.contains(id)) removed.push_back(id);
    }
    if (g_changed.empty() && removed.empty()) return;

    std::string batch = "{\"s\":[";
    for (size_t i = 0; i < g_changed.size(); ++i) {
        if (i) batch += ',';
        batch += g_lastNodes[g_changed[i]];
    }
    batch += "],\"r\":[";
    for (size_t i = 0; i < removed.size(); ++i) {
        if (i) batch += ',';
        batch += std::to_string(removed[i]);
        g_lastNodes.erase(removed[i]);
        g_objects.erase(removed[i]);
    }
    batch += "]}";

    js_render(batch.data(), static_cast<int>(batch.size()));
}

void StepCoroutine(Coroutine* coroutine) {
    if (coroutine->finished || g_time < coroutine->waitUntil) return;

    while (!coroutine->stack.empty()) {
        auto* helper = dynamic_cast<custom_types::Helpers::CoroutineHelper*>(coroutine->stack.back());
        if (!helper) {
            coroutine->stack.pop_back();
            continue;
        }

        auto handle = helper->coroutine.Handle();
        handle.resume();

        if (handle.done()) {
            coroutine->stack.pop_back();
            continue;
        }

        auto* current = handle.promise().current;
        if (auto* wait = dynamic_cast<WaitForSeconds*>(current)) {
            coroutine->waitUntil = g_time + wait->seconds;
            return;
        }
        if (dynamic_cast<custom_types::Helpers::CoroutineHelper*>(current)) {
            coroutine->stack.push_back(current);
            continue;
        }
        return;
    }

    coroutine->finished = true;
}

GameObject* FindObject(int id) {
    auto it = g_objects.find(id);
    return it != g_objects.end() && !it->second->destroyed ? it->second : nullptr;
}

void UpdateHover(GameObject* target, EventSystems::PointerEventData* data) {
    std::vector<GameObject*> chain;
    for (Transform* t = target ? target->transform : nullptr; t; t = t->parent) chain.push_back(t->gameObject);

    for (auto* old : g_hovered) {
        if (std::find(chain.begin(), chain.end(), old) != chain.end() || old->destroyed) continue;
        EventSystems::ExecuteEvents::Execute<EventSystems::IPointerExitHandler*>(old, data, [](auto* handler, auto* d) { handler->OnPointerExit(d); });
    }
    for (auto it = chain.rbegin(); it != chain.rend(); ++it) {
        if (std::find(g_hovered.begin(), g_hovered.end(), *it) != g_hovered.end()) continue;
        EventSystems::ExecuteEvents::Execute<EventSystems::IPointerEnterHandler*>(*it, data, [](auto* handler, auto* d) { handler->OnPointerEnter(d); });
    }

    g_hovered = std::move(chain);
}

void DestroyNow(Object* object) {
    if (object->destroyed) return;
    playground::MarkDirty();

    if (auto* go = dynamic_cast<GameObject*>(object)) {
        auto children = go->transform->children;
        for (auto* child : children) DestroyNow(child->gameObject);

        auto components = go->components;
        for (auto* component : components) {
            component->OnDestroying();
            component->destroyed = true;
        }

        if (auto* parent = go->transform->parent) std::erase(parent->children, go->transform);
        go->transform->parent = nullptr;
        go->destroyed = true;
    } else if (auto* component = dynamic_cast<Component*>(object)) {
        component->OnDestroying();
        component->destroyed = true;
        std::erase(component->gameObject->components, component);
    } else {
        object->destroyed = true;
    }
}
}

namespace playground {
void MarkDirty() {
    g_dirty = true;
}

void Log(int level, std::string_view message) {
    js_log(level, message.data(), static_cast<int>(message.size()));
}

RectTransform* Root() {
    if (!g_root) {
        auto* go = GameObject::New_ctor("PreviewRoot");
        g_root = go->transform;
        g_root->anchorMin = {0.f, 0.f};
        g_root->anchorMax = {0.f, 0.f};
        g_root->pivot = {0.f, 0.f};
    }
    return g_root;
}

void SetRootSize(float width, float height) {
    Root()->set_sizeDelta({width, height});
}

void Tick(float deltaTime) {
    g_deltaTime = deltaTime;
    g_time += deltaTime;

    std::erase_if(g_behaviours, [](auto* x) { return x->destroyed; });

    auto frame = g_behaviours;

    for (auto* behaviour : frame) {
        if (behaviour->destroyed || behaviour->started || !behaviour->get_isActiveAndEnabled()) continue;
        behaviour->started = true;
        behaviour->Start();
    }

    for (auto* behaviour : frame) {
        if (!behaviour->destroyed && behaviour->get_isActiveAndEnabled()) behaviour->Update();
    }

    for (auto* behaviour : frame) {
        if (behaviour->destroyed || behaviour->coroutines.empty() || !behaviour->get_isActiveAndEnabled()) continue;
        auto coroutines = behaviour->coroutines;
        for (auto* coroutine : coroutines) StepCoroutine(coroutine);
        std::erase_if(behaviour->coroutines, [](auto* x) { return x->finished; });
    }

    for (auto* behaviour : frame) {
        if (!behaviour->destroyed && behaviour->get_isActiveAndEnabled()) behaviour->LateUpdate();
    }

    auto queue = std::move(g_destroyQueue);
    g_destroyQueue.clear();
    for (auto* object : queue) DestroyNow(object);

    reactive::ReactiveScheduler::Run();

    if (g_dirty) {
        g_dirty = false;
        Flush();
    }
}

void PointerMove(int id, float x, float y) {
    EventSystems::PointerEventData data;
    data.position = {x, y};
    data.delta = {x - g_lastPosition.x, y - g_lastPosition.y};
    g_lastPosition = data.position;

    UpdateHover(FindObject(id), &data);

    if (g_pressed) {
        using namespace EventSystems;
        if (!g_dragging) {
            g_dragging = true;
            ExecuteEvents::ExecuteHierarchy<IBeginDragHandler*>(g_pressed, &data, [](auto* handler, auto* d) { handler->OnBeginDrag(d); });
        }
        ExecuteEvents::ExecuteHierarchy<IDragHandler*>(g_pressed, &data, [](auto* handler, auto* d) { handler->OnDrag(d); });
    }
}

void PointerDown(int id, float x, float y) {
    auto* target = FindObject(id);
    if (!target) return;

    using namespace EventSystems;
    PointerEventData data;
    data.position = {x, y};
    auto* handled = ExecuteEvents::ExecuteHierarchy<IPointerDownHandler*>(target, &data, [](auto* handler, auto* d) { handler->OnPointerDown(d); });
    g_pressed = handled ? handled : target;
    g_dragging = false;
}

void PointerUp(int, float x, float y) {
    if (!g_pressed) return;

    using namespace EventSystems;
    PointerEventData data;
    data.position = {x, y};
    ExecuteEvents::ExecuteHierarchy<IPointerUpHandler*>(g_pressed, &data, [](auto* handler, auto* d) { handler->OnPointerUp(d); });
    if (g_dragging) ExecuteEvents::ExecuteHierarchy<IEndDragHandler*>(g_pressed, &data, [](auto* handler, auto* d) { handler->OnEndDrag(d); });

    g_pressed = nullptr;
    g_dragging = false;
}

void PointerScroll(int id, float x, float y, float deltaY) {
    auto* target = FindObject(id);
    if (!target) return;

    using namespace EventSystems;
    // ScrollArea treats the delta as a joystick held for one frame, so it's divided back into units per notch
    constexpr float kUnitsPerNotch = 8.f;
    constexpr float kJoystickScrollSpeed = 60.f;

    PointerEventData data;
    data.position = {x, y};
    data.scrollDelta = {0.f, deltaY * kUnitsPerNotch / (kJoystickScrollSpeed * std::max(g_deltaTime, 0.001f))};
    ExecuteEvents::ExecuteHierarchy<IScrollHandler*>(target, &data, ExecuteEvents::get_scrollHandler());
}

void RequestFinished(int id, bool succeeded, int status, int width, int height) {
    auto it = g_requests.find(id);
    if (it == g_requests.end()) return;

    auto* request = it->second;
    g_requests.erase(it);

    if (succeeded) {
        request->result = Networking::UnityWebRequest::Result::Success;
        request->texture->width = width;
        request->texture->height = height;
    } else {
        request->result = status > 0 ? Networking::UnityWebRequest::Result::ProtocolError : Networking::UnityWebRequest::Result::ConnectionError;
        request->error = status > 0 ? "HTTP " + std::to_string(status) : "Cannot connect to destination host";
        request->texture = nullptr;
    }

    for (auto* action : request->operation->completed) action->invoke(request->operation);
    MarkDirty();
}
}

namespace UnityEngine {
float Time::get_time() {
    return g_time;
}

float Time::get_deltaTime() {
    return g_deltaTime;
}

void Debug::Log(StringW message) {
    playground::Log(3, message.value);
}

void Debug::LogWarning(StringW message) {
    playground::Log(2, message.value);
}

void Debug::LogError(StringW message) {
    playground::Log(0, message.value);
}

void Object::Destroy(Object* object) {
    if (object) g_destroyQueue.push_back(object);
}

Texture2D::Texture2D(int w, int h) : id(g_nextTextureId++), width(w), height(h) {}

Sprite* Sprite::Create(Texture2D* texture, Rect rect, Vector2, float pixelsPerUnit, uint32_t, SpriteMeshType, Vector4 border, bool) {
    auto* sprite = new Sprite();
    sprite->texture = texture;
    sprite->rect = rect;
    sprite->pixelsPerUnit = pixelsPerUnit;
    sprite->border = border;
    return sprite;
}

StringW Component::get_name() {
    return gameObject->name;
}

void Component::set_name(StringW value) {
    gameObject->set_name(std::move(value));
}

Transform* Component::get_transform() const {
    return gameObject->transform;
}

void Behaviour::set_enabled(bool value) {
    if (enabled == value) return;
    enabled = value;
    playground::MarkDirty();
    OnEnabledChanged();
}

bool Behaviour::get_isActiveAndEnabled() const {
    return enabled && gameObject->get_activeInHierarchy();
}

void MonoBehaviour::OnAdded() {
    g_behaviours.push_back(this);
    if (gameObject->get_activeInHierarchy()) OnObjectActivated();
}

void MonoBehaviour::OnObjectActivated() {
    if (!awoken) {
        awoken = true;
        Awake();
    }
    if (enabled && !enabledFired) {
        enabledFired = true;
        OnEnable();
    }
}

void MonoBehaviour::OnObjectDeactivated() {
    if (enabledFired) {
        enabledFired = false;
        OnDisable();
    }
}

void MonoBehaviour::OnEnabledChanged() {
    if (!gameObject->get_activeInHierarchy()) return;
    if (enabled) OnObjectActivated();
    else OnObjectDeactivated();
}

void MonoBehaviour::OnDestroying() {
    OnObjectDeactivated();
    if (awoken) OnDestroy();
    coroutines.clear();
}

Coroutine* MonoBehaviour::StartCoroutine(System::Collections::IEnumerator* routine) {
    auto* coroutine = new Coroutine(routine);
    coroutines.push_back(coroutine);
    StepCoroutine(coroutine);
    return coroutine;
}

void MonoBehaviour::StopAllCoroutines() {
    for (auto* coroutine : coroutines) coroutine->finished = true;
}

void Transform::set_localPosition(Vector3 value) {
    localPosition = value;
    playground::MarkDirty();
}

void Transform::set_localScale(Vector3 value) {
    localScale = value;
    playground::MarkDirty();
}

void Transform::set_localEulerAngles(Vector3 value) {
    localEulerAngles = value;
    playground::MarkDirty();
}

Vector3 Transform::get_lossyScale() const {
    if (!parent) return localScale;
    auto scale = parent->get_lossyScale();
    return {scale.x * localScale.x, scale.y * localScale.y, scale.z * localScale.z};
}

Vector3 Transform::get_position() const {
    auto local = get_localPosition();
    if (!parent) return local;
    auto origin = parent->get_position();
    auto scale = parent->get_lossyScale();
    return {origin.x + scale.x * local.x, origin.y + scale.y * local.y, origin.z + scale.z * local.z};
}

Vector3 Transform::InverseTransformPoint(Vector3 point) const {
    auto origin = get_position();
    auto scale = get_lossyScale();
    return {
        scale.x == 0.f ? 0.f : (point.x - origin.x) / scale.x,
        scale.y == 0.f ? 0.f : (point.y - origin.y) / scale.y,
        scale.z == 0.f ? 0.f : (point.z - origin.z) / scale.z,
    };
}

void Transform::SetParent(Transform* newParent, bool worldPositionStays) {
    if (newParent == parent) return;

    const auto world = worldPositionStays ? get_position() : Vector3{};
    const bool wasActive = gameObject->get_activeInHierarchy();

    if (parent) std::erase(parent->children, this);
    parent = newParent;
    if (newParent) newParent->children.push_back(this);
    playground::MarkDirty();

    if (worldPositionStays) set_localPosition(parent ? parent->InverseTransformPoint(world) : world);

    gameObject->RefreshActivation(wasActive);
    AfterParentChanged();
}

void RectTransform::set_anchorMin(Vector2 value) {
    anchorMin = value;
    CheckDimensions();
}

void RectTransform::set_anchorMax(Vector2 value) {
    anchorMax = value;
    CheckDimensions();
}

void RectTransform::set_pivot(Vector2 value) {
    pivot = value;
    playground::MarkDirty();
}

void RectTransform::set_anchoredPosition(Vector2 value) {
    anchoredPosition = value;
    playground::MarkDirty();
}

void RectTransform::set_sizeDelta(Vector2 value) {
    sizeDelta = value;
    CheckDimensions();
}

Vector2 RectTransform::get_offsetMin() const {
    return {anchoredPosition.x - sizeDelta.x * pivot.x, anchoredPosition.y - sizeDelta.y * pivot.y};
}

void RectTransform::set_offsetMin(Vector2 value) {
    const auto current = get_offsetMin();
    const Vector2 offset{value.x - current.x, value.y - current.y};
    sizeDelta = {sizeDelta.x - offset.x, sizeDelta.y - offset.y};
    anchoredPosition = {anchoredPosition.x + offset.x * (1.f - pivot.x), anchoredPosition.y + offset.y * (1.f - pivot.y)};
    CheckDimensions();
}

Vector2 RectTransform::get_offsetMax() const {
    return {anchoredPosition.x + sizeDelta.x * (1.f - pivot.x), anchoredPosition.y + sizeDelta.y * (1.f - pivot.y)};
}

void RectTransform::set_offsetMax(Vector2 value) {
    const auto current = get_offsetMax();
    const Vector2 offset{value.x - current.x, value.y - current.y};
    sizeDelta = {sizeDelta.x + offset.x, sizeDelta.y + offset.y};
    anchoredPosition = {anchoredPosition.x + offset.x * pivot.x, anchoredPosition.y + offset.y * pivot.y};
    CheckDimensions();
}

Vector2 RectTransform::ParentSize() const {
    if (!parent) return {};
    const auto r = static_cast<RectTransform*>(parent)->get_rect();
    return {r.m_Width, r.m_Height};
}

Rect RectTransform::get_rect() const {
    const float spanX = anchorMax.x - anchorMin.x;
    const float spanY = anchorMax.y - anchorMin.y;
    const auto parentSize = spanX == 0.f && spanY == 0.f ? Vector2{} : ParentSize();
    const float width = parentSize.x * spanX + sizeDelta.x;
    const float height = parentSize.y * spanY + sizeDelta.y;
    return {-pivot.x * width, -pivot.y * height, width, height};
}

Vector3 RectTransform::get_localPosition() const {
    if (!parent) return {anchoredPosition.x, anchoredPosition.y, 0.f};
    const auto r = static_cast<RectTransform*>(parent)->get_rect();
    return {
        r.m_XMin + r.m_Width * (anchorMin.x + (anchorMax.x - anchorMin.x) * pivot.x) + anchoredPosition.x,
        r.m_YMin + r.m_Height * (anchorMin.y + (anchorMax.y - anchorMin.y) * pivot.y) + anchoredPosition.y,
        0.f,
    };
}

void RectTransform::set_localPosition(Vector3 value) {
    const auto current = get_localPosition();
    anchoredPosition = {anchoredPosition.x + value.x - current.x, anchoredPosition.y + value.y - current.y};
    playground::MarkDirty();
}

void RectTransform::SetInsetAndSizeFromParentEdge(Edge edge, float inset, float size) {
    const bool vertical = edge == Edge::Top || edge == Edge::Bottom;
    const bool end = edge == Edge::Top || edge == Edge::Right;
    const float anchor = end ? 1.f : 0.f;

    auto setAxis = [vertical](Vector2& vector, float value) { (vertical ? vector.y : vector.x) = value; };
    const float pivotValue = vertical ? pivot.y : pivot.x;

    setAxis(anchorMin, anchor);
    setAxis(anchorMax, anchor);
    setAxis(sizeDelta, size);
    setAxis(anchoredPosition, end ? -inset - size * (1.f - pivotValue) : inset + size * pivotValue);

    CheckDimensions();
}

void RectTransform::SetSizeWithCurrentAnchors(Axis axis, float size) {
    const auto parentSize = ParentSize();
    if (axis == Axis::Horizontal) sizeDelta.x = size - parentSize.x * (anchorMax.x - anchorMin.x);
    else sizeDelta.y = size - parentSize.y * (anchorMax.y - anchorMin.y);
    CheckDimensions();
}

void RectTransform::CheckDimensions() {
    playground::MarkDirty();

    const auto r = get_rect();
    if (r.m_Width == lastSize.x && r.m_Height == lastSize.y) return;
    lastSize = {r.m_Width, r.m_Height};

    auto components = gameObject->components;
    for (auto* component : components) {
        auto* behaviour = dynamic_cast<MonoBehaviour*>(component);
        if (behaviour && behaviour->get_isActiveAndEnabled()) behaviour->OnRectTransformDimensionsChange();
    }

    auto copy = children;
    for (auto* child : copy) static_cast<RectTransform*>(child)->CheckDimensions();
}

GameObject::GameObject() : id(g_nextObjectId++), transform(new RectTransform()) {
    transform->gameObject = this;
    components.push_back(transform);
}

GameObject* GameObject::New_ctor(StringW name) {
    auto* go = new GameObject();
    go->name = std::move(name.value);
    return go;
}

bool GameObject::get_activeInHierarchy() const {
    for (Transform* t = transform; t; t = t->parent) {
        if (!t->gameObject->activeSelf) return false;
    }
    return true;
}

void GameObject::SetActive(bool value) {
    if (activeSelf == value) return;
    const bool wasActive = get_activeInHierarchy();
    activeSelf = value;
    playground::MarkDirty();
    RefreshActivation(wasActive);
}

void GameObject::RefreshActivation(bool wasActive) {
    const bool active = get_activeInHierarchy();
    if (active != wasActive) SendActivation(active);
}

void GameObject::SendActivation(bool active) {
    auto copy = components;
    for (auto* component : copy) {
        if (active) component->OnObjectActivated();
        else component->OnObjectDeactivated();
    }
    auto children = transform->children;
    for (auto* child : children) {
        if (child->gameObject->activeSelf) child->gameObject->SendActivation(active);
    }
}

void GameObject::Attach(Component* component) {
    component->gameObject = this;
    components.push_back(component);
    component->OnAdded();
    playground::MarkDirty();
}

void CanvasGroup::set_alpha(float value) {
    alpha = value;
    playground::MarkDirty();
}

void CanvasGroup::set_ignoreParentGroups(bool value) {
    ignoreParentGroups = value;
    playground::MarkDirty();
}

void CanvasGroup::set_blocksRaycasts(bool value) {
    blocksRaycasts = value;
    playground::MarkDirty();
}
}

namespace UnityEngine::UI {
void Graphic::set_color(Color value) {
    color = value;
    playground::MarkDirty();
}

void Graphic::set_material(Material* value) {
    material = value;
    playground::MarkDirty();
}

void Graphic::set_raycastTarget(bool value) {
    raycastTarget = value;
    playground::MarkDirty();
}

void Graphic::SetLayoutDirty() {
    playground::MarkDirty();
    auto callbacks = dirtyLayoutCallbacks;
    for (auto* callback : callbacks) callback->invoke();
}

void Image::set_sprite(Sprite* value) {
    sprite = value;
    SetLayoutDirty();
}

void Image::set_type(Type value) {
    type = value;
    playground::MarkDirty();
}

void Image::set_preserveAspect(bool value) {
    preserveAspect = value;
    playground::MarkDirty();
}

void Image::set_pixelsPerUnitMultiplier(float value) {
    pixelsPerUnitMultiplier = std::max(0.01f, value);
    playground::MarkDirty();
}
}

namespace HMUI {
void ImageView::set_color0(UnityEngine::Color value) {
    color0 = value;
    playground::MarkDirty();
}

void ImageView::set_color1(UnityEngine::Color value) {
    color1 = value;
    playground::MarkDirty();
}

void ImageView::set_gradient(bool value) {
    gradient = value;
    playground::MarkDirty();
}

void ImageView::__Refresh() {
    playground::MarkDirty();
}
}

namespace TMPro {
void TMP_Text::set_text(StringW value) {
    if (text == value.value) return;
    text = std::move(value.value);
    SetLayoutDirty();
}

void TMP_Text::set_fontSize(float value) {
    if (fontSize == value) return;
    fontSize = value;
    SetLayoutDirty();
}

void TMP_Text::set_fontSizeMin(float value) {
    fontSizeMin = value;
    SetLayoutDirty();
}

void TMP_Text::set_fontSizeMax(float value) {
    fontSizeMax = value;
    SetLayoutDirty();
}

void TMP_Text::set_fontStyle(FontStyles value) {
    if (fontStyle == value) return;
    fontStyle = value;
    SetLayoutDirty();
}

void TMP_Text::set_richText(bool value) {
    richText = value;
    SetLayoutDirty();
}

void TMP_Text::set_enableAutoSizing(bool value) {
    enableAutoSizing = value;
    SetLayoutDirty();
}

void TMP_Text::set_enableWordWrapping(bool value) {
    enableWordWrapping = value;
    SetLayoutDirty();
}

void TMP_Text::set_overflowMode(TextOverflowModes value) {
    overflowMode = value;
    playground::MarkDirty();
}

void TMP_Text::set_alignment(TextAlignmentOptions value) {
    alignment = value;
    playground::MarkDirty();
}

bool TMP_Text::HasRichText() const {
    return richText && text.find('<') != std::string::npos;
}

UnityEngine::Vector2 TMP_Text::GetPreferredValues() const {
    float size[2]{};
    js_measure_text(text.data(), static_cast<int>(text.size()), enableAutoSizing ? fontSizeMax : fontSize, static_cast<int>(fontStyle), HasRichText(), size);
    return {size[0], size[1]};
}

float TMP_Text::FittedFontSize(float width, float height) const {
    if (!enableAutoSizing) return fontSize;

    float unit[2]{};
    js_measure_text(text.data(), static_cast<int>(text.size()), 1.f, static_cast<int>(fontStyle), HasRichText(), unit);
    if (unit[0] <= 0.f || unit[1] <= 0.f) return fontSizeMax;

    return std::clamp(std::min(width / unit[0], height / unit[1]), fontSizeMin, fontSizeMax);
}
}

namespace UnityEngine::Networking {
UnityWebRequestAsyncOperation* UnityWebRequest::SendWebRequest() {
    operation = new UnityWebRequestAsyncOperation();
    g_requests[id] = this;
    js_fetch_image(id, texture->id, url.data(), static_cast<int>(url.size()));
    return operation;
}

UnityWebRequest* UnityWebRequestTexture::GetTexture(StringW url) {
    auto* request = new UnityWebRequest();
    request->id = g_nextRequestId++;
    request->url = std::move(url.value);
    request->texture = new Texture2D(0, 0);
    request->texture->external = true;
    return request;
}
}

extern "C" {
void __cxa_throw(void*, void*, void (*)(void*)) {
    playground::Log(0, "C++ exceptions aren't supported in this preview, because the browser toolchain has no unwinder");
    std::abort();
}

void* __cxa_allocate_exception(unsigned long size) {
    return std::malloc(size);
}
}
