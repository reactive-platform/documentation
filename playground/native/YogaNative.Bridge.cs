using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace Reactive.Yoga {
    internal static partial class YogaNative {
        private static readonly Dictionary<IntPtr, YGMeasureFunc> measureFuncs = new();

        [DllImport(YogaDllName)]
        private static extern void YGBridgeSetMeasureEnabled(IntPtr node, int enabled);

        public static void YGConfigSetLogger(IntPtr ptr, YogaLoggerDelegate? logger) { }

        public static void YGNodeSetMeasureFunc(IntPtr node, YGMeasureFunc? measureFunc) {
            if (measureFunc == null) {
                measureFuncs.Remove(node);
            } else {
                measureFuncs[node] = measureFunc;
            }

            YGBridgeSetMeasureEnabled(node, measureFunc == null ? 0 : 1);
        }

        [UnmanagedCallersOnly(EntryPoint = "YGBridgeManagedMeasure")]
        private static unsafe void ManagedMeasure(IntPtr node, float width, int widthMode, float height, int heightMode, float* outWidth, float* outHeight) {
            if (!measureFuncs.TryGetValue(node, out var func)) return;

            var size = func(node, width, (MeasureMode)widthMode, height, (MeasureMode)heightMode);
            *outWidth = size.width;
            *outHeight = size.height;
        }
    }
}
