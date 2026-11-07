using System;
using System.Collections.Generic;
using System.Linq;
using Reactive;
using Reactive.BeatSaber;
using Reactive.BeatSaber.Components;
using Reactive.Compiler;
using Reactive.Components;
using Reactive.Yoga;
using TMPro;
using UnityEngine;
using Background = Reactive.BeatSaber.Components.Background;
using Label = Reactive.BeatSaber.Components.Label;

namespace DocsCapture;

/// <summary>
/// The custom layout controller samples. The controller and the first demo are the showcase's
/// LayoutStitchingExample; the other two show the ring inside flexbox and flexbox inside the ring.
/// </summary>
internal static class Samples3 {
    public static IReactiveComponent? Create(string name) {
        return name switch {
            "RadialShowcase" => new RadialShowcaseSample(),
            "RadialInFlex" => new RadialInFlexSample(),
            "FlexInRadial" => new FlexInRadialSample(),
            _ => null
        };
    }

    public static Label Number(int index, int count, float fontSize = 4f) {
        return new Label {
            Text = (index + 1).ToString(),
            FontSize = fontSize,
            Color = Color.HSVToRGB(index / (float)count, 0.6f, 1f)
        };
    }

    public static Background Block(Color color, float width, float height) {
        return new Background {
            FlexItem = {
                Size = new() { x = width.pt, y = height.pt }
            },

            Sprite = BeatSaberResources.Sprites.background,
            PixelsPerUnit = 10f,
            Color = color
        };
    }
}

/// <summary>
/// The showcase demo: a stitched flex panel next to a ring laid out by the radial controller, with a slider for the radius.
/// </summary>
internal class RadialShowcaseSample : ReactiveComponent {
    private const int ItemCount = 8;
    private const float MinRadius = 6f;
    private const float MaxRadius = 11f;

    private State<float> _radius = null!;
    private BsSlider _slider = null!;

    public float Radius {
        set {
            _radius.Value = value;
            _slider.Value = value;
        }
    }

    protected override GameObject Construct() {
        var radius = _radius = Remember(10f);
        var controller = new RadialLayoutController();

        radius.AddCallback(x => controller.Radius = x);

        var ring = new Layout {
            LayoutController = controller,

            FlexItem = {
                sSize = radius.Map(x => new YogaVector(RingSize(x).pt))
            },

            Children = {
                Samples3.Number(0, ItemCount),
                Samples3.Number(1, ItemCount),
                Samples3.Number(2, ItemCount),
                Samples3.Number(3, ItemCount),
                Samples3.Number(4, ItemCount),
                Samples3.Number(5, ItemCount),
                Samples3.Number(6, ItemCount),
                Samples3.Number(7, ItemCount)
            }
        };

        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Center,
                JustifyContent = Justify.Center,
                Gap = 2.pt
            },

            Children = {
                new BsSlider {
                    MinValue = MinRadius,
                    MaxValue = MaxRadius,
                    ValueStep = 1f,
                    Value = radius.Value,
                    ValueFormatter = x => $"radius {x:0}",
                    OnValueChanged = x => radius.Value = x
                }.Bind(ref _slider),

                new Layout {
                    FlexController = {
                        AlignItems = Align.FlexStart,
                        Gap = 4.pt
                    },

                    Children = {
                        CreatePanel(
                            "Stitched flex",
                            new Layout {
                                FlexController = {
                                    FlexDirection = FlexDirection.Column,
                                    Gap = 1.pt
                                },

                                Children = {
                                    CreateRow(new Color(0f, 0.75f, 1f)),
                                    CreateRow(new Color(1f, 0.2f, 0.8f)),
                                    CreateRow(new Color(1f, 0.8f, 0.2f))
                                }
                            }
                        ),

                        CreatePanel(
                            "Custom controller",
                            new Layout {
                                FlexController = {
                                    JustifyContent = Justify.Center,
                                    AlignItems = Align.Center
                                },

                                FlexItem = {
                                    Size = RingSize(MaxRadius).pt
                                },

                                Children = {
                                    ring
                                }
                            }
                        )
                    }
                }
            }
        }.Use();
    }

    private static float RingSize(float radius) => radius * 2f + 6f;

    private static Layout CreatePanel(string caption, ILayoutItem content) {
        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Center,
                Gap = 1.5f.pt
            },

            Children = {
                new Label {
                    Text = caption,
                    FontSize = 3.2f,
                    FontStyle = FontStyles.Bold,
                    Color = Color.white with { a = 0.7f }
                },

                content
            }
        };
    }

    private static Layout CreateRow(Color color) {
        return new Layout {
            FlexController = {
                Gap = 1.pt
            },

            Children = {
                Samples3.Block(color, 4f, 4f),
                Samples3.Block(color, 8f, 4f),
                Samples3.Block(color, 4f, 4f)
            }
        };
    }
}

/// <summary>
/// Rings without a fixed size in a flex row. The row measures each ring when it is inserted, so the row and
/// the blocks around it make room for it.
/// </summary>
internal class RadialInFlexSample : ReactiveComponent {
    private static readonly (float radius, int items)[] Rings = { (5f, 3), (8f, 6), (11f, 8) };

    private Layout _rings = null!;
    private readonly List<Background> _added = new();

    public int Stage {
        set {
            while (_added.Count > value) {
                var last = _added[_added.Count - 1];
                _added.RemoveAt(_added.Count - 1);
                _rings.Children.Remove(last);
                last.Destroy();
            }

            while (_added.Count < value) {
                var (radius, items) = Rings[_added.Count];
                var ring = CreateRing(radius, items);
                _added.Add(ring);
                _rings.Children.Add(ring);
            }
        }
    }

    protected override GameObject Construct() {
        return new Layout {
            FlexController = {
                AlignItems = Align.Center,
                JustifyContent = Justify.Center,
                Gap = 3.pt
            },

            Children = {
                Samples3.Block(new Color(0f, 0.75f, 1f), 12f, 12f),

                new Layout {
                    FlexController = {
                        AlignItems = Align.Center,
                        Gap = 3.pt
                    }
                }.Bind(ref _rings),

                Samples3.Block(new Color(1f, 0.2f, 0.8f), 12f, 12f)
            }
        }.Use();
    }

    private static Background CreateRing(float radius, int items) {
        var ring = new Background {
            LayoutController = new RadialLayoutController { Radius = radius },

            Sprite = BeatSaberResources.Sprites.background,
            PixelsPerUnit = 10f,
            Color = Color.white with { a = 0.1f }
        };

        for (var i = 0; i < items; i++) {
            ring.Children.Add(Samples3.Number(i, items));
        }

        return ring;
    }
}

/// <summary>
/// Flex cards on a ring. Each card is its own Yoga tree that the radial controller measures, so a card that
/// grows is re-measured and stays centred on its point of the circle.
/// </summary>
internal class FlexInRadialSample : ReactiveComponent {
    private const int ItemCount = 5;

    private static readonly string[] Captions = { "card", "a longer caption", "card" };

    private State<bool> _expanded = null!;
    private Label _caption = null!;

    public bool Expanded {
        set => _expanded.Value = value;
    }

    public int Caption {
        set => _caption.Text = Captions[value];
    }

    protected override GameObject Construct() {
        var expanded = _expanded = Remember(false);

        var ring = new Layout {
            LayoutController = new RadialLayoutController { Radius = 14f },

            FlexItem = {
                Size = 46.pt
            }
        };

        for (var i = 0; i < ItemCount; i++) {
            ring.Children.Add(CreateCard(i, expanded));
        }

        return new Layout {
            FlexController = {
                AlignItems = Align.Center,
                JustifyContent = Justify.Center
            },

            Children = {
                ring
            }
        }.Use();
    }

    [StateGen]
    private Background CreateCard(int index, IState<bool> expanded) {
        var caption = new Label {
            Text = Captions[0],
            FontSize = 2.4f,
            Color = Color.white with { a = 0.7f }
        };

        if (index == 0) {
            _caption = caption;
        }

        var card = new Background {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Center,
                Padding = new() { top = 1.pt, bottom = 1.pt, left = 2.pt, right = 2.pt },
                Gap = 0.5f.pt
            },

            Sprite = BeatSaberResources.Sprites.background,
            PixelsPerUnit = 10f,
            Color = Color.HSVToRGB(index / (float)ItemCount, 0.5f, 0.6f) with { a = 0.6f },

            Children = {
                Samples3.Number(index, ItemCount, 3.6f),
                caption
            }
        };

        if (index == 2) {
            card.Children.Add(
                new Label {
                    Text = "details",
                    FontSize = 2.4f,
                    Color = Color.white with { a = 0.7f },
                    sEnabled = expanded.In()
                }
            );
        }

        return card;
    }
}

/// <summary>
/// Places children evenly on a circle around the center of the box it's given. Copied from the showcase.
/// </summary>
internal class RadialLayoutController : ILayoutController {
    public float Radius {
        get => _radius;
        set {
            _radius = value;
            LayoutControllerUpdatedEvent?.Invoke();
        }
    }

    public int ChildCount => _children.Count;

    public event Action? LayoutControllerUpdatedEvent;

    private readonly List<ILayoutItem> _children = new();
    private readonly List<LayoutDimensions> _dimensions = new();
    private float _radius = 10f;
    private Vector2 _size;

    #region Context

    // No context type, so a parent never stitches this controller into its tree and measures it instead
    public Type? ContextType => null;

    public object CreateContext() => new object();

    public void ProvideContext(object? context) { }

    #endregion

    #region Children

    public void InsertChild(ILayoutItem child, int index) {
        _children.Insert(index, child);
        LayoutControllerUpdatedEvent?.Invoke();
    }

    public void RemoveChild(ILayoutItem child) {
        _children.RemoveAll(x => x.EqualsToLayoutItem(child));
        LayoutControllerUpdatedEvent?.Invoke();
    }

    public void RemoveAllChildren() {
        _children.Clear();
        LayoutControllerUpdatedEvent?.Invoke();
    }

    public bool HasChild(ILayoutItem child) {
        return _children.Exists(x => x.EqualsToLayoutItem(child));
    }

    public void UpdateChild(ILayoutItem item) { }

    public void UpdateSelf(ILayoutItem item) { }

    #endregion

    #region Calculation

    public void Recalculate(Vector2 constraints) {
        _dimensions.Clear();

        var largest = Vector2.zero;
        var sizes = new Vector2[_children.Count];

        for (var i = 0; i < _children.Count; i++) {
            sizes[i] = _children[i].Measure(float.NaN, Reactive.MeasureMode.Undefined, float.NaN, Reactive.MeasureMode.Undefined);
            largest = Vector2.Max(largest, sizes[i]);
        }

        var preferred = Vector2.one * (_radius * 2f) + largest;
        _size = constraints.x > 0f && constraints.y > 0f ? constraints : preferred;

        var center = _size / 2f;

        for (var i = 0; i < _children.Count; i++) {
            var angle = i / (float)_children.Count * Mathf.PI * 2f - Mathf.PI / 2f;
            var position = center + new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * _radius;
            var size = sizes[i];

            _dimensions.Add(new LayoutDimensions(position.y - size.y / 2f, position.x - size.x / 2f, size.x, size.y));
        }
    }

    public LayoutDimensions GetSelfDimensions() {
        return new LayoutDimensions(0f, 0f, _size.x, _size.y);
    }

    public LayoutDimensions GetChildDimensions(ILayoutItem child) {
        var index = _children.FindIndex(x => x.EqualsToLayoutItem(child));
        return index >= 0 && index < _dimensions.Count ? _dimensions[index] : default;
    }

    // How the flex parent asks this tree for its size when it isn't fixed
    public Vector2 Measure(float width, Reactive.MeasureMode widthMode, float height, Reactive.MeasureMode heightMode) {
        Recalculate(Vector2.zero);
        return LayoutTool.MeasureNode(_size, width, widthMode, height, heightMode);
    }

    #endregion
}
