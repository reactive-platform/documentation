#include <cstdlib>

#include "playground/Engine.hpp"
#include "reactive/IReactiveComponent.hpp"

#define JS_EXPORT(name) __attribute__((export_name(#name)))

extern "C" reactive::IReactiveComponent* playground_create_app();

extern "C" {
JS_EXPORT(quest_run) void quest_run() {
    playground::LoadResources();

    auto* app = playground_create_app();
    app->Use(playground::Root());

    auto* rect = app->ContentTransform();
    rect->set_anchorMin({0.f, 0.f});
    rect->set_anchorMax({1.f, 1.f});
    rect->set_sizeDelta({0.f, 0.f});
    rect->set_anchoredPosition({0.f, 0.f});
}

JS_EXPORT(quest_tick) void quest_tick(float deltaTime) {
    playground::Tick(deltaTime);
}

JS_EXPORT(quest_set_root_size) void quest_set_root_size(float width, float height) {
    playground::SetRootSize(width, height);
}

JS_EXPORT(quest_pointer) void quest_pointer(int kind, int id, float x, float y, float deltaY) {
    switch (kind) {
        case 0: playground::PointerMove(id, x, y); break;
        case 1: playground::PointerDown(id, x, y); break;
        case 2: playground::PointerUp(id, x, y); break;
        case 3: playground::PointerScroll(id, x, y, deltaY); break;
    }
}

JS_EXPORT(quest_request_finished) void quest_request_finished(int id, int succeeded, int status, int width, int height) {
    playground::RequestFinished(id, succeeded != 0, status, width, height);
}
}
