using System;
using UnityEngine;

namespace HMUI {
    public class ImageView : UnityEngine.UI.Image {
        public enum GradientDirection {
            Horizontal,
            Vertical
        }

        protected internal float _skew { get; set { field = value; PlaygroundEngine.MarkDirty(); } }
        protected internal GradientDirection _gradientDirection { get; set { field = value; PlaygroundEngine.MarkDirty(); } }

        public bool gradient { get; set { field = value; PlaygroundEngine.MarkDirty(); } }
        public Color color0 { get; set { field = value; PlaygroundEngine.MarkDirty(); } } = Color.white;
        public Color color1 { get; set { field = value; PlaygroundEngine.MarkDirty(); } } = Color.white;

        protected override float PixelsPerUnit => base.PixelsPerUnit * pixelsPerUnitMultiplier;

        protected void __Refresh() => PlaygroundEngine.MarkDirty();
    }

    public class CurvedTextMeshPro : TMPro.TextMeshProUGUI { }

    public class CurvedCanvasSettings : MonoBehaviour {
        public float radius => 0f;
    }
}

namespace VRUIControls {
    public class VRGraphicRaycaster : Behaviour {
        public struct VRGraphicRaycastResult {
            public UnityEngine.UI.Graphic graphic;
            public Vector2 insideRootCanvasPosition;
        }
    }
}

namespace HarmonyLib {
    public sealed class HarmonyPatch : Attribute {
        public HarmonyPatch(Type type, string method) { }
    }
}

public class Signal {
    public void Raise() { }
}
