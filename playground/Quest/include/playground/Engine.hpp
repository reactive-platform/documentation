#pragma once

#include <coroutine>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <vector>

struct StringW {
    std::string value;

    StringW() = default;
    StringW(std::string v) : value(std::move(v)) {}
    StringW(std::string_view v) : value(v) {}
    StringW(char const* v) : value(v ? v : "") {}

    explicit operator std::string() const { return value; }
};

template <class T>
class UnityW {
public:
    UnityW(T* ptr = nullptr) : _ptr(ptr) {}

    T* unsafePtr() const { return _ptr; }
    T* ptr() const { return _ptr; }
    T* operator->() const { return _ptr; }
    operator T*() const { return _ptr; }
    explicit operator bool() const { return _ptr && !_ptr->destroyed; }

private:
    T* _ptr;
};

template <class T>
using SafePtrUnity = UnityW<T>;

template <class T>
using SafePtr = UnityW<T>;

namespace System {
template <class T>
struct Action_1 {
    std::function<void(T)> invoke;
};
}

namespace System::Collections {
struct IEnumerator {
    virtual ~IEnumerator() = default;
};
}

namespace GlobalNamespace {
struct IVRPlatformHelper;
}

namespace custom_types {
template <class TDelegate, class TFunction>
TDelegate MakeDelegate(TFunction function) {
    return new std::remove_pointer_t<TDelegate>{std::move(function)};
}
}

namespace custom_types::Helpers {
class Coroutine {
public:
    struct promise_type {
        System::Collections::IEnumerator* current{nullptr};

        Coroutine get_return_object() { return Coroutine(std::coroutine_handle<promise_type>::from_promise(*this)); }
        std::suspend_always initial_suspend() noexcept { return {}; }
        std::suspend_always final_suspend() noexcept { return {}; }
        std::suspend_always yield_value(System::Collections::IEnumerator* value) noexcept {
            current = value;
            return {};
        }
        void return_void() {}
        void unhandled_exception() {}
    };

    explicit Coroutine(std::coroutine_handle<promise_type> handle) : _handle(handle) {}
    Coroutine(Coroutine&& other) noexcept : _handle(std::exchange(other._handle, nullptr)) {}
    ~Coroutine() {
        if (_handle) _handle.destroy();
    }

    std::coroutine_handle<promise_type> Handle() const { return _handle; }

private:
    std::coroutine_handle<promise_type> _handle;
};

struct CoroutineHelper : System::Collections::IEnumerator {
    explicit CoroutineHelper(Coroutine routine) : coroutine(std::move(routine)) {}

    Coroutine coroutine;

    static System::Collections::IEnumerator* New(Coroutine routine) { return new CoroutineHelper(std::move(routine)); }
};
}

namespace UnityEngine {
struct Vector2 {
    float x{};
    float y{};

    static bool op_Equality(Vector2 a, Vector2 b) {
        const float dx = a.x - b.x;
        const float dy = a.y - b.y;
        return dx * dx + dy * dy < 9.99999944e-11f;
    }

    static Vector2 Lerp(Vector2 a, Vector2 b, float t) {
        t = t < 0.f ? 0.f : (t > 1.f ? 1.f : t);
        return {a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t};
    }
};

struct Vector3 {
    float x{};
    float y{};
    float z{};
};

struct Vector4 {
    float x{};
    float y{};
    float z{};
    float w{};
};

struct Rect {
    float m_XMin{};
    float m_YMin{};
    float m_Width{};
    float m_Height{};
};

struct Color {
    float r{};
    float g{};
    float b{};
    float a{};

    static constexpr Color get_white() { return {1.f, 1.f, 1.f, 1.f}; }
    static constexpr Color get_black() { return {0.f, 0.f, 0.f, 1.f}; }
    static constexpr Color get_red() { return {1.f, 0.f, 0.f, 1.f}; }
    static constexpr Color get_green() { return {0.f, 1.f, 0.f, 1.f}; }
    static constexpr Color get_blue() { return {0.f, 0.f, 1.f, 1.f}; }
    static constexpr Color get_clear() { return {0.f, 0.f, 0.f, 0.f}; }
};

enum class HideFlags {
    None = 0,
    DontUnloadUnusedAsset = 32,
};

enum class SpriteMeshType {
    FullRect,
    Tight,
};

struct Time {
    static float get_time();
    static float get_deltaTime();
};

struct Debug {
    static void Log(StringW message);
    static void LogWarning(StringW message);
    static void LogError(StringW message);
};

struct Object {
    virtual ~Object() = default;

    std::string name;
    HideFlags hideFlags{HideFlags::None};
    bool destroyed{false};

    virtual StringW get_name() { return name; }
    virtual void set_name(StringW value) { name = std::move(value.value); }
    void set_hideFlags(HideFlags value) { hideFlags = value; }

    static void Destroy(Object* object);
};

struct ScriptableObject : Object {};

struct Material : Object {
    Color color{1.f, 1.f, 1.f, 1.f};
};

struct Texture2D : Object {
    int id;
    int width;
    int height;
    int version{1};
    int uploadedVersion{0};
    bool external{false};
    std::vector<uint8_t> pixels;
    uint8_t const* encoded{nullptr};
    int encodedLength{0};

    Texture2D(int width, int height);

    int get_width() const { return width; }
    int get_height() const { return height; }
};

struct Sprite : Object {
    Texture2D* texture{nullptr};
    Rect rect{};
    Vector4 border{};
    float pixelsPerUnit{100.f};

    static Sprite* Create(Texture2D* texture, Rect rect, Vector2 pivot, float pixelsPerUnit, uint32_t extrude, SpriteMeshType meshType, Vector4 border, bool generateFallback);
};

struct GameObject;
struct Transform;
struct RectTransform;

struct Component : Object {
    GameObject* gameObject{nullptr};

    StringW get_name() override;
    void set_name(StringW value) override;

    GameObject* get_gameObject() const { return gameObject; }
    Transform* get_transform() const;

    template <class T>
    T GetComponent() const;

    virtual void OnAdded() {}
    virtual void OnObjectActivated() {}
    virtual void OnObjectDeactivated() {}
    virtual void OnDestroying() {}
};

struct Behaviour : Component {
    bool enabled{true};

    bool get_enabled() const { return enabled; }
    void set_enabled(bool value);
    bool get_isActiveAndEnabled() const;

    virtual void OnEnabledChanged() {}
};

struct WaitForSeconds : System::Collections::IEnumerator {
    explicit WaitForSeconds(float value) : seconds(value) {}

    float seconds;

    static WaitForSeconds* New_ctor(float seconds) { return new WaitForSeconds(seconds); }
};

struct WaitForEndOfFrame : System::Collections::IEnumerator {
    static WaitForEndOfFrame* New_ctor() { return new WaitForEndOfFrame(); }
};

struct Coroutine {
    explicit Coroutine(System::Collections::IEnumerator* routine) { stack.push_back(routine); }

    std::vector<System::Collections::IEnumerator*> stack;
    float waitUntil{0.f};
    bool finished{false};
};

struct MonoBehaviour : Behaviour {
    std::vector<Coroutine*> coroutines;
    bool awoken{false};
    bool enabledFired{false};
    bool started{false};

    virtual void Awake() {}
    virtual void Start() {}
    virtual void Update() {}
    virtual void LateUpdate() {}
    virtual void OnEnable() {}
    virtual void OnDisable() {}
    virtual void OnDestroy() {}
    virtual void OnRectTransformDimensionsChange() {}

    void OnAdded() override;
    void OnObjectActivated() override;
    void OnObjectDeactivated() override;
    void OnEnabledChanged() override;
    void OnDestroying() override;

    Coroutine* StartCoroutine(System::Collections::IEnumerator* routine);
    void StopAllCoroutines();
};

struct Transform : Component {
    Transform* parent{nullptr};
    std::vector<Transform*> children;
    Vector3 localScale{1.f, 1.f, 1.f};
    Vector3 localEulerAngles{};
    Vector3 localPosition{};

    Transform* get_parent() const { return parent; }
    int get_childCount() const { return static_cast<int>(children.size()); }
    Transform* GetChild(int index) const { return children[index]; }

    virtual Vector3 get_localPosition() const { return localPosition; }
    virtual void set_localPosition(Vector3 value);
    Vector3 get_localScale() const { return localScale; }
    void set_localScale(Vector3 value);
    Vector3 get_localEulerAngles() const { return localEulerAngles; }
    void set_localEulerAngles(Vector3 value);

    Vector3 get_position() const;
    Vector3 get_lossyScale() const;
    Vector3 InverseTransformPoint(Vector3 point) const;

    void SetParent(Transform* newParent, bool worldPositionStays = true);

    virtual void AfterParentChanged() {}
};

struct RectTransform : Transform {
    enum class Axis { Horizontal, Vertical };
    enum class Edge { Left, Right, Top, Bottom };

    Vector2 anchorMin{0.5f, 0.5f};
    Vector2 anchorMax{0.5f, 0.5f};
    Vector2 pivot{0.5f, 0.5f};
    Vector2 anchoredPosition{};
    Vector2 sizeDelta{100.f, 100.f};
    Vector2 lastSize{100.f, 100.f};

    Vector2 get_anchorMin() const { return anchorMin; }
    void set_anchorMin(Vector2 value);
    Vector2 get_anchorMax() const { return anchorMax; }
    void set_anchorMax(Vector2 value);
    Vector2 get_pivot() const { return pivot; }
    void set_pivot(Vector2 value);
    Vector2 get_anchoredPosition() const { return anchoredPosition; }
    void set_anchoredPosition(Vector2 value);
    Vector2 get_sizeDelta() const { return sizeDelta; }
    void set_sizeDelta(Vector2 value);
    Vector2 get_offsetMin() const;
    void set_offsetMin(Vector2 value);
    Vector2 get_offsetMax() const;
    void set_offsetMax(Vector2 value);
    Rect get_rect() const;

    Vector3 get_localPosition() const override;
    void set_localPosition(Vector3 value) override;

    void SetInsetAndSizeFromParentEdge(Edge edge, float inset, float size);
    void SetSizeWithCurrentAnchors(Axis axis, float size);

    void AfterParentChanged() override { CheckDimensions(); }

    void CheckDimensions();
    Vector2 ParentSize() const;
};

struct GameObject : Object {
    int id;
    RectTransform* transform;
    std::vector<Component*> components;
    bool activeSelf{true};

    GameObject();

    static GameObject* New_ctor() { return new GameObject(); }
    static GameObject* New_ctor(StringW name);

    RectTransform* get_transform() const { return transform; }
    bool get_activeSelf() const { return activeSelf; }
    bool get_activeInHierarchy() const;
    void SetActive(bool value);

    template <class T>
    T AddComponent() {
        using TComponent = std::remove_pointer_t<T>;
        if constexpr (std::is_same_v<TComponent, RectTransform>) {
            return transform;
        } else {
            auto* component = new TComponent();
            if constexpr (requires { component->ctor(); }) component->ctor();
            Attach(component);
            return component;
        }
    }

    template <class T>
    T GetComponent() const {
        for (auto* component : components) {
            if (auto* match = dynamic_cast<T>(component); match && !component->destroyed) return match;
        }
        return nullptr;
    }

    void RefreshActivation(bool wasActive);

private:
    void Attach(Component* component);
    void SendActivation(bool active);
};

template <class T>
T Component::GetComponent() const {
    return gameObject->GetComponent<T>();
}

struct CanvasGroup : Behaviour {
    float alpha{1.f};
    bool ignoreParentGroups{false};
    bool blocksRaycasts{true};

    float get_alpha() const { return alpha; }
    void set_alpha(float value);
    void set_ignoreParentGroups(bool value);
    void set_blocksRaycasts(bool value);
};

struct AsyncOperation : Object {
    std::vector<System::Action_1<AsyncOperation*>*> completed;

    void add_completed(System::Action_1<AsyncOperation*>* action) { completed.push_back(action); }
};

struct AssetBundle : Object {};
}

namespace UnityEngine::Events {
struct UnityAction {
    std::function<void()> invoke;
};
}

namespace UnityEngine::EventSystems {
struct EventSystem {
    static EventSystem* get_current() { return nullptr; }
};

struct PointerEventData {
    Vector2 position{};
    Vector2 delta{};
    Vector2 scrollDelta{};

    static PointerEventData* New_ctor(EventSystem*) { return new PointerEventData(); }

    Vector2 get_position() const { return position; }
    Vector2 get_delta() const { return delta; }
    Vector2 get_scrollDelta() const { return scrollDelta; }
    void set_scrollDelta(Vector2 value) { scrollDelta = value; }
};

#define PLAYGROUND_EVENT_HANDLER(Interface, Method)            \
    struct Interface {                                         \
        virtual ~Interface() = default;                        \
        virtual void Method(PointerEventData* eventData) = 0;  \
    };

PLAYGROUND_EVENT_HANDLER(IPointerDownHandler, OnPointerDown)
PLAYGROUND_EVENT_HANDLER(IPointerUpHandler, OnPointerUp)
PLAYGROUND_EVENT_HANDLER(IPointerEnterHandler, OnPointerEnter)
PLAYGROUND_EVENT_HANDLER(IPointerExitHandler, OnPointerExit)
PLAYGROUND_EVENT_HANDLER(IDragHandler, OnDrag)
PLAYGROUND_EVENT_HANDLER(IBeginDragHandler, OnBeginDrag)
PLAYGROUND_EVENT_HANDLER(IEndDragHandler, OnEndDrag)
PLAYGROUND_EVENT_HANDLER(IScrollHandler, OnScroll)

#undef PLAYGROUND_EVENT_HANDLER

struct ExecuteEvents {
    template <class THandler>
    using Function = void (*)(THandler*, PointerEventData*);

    static Function<IScrollHandler> get_scrollHandler() {
        return [](IScrollHandler* handler, PointerEventData* data) { handler->OnScroll(data); };
    }

    template <class T>
    static bool Execute(GameObject* target, PointerEventData* data, Function<std::remove_pointer_t<T>> function) {
        bool handled = false;
        auto components = target->components;
        for (auto* component : components) {
            auto* behaviour = dynamic_cast<Behaviour*>(component);
            if (!behaviour || !behaviour->get_isActiveAndEnabled()) continue;
            if (auto* handler = dynamic_cast<T>(component)) {
                function(handler, data);
                handled = true;
            }
        }
        return handled;
    }

    template <class T>
    static GameObject* ExecuteHierarchy(GameObject* target, PointerEventData* data, Function<std::remove_pointer_t<T>> function) {
        for (Transform* transform = target->transform; transform; transform = transform->parent) {
            if (Execute<T>(transform->gameObject, data, function)) return transform->gameObject;
        }
        return nullptr;
    }
};
}

namespace UnityEngine::UI {
struct Graphic : MonoBehaviour {
    Color color{1.f, 1.f, 1.f, 1.f};
    Material* material{nullptr};
    bool raycastTarget{true};
    std::vector<Events::UnityAction*> dirtyLayoutCallbacks;

    Color get_color() const { return color; }
    void set_color(Color value);
    Material* get_material() const { return material; }
    void set_material(Material* value);
    bool get_raycastTarget() const { return raycastTarget; }
    void set_raycastTarget(bool value);
    void RegisterDirtyLayoutCallback(Events::UnityAction* action) { dirtyLayoutCallbacks.push_back(action); }

protected:
    void SetLayoutDirty();
};

struct Image : Graphic {
    enum class Type { Simple, Sliced, Tiled, Filled };

    static constexpr float ReferencePixelsPerUnit = 10.f;

    Sprite* sprite{nullptr};
    Type type{Type::Simple};
    bool preserveAspect{false};
    float pixelsPerUnitMultiplier{1.f};

    Sprite* get_sprite() const { return sprite; }
    void set_sprite(Sprite* value);
    void set_type(Type value);
    void set_preserveAspect(bool value);
    void set_pixelsPerUnitMultiplier(float value);
};

struct RectMask2D : MonoBehaviour {};
}

namespace HMUI {
struct ImageView : UnityEngine::UI::Image {
    enum class GradientDirection { Horizontal, Vertical };

    float _skew{0.f};
    bool gradient{false};
    GradientDirection _gradientDirection{GradientDirection::Horizontal};
    UnityEngine::Color color0{1.f, 1.f, 1.f, 1.f};
    UnityEngine::Color color1{1.f, 1.f, 1.f, 1.f};

    void set_color0(UnityEngine::Color value);
    void set_color1(UnityEngine::Color value);
    void set_gradient(bool value);
    void __Refresh();
};
}

namespace TMPro {
enum class FontStyles {
    Normal = 0,
    Bold = 1,
    Italic = 2,
    Underline = 4,
    LowerCase = 8,
    UpperCase = 16,
    Strikethrough = 64,
};

enum class TextOverflowModes {
    Overflow,
    Ellipsis,
    Masking,
    Truncate,
};

enum class TextAlignmentOptions {
    TopLeft = 257,
    Top = 258,
    TopRight = 260,
    Left = 513,
    Center = 514,
    Right = 516,
    Justified = 520,
    BottomLeft = 1025,
    Bottom = 1026,
    BottomRight = 1028,
};

struct TMP_FontAsset : UnityEngine::Object {};

struct TMP_Text : UnityEngine::UI::Graphic {
    std::string text;
    float fontSize{36.f};
    float fontSizeMin{18.f};
    float fontSizeMax{72.f};
    FontStyles fontStyle{FontStyles::Normal};
    bool richText{true};
    bool enableAutoSizing{false};
    bool enableWordWrapping{true};
    TextOverflowModes overflowMode{TextOverflowModes::Overflow};
    TextAlignmentOptions alignment{TextAlignmentOptions::TopLeft};

    StringW get_text() const { return text; }
    void set_text(StringW value);
    void set_font(TMP_FontAsset*) {}
    void set_fontSharedMaterial(UnityEngine::Material*) {}
    void set_fontSize(float value);
    void set_fontSizeMin(float value);
    void set_fontSizeMax(float value);
    void set_fontStyle(FontStyles value);
    void set_richText(bool value);
    void set_enableAutoSizing(bool value);
    void set_enableWordWrapping(bool value);
    void set_overflowMode(TextOverflowModes value);
    void set_alignment(TextAlignmentOptions value);

    UnityEngine::Vector2 GetPreferredValues() const;

    bool HasRichText() const;
    float FittedFontSize(float width, float height) const;
};
}

namespace HMUI {
struct CurvedTextMeshPro : TMPro::TMP_Text {};
}

namespace UnityEngine::Networking {
struct UnityWebRequest;

struct UnityWebRequestAsyncOperation : AsyncOperation {};

struct UnityWebRequest : Object {
    enum class Result { InProgress, Success, ConnectionError, ProtocolError, DataProcessingError };

    int id{0};
    std::string url;
    Result result{Result::InProgress};
    std::string error;
    Texture2D* texture{nullptr};
    UnityWebRequestAsyncOperation* operation{nullptr};

    UnityWebRequestAsyncOperation* SendWebRequest();
    Result get_result() const { return result; }
    StringW get_error() const { return error; }
    void Dispose() {}
};

struct UnityWebRequestTexture {
    static UnityWebRequest* GetTexture(StringW url);
};

struct DownloadHandlerTexture {
    static UnityW<Texture2D> GetContent(UnityWebRequest* request) { return request->texture; }
};
}

namespace playground {
void MarkDirty();
UnityEngine::RectTransform* Root();
void Tick(float deltaTime);
void SetRootSize(float width, float height);
void PointerMove(int id, float x, float y);
void PointerDown(int id, float x, float y);
void PointerUp(int id, float x, float y);
void PointerScroll(int id, float x, float y, float deltaY);
void RequestFinished(int id, bool succeeded, int status, int width, int height);
void LoadResources();
void Log(int level, std::string_view message);
}

namespace playground::detail {
template <class... TInterfaces>
struct Interfaces : std::remove_pointer_t<TInterfaces>... {};
}

#define DECLARE_CLASS_CODEGEN(nameSpace, className, baseClass) \
    namespace nameSpace { struct className; }                  \
    struct nameSpace::className : public baseClass

#define DECLARE_CLASS_CODEGEN_INTERFACES(nameSpace, className, baseClass, ...) \
    namespace nameSpace { struct className; }                                  \
    struct nameSpace::className : public baseClass, public ::playground::detail::Interfaces<__VA_ARGS__>

#define DECLARE_INSTANCE_FIELD(type, name) type name {}
#define DECLARE_INSTANCE_METHOD(returnType, name, ...) returnType name(__VA_ARGS__)
#define DECLARE_OVERRIDE_METHOD(returnType, name, baseMethod, ...) returnType name(__VA_ARGS__) override
#define DECLARE_CTOR(name) void name()
#define DEFINE_TYPE(nameSpace, className)
#define INVOKE_CTOR()
