#include <yoga/Yoga.h>

extern "C" {
void YGBridgeManagedMeasure(YGNodeConstRef node, float width, int widthMode, float height, int heightMode, float* outWidth, float* outHeight);

static YGSize Measure(YGNodeConstRef node, float width, YGMeasureMode widthMode, float height, YGMeasureMode heightMode) {
    YGSize size{};
    YGBridgeManagedMeasure(node, width, widthMode, height, heightMode, &size.width, &size.height);
    return size;
}

void YGBridgeSetMeasureEnabled(YGNodeRef node, int enabled) {
    YGNodeSetMeasureFunc(node, enabled ? Measure : nullptr);
}
}
