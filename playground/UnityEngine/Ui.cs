using System;
using UnityEngine;
using UnityEngine.EventSystems;

namespace UnityEngine.EventSystems {
    public struct RaycastResult {
        public Vector3 worldPosition;
    }

    public class PointerEventData {
        public RaycastResult pointerCurrentRaycast => new() { worldPosition = position };

        public Vector2 position { get; set; }
        public Vector2 delta { get; set; }
        public Vector2 scrollDelta { get; set; }
    }

    public interface IPointerEnterHandler { void OnPointerEnter(PointerEventData eventData); }
    public interface IPointerExitHandler { void OnPointerExit(PointerEventData eventData); }
    public interface IPointerDownHandler { void OnPointerDown(PointerEventData eventData); }
    public interface IPointerUpHandler { void OnPointerUp(PointerEventData eventData); }
    public interface IPointerClickHandler { void OnPointerClick(PointerEventData eventData); }
    public interface IPointerMoveHandler { void OnPointerMove(PointerEventData eventData); }
    public interface IBeginDragHandler { void OnBeginDrag(PointerEventData eventData); }
    public interface IDragHandler { void OnDrag(PointerEventData eventData); }
    public interface IEndDragHandler { void OnEndDrag(PointerEventData eventData); }
    public interface IScrollHandler { void OnScroll(PointerEventData eventData); }

    public static class ExecuteEvents {
        public static Action<IScrollHandler, PointerEventData> scrollHandler { get; } =
            static (handler, data) => handler.OnScroll(data);

        public static bool Execute<T>(GameObject target, PointerEventData data, Action<T, PointerEventData> function) where T : class {
            var handled = false;
            foreach (var handler in target.GetComponents<T>()) {
                try {
                    function(handler, data);
                } catch (Exception e) {
                    Debug.LogException(e);
                }
                handled = true;
            }
            return handled;
        }

        public static GameObject? ExecuteHierarchy<T>(GameObject root, PointerEventData data, Action<T, PointerEventData> function) where T : class {
            for (var t = root.transform; t != null; t = t.parent) {
                if (Execute(t.gameObject, data, function)) return t.gameObject;
            }
            return null;
        }
    }
}

namespace UnityEngine.UI {
    [RequireComponent(typeof(RectTransform))]
    public class Graphic : MonoBehaviour {
        private Action? _dirtyLayout;

        public Color color { get; set { field = value; PlaygroundEngine.MarkDirty(); } } = Color.white;
        public Material? material { get; set { field = value; PlaygroundEngine.MarkDirty(); } }
        public bool raycastTarget { get; set { field = value; PlaygroundEngine.MarkDirty(); } } = true;

        public void RegisterDirtyLayoutCallback(Action action) => _dirtyLayout += action;

        protected void SetLayoutDirty() {
            PlaygroundEngine.MarkDirty();
            _dirtyLayout?.Invoke();
        }
    }

    public abstract class MaskableGraphic : Graphic { }

    public class Image : MaskableGraphic {
        public enum Type {
            Simple,
            Sliced,
            Tiled,
            Filled
        }

        public enum FillMethod {
            Horizontal,
            Vertical,
            Radial90,
            Radial180,
            Radial360
        }

        internal const float ReferencePixelsPerUnit = 10f;

        public Sprite? sprite { get; set { field = value; SetLayoutDirty(); } }
        public Type type { get; set { field = value; PlaygroundEngine.MarkDirty(); } }
        public FillMethod fillMethod { get; set { field = value; PlaygroundEngine.MarkDirty(); } } = FillMethod.Radial360;
        public float fillAmount { get; set { field = Mathf.Clamp01(value); PlaygroundEngine.MarkDirty(); } } = 1f;
        public bool preserveAspect { get; set { field = value; PlaygroundEngine.MarkDirty(); } }
        public float pixelsPerUnitMultiplier { get; set { field = Mathf.Max(0.01f, value); PlaygroundEngine.MarkDirty(); } } = 1f;
        public bool fillCenter { get; set { field = value; PlaygroundEngine.MarkDirty(); } } = true;

        protected virtual float PixelsPerUnit => sprite == null ? 1f : sprite.pixelsPerUnit / ReferencePixelsPerUnit;

        public float preferredWidth => sprite == null ? 0f : sprite.rect.width / PixelsPerUnit;
        public float preferredHeight => sprite == null ? 0f : sprite.rect.height / PixelsPerUnit;
    }

    public class RectMask2D : MonoBehaviour { }
}

namespace TMPro {
    [Flags]
    public enum FontStyles {
        Normal = 0,
        Bold = 1,
        Italic = 2,
        Underline = 4,
        LowerCase = 8,
        UpperCase = 16,
        Strikethrough = 64
    }

    public enum TextOverflowModes {
        Overflow,
        Ellipsis,
        Masking,
        Truncate
    }

    public enum TextAlignmentOptions {
        TopLeft = 257,
        Top = 258,
        TopRight = 260,
        Left = 513,
        Center = 514,
        Right = 516,
        BottomLeft = 1025,
        Bottom = 1026,
        BottomRight = 1028,
        BaselineLeft = 2049,
        Baseline = 2050,
        BaselineRight = 2052,
        MidlineLeft = 4097,
        Midline = 4098,
        MidlineRight = 4100,
        CaplineLeft = 8193,
        Capline = 8194,
        CaplineRight = 8196
    }

    public class TMP_FontAsset : UnityEngine.Object { }

    public abstract class TMP_Text : UnityEngine.UI.MaskableGraphic {
        public string text {
            get;
            set {
                if (field == value) return;
                field = value ?? string.Empty;
                SetLayoutDirty();
            }
        } = string.Empty;

        public float fontSize {
            get;
            set {
                if (field == value) return;
                field = value;
                SetLayoutDirty();
            }
        } = 36f;

        public FontStyles fontStyle {
            get;
            set {
                if (field == value) return;
                field = value;
                SetLayoutDirty();
            }
        }

        public bool richText { get; set { field = value; SetLayoutDirty(); } } = true;
        public bool enableWordWrapping { get; set { field = value; SetLayoutDirty(); } } = true;
        public TextAlignmentOptions alignment { get; set { field = value; PlaygroundEngine.MarkDirty(); } } = TextAlignmentOptions.TopLeft;
        public TextOverflowModes overflowMode { get; set { field = value; PlaygroundEngine.MarkDirty(); } }
        public float fontSizeMin { get; set { field = value; SetLayoutDirty(); } } = 18f;
        public float fontSizeMax { get; set { field = value; SetLayoutDirty(); } } = 72f;
        public bool enableAutoSizing { get; set { field = value; SetLayoutDirty(); } }

        public TMP_FontAsset? font { get; set; }
        public Material? fontSharedMaterial { get; set; }

        internal bool HasRichText => richText && text.Contains('<');

        internal float FittedFontSize(float width, float height) {
            if (!enableAutoSizing) return fontSize;

            var unit = PlaygroundEngine.MeasureText(text, 1f, fontStyle, HasRichText);
            if (unit.x <= 0f || unit.y <= 0f) return fontSizeMax;

            return Mathf.Clamp(Mathf.Min(width / unit.x, height / unit.y), fontSizeMin, fontSizeMax);
        }

        public Vector2 GetPreferredValues() {
            return PlaygroundEngine.MeasureText(text, enableAutoSizing ? fontSizeMax : fontSize, fontStyle, HasRichText);
        }

        /// <summary>The size of the text laid out within the width. The height doesn't change how text wraps, so it's unused.</summary>
        public Vector2 GetPreferredValues(float width, float height) {
            var wrapWidth = enableWordWrapping && !float.IsInfinity(width) ? width : 0f;
            return PlaygroundEngine.MeasureText(text, enableAutoSizing ? fontSizeMax : fontSize, fontStyle, HasRichText, wrapWidth);
        }
    }

    public class TextMeshProUGUI : TMP_Text { }
}
