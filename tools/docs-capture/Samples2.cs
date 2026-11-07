using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Reactive;
using Reactive.BeatSaber;
using Reactive.BeatSaber.Components;
using Reactive.Compiler;
using Reactive.Components;
using Reactive.Components.Basic;
using AnimationCurve = Reactive.AnimationCurve;
using Reactive.Yoga;
using TMPro;
using UnityEngine;
using Background = Reactive.BeatSaber.Components.Background;
using Image = Reactive.BeatSaber.Components.Image;
using Label = Reactive.BeatSaber.Components.Label;
using ScrollArea = Reactive.BeatSaber.Components.ScrollArea;
using UImage = UnityEngine.UI.Image;

namespace DocsCapture;

internal static class Samples2 {
    public static readonly Color Primary = new(0.35f, 0.75f, 1f);
    public static readonly Color Secondary = new(1f, 0.55f, 0.75f);

    public static IReactiveComponent? Create(string name) {
        return name switch {
            "Buttons" => new ButtonsSample(),
            "ButtonContent" => new ButtonContentSample(),
            "PrimaryButtons" => new PrimaryButtonsSample(),
            "PrimaryLoading" => new PrimaryLoadingSample(),
            "AeroButtons" => new AeroButtonsSample(),
            "Toggle" => new ToggleSample(),
            "Slider" => new SliderSample(),
            "SegmentedControl" => new SegmentedControlSample(),
            "KeyedContainer" => new KeyedContainerSample(),
            "Dropdown" => new DropdownSample(),
            "ListControl" => new ListControlSample(),
            "InputField" => new InputFieldSample(),
            "ColorPicker" => new ColorPickerSample(),
            "ColorCircle" => new ColorCircleSample(),
            "Modal" => new ModalSample(),
            "Dialog" => new DialogSample(),
            "Gradient" => new GradientSample(),
            "Fills" => new FillsSample(),
            "LabelsStyles" => new LabelsStylesSample(),
            "LabelsRich" => new LabelsRichSample(),
            "LabelsAutosize" => new LabelsAutosizeSample(),
            "ScrollArea" => new ScrollAreaSample(),
            "Repeater" => new RepeaterSample(),
            "Selection" => new SelectionSample(),
            "Table" => new TableSample(),
            "AnimatedState" => new AnimatedStateSample(),
            "Timing" => new TimingSample(),
            "Curves" => new CurvesSample(),
            "Interpolators" => new InterpolatorsSample(),
            _ => null
        };
    }

    public static Layout Row(float gap = 2f, params ILayoutItem[] children) {
        var layout = new Layout {
            FlexController = {
                AlignItems = Align.Center,
                JustifyContent = Justify.Center,
                Gap = gap.pt
            }
        };
        foreach (var child in children) layout.Children.Add(child);
        return layout;
    }

    public static Layout Column(float gap = 2f, params ILayoutItem[] children) {
        var layout = new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Center,
                JustifyContent = Justify.Center,
                Gap = gap.pt
            }
        };
        foreach (var child in children) layout.Children.Add(child);
        return layout;
    }
}

#region Buttons

internal class ButtonsSample : ReactiveComponent {
    protected override GameObject Construct() {
        var interactable = Remember(false);

        return Samples2.Row(2f,
            new BsTextButton { Text = "Stock" },
            new BsTextButton { Text = "Themed" },
            new BsTextButton { Text = "Plain", ShowUnderline = false },
            new BsTextButton { Text = "Straight", Skew = 0f },
            new BsTextButton { Text = "Maybe", sInteractable = interactable },

            new BsImageButton {
                FlexItem = {
                    Size = 8.pt
                },

                Sprite = GameResources.EditIcon,
                sInteractable = interactable
            }
        ).Use();
    }
}

internal class ButtonContentSample : ReactiveComponent {
    protected override GameObject Construct() {
        var clicks = Remember(3);

        return Samples2.Row(2f,
            new BsButton {
                FlexController = {
                    Padding = new() { left = 2.pt, right = 2.pt },
                    AlignItems = Align.Center,
                    Gap = 1.pt
                },

                OnClick = () => clicks.Value++,

                ConstructContent = (color, skew) => new Layout {
                    FlexController = {
                        AlignItems = Align.Center,
                        Gap = 1.pt
                    },

                    Children = {
                        new Image {
                            FlexItem = {
                                Size = 4.pt
                            },

                            Sprite = GameResources.ArrowUpIcon,
                            PreserveAspect = true,
                            sColor = color.In(),
                            sSkew = skew.In()
                        },

                        new Label {
                            sText = clicks.Map(x => $"Clicked {x} times"),
                            sColor = color.In()
                        }
                    }
                }
            }
        ).Use();
    }
}

internal class PrimaryButtonsSample : ReactiveComponent {
    protected override GameObject Construct() {
        var interactable = Remember(false);

        return Samples2.Row(2f,
            new BsPrimaryTextButton { Text = "Play" },
            new BsPrimaryTextButton { Text = "Straight", Skew = 0f },
            new BsPrimaryTextButton { Text = "Maybe", sInteractable = interactable },

            new BsPrimaryImageButton {
                FlexItem = {
                    Size = 8.pt
                },

                Sprite = GameResources.SearchIcon,
                PreserveAspect = true
            }
        ).Use();
    }
}

internal class PrimaryLoadingSample : ReactiveComponent {
    private enum Phase { Idle, Loading, Done }

    private State<Phase> _phase = null!;

    public void Run() {
        StartCoroutine(RunFakeTask());
    }

    private IEnumerator RunFakeTask() {
        _phase.Value = Phase.Loading;
        yield return new WaitForSeconds(1.4f);
        _phase.Value = Phase.Done;
        yield return new WaitForSeconds(1f);
        _phase.Value = Phase.Idle;
    }

    protected override GameObject Construct() {
        var phase = _phase = Remember(Phase.Idle);

        return Samples2.Row(2f,
            new BsPrimaryButton {
                FlexItem = {
                    Size = new() { x = 36.pt, y = 8.pt }
                },

                FlexController = {
                    JustifyContent = Justify.Center,
                    AlignItems = Align.Center,
                    Gap = 1.pt
                },

                sInteractable = phase.Map(x => x == Phase.Idle),
                OnClick = Run,

                ConstructContent = (color, _) => new Layout {
                    FlexController = {
                        AlignItems = Align.Center,
                        Gap = 1.pt
                    },

                    Children = {
                        new Spinner {
                            FlexItem = {
                                Size = 4.pt
                            },

                            sEnabled = phase.Map(x => x == Phase.Loading),
                            Image = {
                                sColor = color.In()
                            }
                        },

                        new Label {
                            sText = phase.Map(x => x switch { Phase.Loading => "Loading", Phase.Done => "Done", _ => "Run" }),
                            sColor = color.In()
                        }
                    }
                }
            }
        ).Use();
    }
}

internal class AeroButtonsSample : ReactiveComponent {
    protected override GameObject Construct() {
        var column = new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Stretch,
                JustifyContent = Justify.Center,
                Gap = 1.pt
            },

            FlexItem = {
                Size = new() { x = 40.pt }
            },

            Children = {
                CreateIconButton(GameResources.EditIcon, "Edit"),
                CreateIconButton(GameResources.SearchIcon, "Search"),
                CreateIconButton(GameResources.CloseIcon, "Close")
            }
        };

        return Samples2.Row(0f, column).Use();
    }

    [StateGen]
    private static BsAeroButton CreateIconButton(Sprite icon, string text) {
        return new BsAeroButton {
            FlexController = {
                Padding = new() { left = 2.pt, right = 2.pt },
                AlignItems = Align.Center,
                Gap = 1.pt
            },

            FlexItem = {
                Size = new() { y = 8.pt }
            },

            ConstructContent = (color, skew) => new Layout {
                FlexItem = {
                    Size = new() { y = 100.pct },
                    FlexShrink = 1f
                },

                FlexController = {
                    AlignItems = Align.Center,
                    Gap = 1.pt
                },

                Children = {
                    new Image {
                        FlexItem = {
                            Size = new() { y = 55.pct },
                            AspectRatio = 1f
                        },

                        Sprite = icon,
                        PreserveAspect = true,
                        sColor = color.In(),
                        sSkew = skew.In()
                    },

                    new Label {
                        FlexItem = {
                            FlexShrink = 1f
                        },

                        Text = text,
                        EnableWrapping = false,
                        Overflow = TextOverflowModes.Ellipsis,
                        sFontStyle = skew.Map(x => x > 0 ? FontStyles.Italic : FontStyles.Normal),
                        sColor = color.In()
                    }
                }
            }
        };
    }
}

#endregion

#region Controls

internal class ToggleSample : ReactiveComponent {
    protected override GameObject Construct() {
        return Samples2.Row(3f,
            new BsToggle(),
            new BsToggle { Toggled = true },
            new BsToggle { Animated = false },
            new BsToggle { Interactable = false },
            new BsToggle { Toggled = true, Interactable = false }
        ).Use();
    }
}

internal class SliderSample : ReactiveComponent {
    protected override GameObject Construct() {
        var interactable = Remember(false);

        return Samples2.Column(2f,
            new BsSlider {
                FlexItem = { Size = new() { x = 50.pt, y = 7.pt } },
                ValueStep = 0.01f,
                Value = 0.5f,
                ValueFormatter = x => $"{x * 100f:0}%"
            },

            new BsSlider {
                FlexItem = { Size = new() { x = 50.pt, y = 7.pt } },
                MinValue = 0f,
                MaxValue = 10f,
                ValueStep = 1f,
                Value = 3f,
                ShowButtons = false
            },

            new BsSlider {
                FlexItem = { Size = new() { x = 50.pt, y = 7.pt } },
                ValueStep = 0.05f,
                Value = 0.25f,
                ShowValueText = false
            },

            new BsSlider {
                FlexItem = { Size = new() { x = 50.pt, y = 7.pt } },
                sInteractable = interactable,
                MinValue = -5f,
                MaxValue = 5f,
                ValueStep = 0.5f,
                Value = 1.5f,
                ValueFormatter = x => x.ToString("+0.0;-0.0;0")
            }
        ).Use();
    }
}

internal class SegmentedControlSample : ReactiveComponent {
    protected override GameObject Construct() {
        return Samples2.Row(6f,
            new BsSegmentedControl<int> {
                FlexController = {
                    FlexDirection = FlexDirection.Column,
                    Gap = 0.5f.pt
                },

                FlexItem = {
                    Size = new() { x = 24.pt, y = 24.pt }
                },

                Key = 0,
                Items = new Dictionary<int, BsSegmentedControlItem> {
                    [0] = new("Edit", GameResources.EditIcon),
                    [1] = new("Search", GameResources.SearchIcon),
                    [2] = new("Close", GameResources.CloseIcon)
                }
            },

            new BsSegmentedControl<int> {
                FlexItem = {
                    Size = new() { x = 30.pt, y = 7.pt }
                },

                Key = 0,
                Items = new Dictionary<int, BsSegmentedControlItem> {
                    [0] = new(null, GameResources.ArrowIcon),
                    [1] = new(null, GameResources.CircleIcon),
                    [2] = new(null, GameResources.CaretIcon)
                }
            }
        ).Use();
    }
}

internal class KeyedContainerSample : ReactiveComponent {
    private enum Page { Buttons, Toggle, Slider }

    protected override GameObject Construct() {
        var page = Remember(Page.Toggle);

        return new Layout {
            FlexController = {
                AlignItems = Align.Stretch,
                JustifyContent = Justify.Center,
                Gap = 2.pt
            },

            FlexItem = {
                Size = new() { x = 90.pt, y = 40.pt }
            },

            Children = {
                new BsSegmentedControl<Page> {
                    FlexController = {
                        FlexDirection = FlexDirection.Column,
                        Gap = 0.5f.pt
                    },

                    FlexItem = {
                        Size = new() { x = 22.pt }
                    },

                    Items = new Dictionary<Page, BsSegmentedControlItem> {
                        [Page.Buttons] = new("Buttons", null),
                        [Page.Toggle] = new("Toggle", null),
                        [Page.Slider] = new("Slider", null)
                    },
                    Key = page.Value,
                    OnKeyChanged = x => page.Value = x
                },

                new KeyedContainer<Page> {
                    FlexController = {
                        AlignItems = Align.Stretch
                    },

                    FlexItem = {
                        Flex = 1
                    },

                    sKey = page,
                    Views = new Dictionary<Page, IReactiveComponent> {
                        [Page.Buttons] = CreatePage("Buttons page", new BsTextButton { Text = "A button" }),
                        [Page.Toggle] = CreatePage("Toggle page", new BsToggle { Toggled = true }),
                        [Page.Slider] = CreatePage("Slider page", new BsSlider { FlexItem = { Size = new() { x = 40.pt, y = 7.pt } }, Value = 0.4f })
                    }
                }
            }
        }.Use();
    }

    private static Background CreatePage(string title, ILayoutItem content) {
        return new Background {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Center,
                JustifyContent = Justify.Center,
                Gap = 2.pt,
                Padding = 2.pt
            },

            FlexItem = {
                Flex = 1
            },

            Sprite = BeatSaberResources.Sprites.background,
            PixelsPerUnit = 10f,
            Color = Color.white with { a = 0.1f },

            Children = {
                new Label { Text = title, FontSize = 4f, FontStyle = FontStyles.Bold },
                content
            }
        };
    }
}

internal class DropdownSample : ReactiveComponent {
    protected override GameObject Construct() {
        var interactable = Remember(true);

        return Samples2.Row(20f,
            new BsDropdown<int> {
                FlexItem = { Size = new() { x = 40.pt, y = 7.pt } },
                sInteractable = interactable,
                Key = 1,
                Items = new Dictionary<int, BsDropdownItem> {
                    [0] = new("Edit", GameResources.EditIcon),
                    [1] = new("Search", GameResources.SearchIcon),
                    [2] = new("Close", GameResources.CloseIcon),
                    [3] = new("Arrow", GameResources.ArrowIcon)
                }
            },

            new BsDropdown<int> {
                FlexItem = { Size = new() { x = 40.pt, y = 7.pt } },
                sInteractable = interactable,
                ModalParams = new() { MaxVisibleRows = 3 },
                Key = 0,
                Items = CreateNumbered(12)
            }
        ).Use();
    }

    private static Dictionary<int, BsDropdownItem> CreateNumbered(int count) {
        var items = new Dictionary<int, BsDropdownItem>();
        for (var i = 0; i < count; i++) {
            items[i] = new($"Item {i + 1}", null);
        }
        return items;
    }
}

internal class ListControlSample : ReactiveComponent {
    protected override GameObject Construct() {
        var interactable = Remember(true);
        var difficultyItems = new BsListControlItem<string>[] {
            new("Easy", "Easy", null),
            new("Normal", "Normal", null),
            new("Hard", "Hard", null),
            new("Expert", "Expert", null),
            new("Expert+", "Expert+", null)
        };

        return Samples2.Column(2f,
            new BsListControl<string> {
                FlexItem = { Size = new() { x = 50.pt, y = 7.pt } },
                sInteractable = interactable,
                Items = difficultyItems,
                Key = "Expert"
            },

            new BsListControl<int> {
                FlexItem = { Size = new() { x = 50.pt, y = 7.pt } },
                sInteractable = interactable,
                Items = [
                    new(0, "Edit", GameResources.EditIcon),
                    new(1, "Search", GameResources.SearchIcon),
                    new(2, "Close", GameResources.CloseIcon)
                ],
                Key = 0
            },

            new BsListControl<string> {
                FlexItem = { Size = new() { x = 50.pt, y = 7.pt } },
                Skew = 0f,
                Items = difficultyItems,
                Key = "Normal"
            }
        ).Use();
    }
}

internal class InputFieldSample : ReactiveComponent {
    protected override GameObject Construct() {
        var interactable = Remember(true);
        var searchContext = new BsInputFieldContext();
        var searchAnchor = Ref<RectTransform>();

        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.FlexStart,
                JustifyContent = Justify.FlexStart,
                Gap = 2.pt,
                Padding = 4.pt
            },

            Children = {
                new BsInputField {
                    FlexItem = {
                        Size = new() { x = 50.pt, y = 8.pt }
                    },

                    Context = searchContext,
                    Placeholder = "Search songs",
                    Icon = GameResources.SearchIcon,
                    sInteractable = interactable
                }.Bind(searchAnchor),

                new Label {
                    Alignment = TextAlignmentOptions.Left,
                    sText = searchContext.Map(x => x.Focused ? "Typing..." : $"Query: {(string.IsNullOrEmpty(x.Text) ? "-" : x.Text)}")
                },

                new BsKeyboardModal {
                    Context = searchContext,
                    PlacementAnchor = searchAnchor
                }
            }
        }.Use();
    }
}

internal class ColorPickerSample : ReactiveComponent {
    protected override GameObject Construct() {
        var pickerContext = new BsColorPickerContext { SelectedColor = Color.cyan };
        var pickerAnchor = Ref<RectTransform>();

        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.FlexStart,
                JustifyContent = Justify.FlexStart,
                Gap = 2.pt,
                Padding = 4.pt
            },

            Children = {
                new BsColorPicker {
                    Context = pickerContext
                }.Bind(pickerAnchor),

                new Label {
                    FlexItem = {
                        Margin = new() { top = 34.pt }
                    },

                    Alignment = TextAlignmentOptions.Left,
                    sText = pickerContext.Map(x => $"Live: {Format(x.Color)}\nSelected: {Format(x.SelectedColor)}\nFocused: {x.Focused}")
                },

                new BsColorCircleModal {
                    Context = pickerContext,
                    PlacementAnchor = pickerAnchor,
                    Title = "Pick a color",
                    PlacementData = new() {
                        Placement = RelativePlacement.RightCenter,
                        Offset = new(2f, 0f)
                    }
                }
            }
        }.Use();
    }

    private static string Format(Color color) => $"#{ColorUtility.ToHtmlStringRGB(color)}";
}

internal class ColorCircleSample : ReactiveComponent {
    private State<Color> _live = null!;
    private State<Color> _saved = null!;
    private BsColorCircle _circle = null!;

    public Color Live {
        set {
            _live.Value = value;
            _circle.Color = value;
        }
    }

    public Color Saved {
        set => _saved.Value = value;
    }

    protected override GameObject Construct() {
        var live = _live = Remember(new Color(1f, 0.45f, 0.2f));
        var saved = _saved = Remember(Color.cyan);

        return Samples2.Column(3f,
            new BsColorCircle {
                FlexItem = {
                    Size = 32.pt
                },

                Color = live.Value,
                OnColorUpdated = x => live.Value = x,
                OnColorSaved = x => saved.Value = x
            }.Bind(ref _circle),

            new Background {
                FlexItem = {
                    Size = new() { x = 32.pt, y = 4.pt }
                },

                Sprite = BeatSaberResources.Sprites.background,
                PixelsPerUnit = 10f,
                Color = Color.white,
                UseGradient = true,
                GradientDirection = HMUI.ImageView.GradientDirection.Horizontal,
                sGradientColor0 = live,
                sGradientColor1 = saved
            }
        ).Use();
    }
}

#endregion

#region Modals

internal class ModalSample : ReactiveComponent {
    protected override GameObject Construct() {
        var opened = Remember(false);
        var anchor = Ref<RectTransform>();

        return new Layout {
            FlexController = {
                AlignItems = Align.Center,
                JustifyContent = Justify.Center
            },

            Children = {
                new BsPrimaryTextButton {
                    Text = "Open",
                    OnClick = () => opened.Value = true
                }.Bind(anchor),

                new Modal {
                    sIsPushed = opened,
                    PlacementAnchor = anchor,
                    PlacementData = new() { Placement = RelativePlacement.RightCenter, Offset = new(2f, 0f) },
                    OnClickOutside = () => opened.Value = false,

                    Children = {
                        new Background {
                            FlexController = {
                                FlexDirection = FlexDirection.Column,
                                AlignItems = Align.Center,
                                Padding = 3.pt,
                                Gap = 2.pt
                            },

                            FlexItem = {
                                MinSize = new() { x = 50.pt }
                            },

                            Children = {
                                new Label { Text = "A modal" },

                                new BsTextButton {
                                    Text = "Close",
                                    OnClick = () => opened.Value = false
                                }
                            }
                        }.AsBlurBackground()
                    }
                }
            }
        }.Use();
    }
}

internal class DialogSample : ReactiveComponent {
    protected override GameObject Construct() {
        var dialogOpened = Remember(false);
        var dialogAnchor = Ref<RectTransform>();

        return new Layout {
            FlexController = {
                AlignItems = Align.Center,
                JustifyContent = Justify.Center
            },

            Children = {
                new BsPrimaryTextButton {
                    Text = "Delete",
                    OnClick = () => dialogOpened.Value = true
                }.Bind(dialogAnchor),

                new Dialog {
                    Title = "Careful",
                    sIsPushed = dialogOpened,
                    PlacementAnchor = dialogAnchor,
                    OnClickOutside = () => dialogOpened.Value = false,

                    FlexController = {
                        Padding = 3.pt
                    },

                    Children = {
                        new Label {
                            Text = "This would delete everything.",
                            FontSize = 3.5f
                        }
                    }
                }.With(x => {
                    x.OkButton.OnClick = () => dialogOpened.Value = false;
                    x.CancelButton.OnClick = () => dialogOpened.Value = false;
                })
            }
        }.Use();
    }
}

#endregion

#region Images and labels

internal class GradientSample : ReactiveComponent {
    private AnimatedState<Color> _from = null!;
    private AnimatedState<Color> _to = null!;

    public void Swap() {
        (_from.TargetValue, _to.TargetValue) = (_to.TargetValue, _from.TargetValue);
    }

    protected override GameObject Construct() {
        _from = RememberAnimated(Samples2.Primary, 900.ms, AnimationCurve.EaseInOutSine);
        _to = RememberAnimated(Samples2.Secondary, 900.ms, AnimationCurve.EaseInOutSine);

        return Samples2.Row(4f,
            CreateBox(HMUI.ImageView.GradientDirection.Horizontal),
            CreateBox(HMUI.ImageView.GradientDirection.Vertical)
        ).Use();
    }

    [StateGen]
    private Background CreateBox(HMUI.ImageView.GradientDirection direction) {
        return new Background {
            FlexItem = {
                Size = new() { x = 24.pt, y = 12.pt }
            },

            Sprite = BeatSaberResources.Sprites.background,
            PixelsPerUnit = 8f,
            Color = Color.white,
            UseGradient = true,
            GradientDirection = direction,
            sGradientColor0 = _from,
            sGradientColor1 = _to
        };
    }
}

internal class FillsSample : ReactiveComponent {
    private AnimatedState<float> _fill = null!;

    public float Fill {
        set => _fill.TargetValue = value;
    }

    protected override GameObject Construct() {
        var fill = _fill = RememberAnimated(0.65f, 900.ms, AnimationCurve.EaseInOutSine);

        return Samples2.Row(4f,
            new Image {
                FlexItem = { Size = 10.pt },
                Sprite = GameResources.CircleIcon,
                ImageType = UImage.Type.Filled,
                FillMethod = UImage.FillMethod.Radial360,
                sFillAmount = fill,
                Color = Samples2.Primary
            },

            new Image {
                FlexItem = { Size = new() { x = 24.pt, y = 6.pt } },
                Sprite = BeatSaberResources.Sprites.background,
                PixelsPerUnit = 10f,
                ImageType = UImage.Type.Filled,
                FillMethod = UImage.FillMethod.Horizontal,
                sFillAmount = fill,
                Color = Samples2.Primary
            },

            new Image {
                FlexItem = { Size = new() { x = 6.pt, y = 14.pt } },
                Sprite = BeatSaberResources.Sprites.background,
                PixelsPerUnit = 10f,
                ImageType = UImage.Type.Filled,
                FillMethod = UImage.FillMethod.Vertical,
                sFillAmount = fill,
                Color = Samples2.Primary
            }
        ).Use();
    }
}

internal class LabelsStylesSample : ReactiveComponent {
    protected override GameObject Construct() {
        return Samples2.Row(3f,
            new Label { Text = "Bold", FontStyle = FontStyles.Bold },
            new Label { Text = "Italic", FontStyle = FontStyles.Italic },
            new Label { Text = "Underline", FontStyle = FontStyles.Underline },
            new Label { Text = "Strike", FontStyle = FontStyles.Strikethrough },
            new Label { Text = "Small caps", FontStyle = FontStyles.SmallCaps },
            new Label { Text = "upper", FontStyle = FontStyles.UpperCase }
        ).Use();
    }
}

internal class LabelsRichSample : ReactiveComponent {
    protected override GameObject Construct() {
        return Samples2.Row(0f,
            new Label {
                RichText = true,
                FontSize = 4f,
                Text = $"Rich text with <color=#{ColorUtility.ToHtmlStringRGB(Samples2.Primary)}>primary</color>, " +
                    "<size=150%>big</size> and <alpha=#66>faded<alpha=#FF> parts"
            }
        ).Use();
    }
}

internal class LabelsAutosizeSample : ReactiveComponent {
    private AnimatedState<float> _width = null!;

    public float Width {
        set => _width.TargetValue = value;
    }

    protected override GameObject Construct() {
        _width = RememberAnimated(40f, 1500.ms, AnimationCurve.EaseInOutSine);

        return Samples2.Row(3f,
            new Background {
                FlexItem = {
                    sSize = _width.Map(x => new YogaVector(x.pt, 10.pt))
                },

                FlexController = {
                    JustifyContent = Justify.Center,
                    AlignItems = Align.Center,
                    Padding = 1.pt
                },

                Sprite = BeatSaberResources.Sprites.background,
                PixelsPerUnit = 10f,
                Color = Color.white with { a = 0.12f },

                Children = {
                    new Label {
                        FlexItem = {
                            Flex = 1f,
                            Size = new() { y = 100.pct }
                        },

                        Text = "Squeeze me",
                        EnableAutoSizing = true,
                        FontSizeMin = 1.5f,
                        FontSizeMax = 7f,
                        EnableWrapping = false
                    }
                }
            }
        ).Use();
    }
}

internal class ScrollAreaSample : ReactiveComponent {
    public ScrollContext Context { get; } = new();

    protected override GameObject Construct() {
        var content = new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Stretch,
                ConstrainVertical = false,
                Gap = 2.pt
            }
        };

        for (var i = 1; i <= 14; i++) {
            content.Children.Add(new Background {
                FlexController = {
                    AlignItems = Align.Center,
                    Padding = new() { left = 3.pt, right = 3.pt, top = 2.pt, bottom = 2.pt }
                },

                Sprite = BeatSaberResources.Sprites.background,
                PixelsPerUnit = 10f,
                Color = Color.white with { a = 0.1f },

                Children = {
                    new Label { Text = $"Setting {i}", Alignment = TextAlignmentOptions.Left, FlexItem = { Flex = 1 } },
                    new BsToggle { Toggled = i % 3 != 0 }
                }
            });
        }

        return new Layout {
            FlexController = {
                AlignItems = Align.Stretch,
                JustifyContent = Justify.Center,
                Gap = 1.pt
            },

            Children = {
                new ScrollArea {
                    FlexItem = {
                        Size = new() { x = 70.pt, y = 50.pt }
                    },

                    ScrollContext = Context,
                    ScrollContent = content
                },

                new Scrollbar {
                    FlexItem = {
                        Margin = new() { top = 9.pt }
                    },

                    ScrollContext = Context
                }
            }
        }.Use();
    }
}

#endregion

#region Lists

internal class RepeaterSample : ReactiveComponent {
    protected override GameObject Construct() {
        var names = Remember<IReadOnlyList<string>>(["Ada", "Linus", "Grace", "Dennis"]);
        var next = 0;
        string[] pool = ["Margaret", "Alan", "Barbara", "Ken"];

        return Samples2.Column(3f,
            new Repeater<string, Label> {
                FlexController = {
                    FlexDirection = FlexDirection.Column,
                    AlignItems = Align.FlexStart,
                    Gap = 0.5f.pt
                },

                sItems = names,

                ConstructCell = context => new Label {
                    Alignment = TextAlignmentOptions.Left,
                    sText = context.Map(x => $"{x.Index + 1}. {x.Item}")
                }
            },

            Samples2.Row(2f,
                new BsTextButton {
                    Text = "Add",
                    OnClick = () => names.Value = [..names.Value, pool[next++ % pool.Length]]
                },

                new BsTextButton {
                    Text = "Remove",
                    OnClick = () => names.Value = names.Value.Take(Math.Max(names.Value.Count - 1, 0)).ToArray()
                }
            )
        ).Use();
    }
}

internal class SelectionSample : ReactiveComponent {
    private Repeater<string, Background> _repeater = null!;

    protected override GameObject Construct() {
        var selectedColor = Samples2.Primary;
        var difficulties = new[] { "Easy", "Normal", "Hard", "Expert", "Expert+" };
        var selection = Remember<IReadOnlyCollection<string>>(Array.Empty<string>());

        return Samples2.Column(3f,
            new Repeater<string, Background> {
                FlexController = {
                    Gap = 1.pt
                },

                Items = difficulties,
                SelectionMode = SelectionMode.Multiple,
                OnSelectedItemsChanged = x => selection.Value = x.ToArray(),

                ConstructCell = context => new Background {
                    FlexController = {
                        Padding = new() { left = 2.pt, right = 2.pt, top = 1.pt, bottom = 1.pt }
                    },

                    Sprite = BeatSaberResources.Sprites.background,
                    PixelsPerUnit = 10f,
                    sColor = context.Map(x => x.Selected ? selectedColor : Color.white with { a = 0.12f }),
                    Do = x => x.WithPointerEvents(onDown: _ => context.Selected = !context.Selected),

                    Children = {
                        new Label {
                            sText = context.Map(x => x.Item),
                            sColor = context.Map(x => x.Selected ? Color.black : Color.white)
                        }
                    }
                }
            }.Bind(ref _repeater),

            new Label {
                Color = Color.white with { a = 0.6f },
                sText = selection.Map(x => x.Count == 0 ? "Nothing selected" : $"Selected: {string.Join(", ", x)}")
            }
        ).Use();
    }

    protected override void OnStart() {
        _repeater.SelectedItems = ["Hard", "Expert"];
    }
}

internal class TableSample : ReactiveComponent {
    private class Cell : ReactiveComponent {
        public Cell(CellContext<int> context) : base(false) {
            _context = context;
            ConstructAndInit();
        }

        private readonly CellContext<int> _context;

        protected override GameObject Construct() {
            return new Background {
                FlexController = {
                    AlignItems = Align.Center,
                    Padding = new() { left = 2.pt, right = 2.pt }
                },

                FlexItem = {
                    Size = new() { y = 6.pt }
                },

                Sprite = BeatSaberResources.Sprites.background,
                PixelsPerUnit = 10f,
                sColor = _context.Map(x => x.Selected ? Samples2.Primary : Color.white with { a = x.Index % 2 == 0 ? 0.08f : 0.14f }),
                Do = x => x.WithPointerEvents(onDown: _ => _context.Selected = true),

                Children = {
                    new Label {
                        Alignment = TextAlignmentOptions.Left,
                        sText = _context.Map(x => $"Row {x.Item + 1}"),
                        sColor = _context.Map(x => x.Selected ? Color.black : Color.white)
                    }
                }
            }.Use();
        }
    }

    public ScrollContext Context { get; } = new();

    protected override GameObject Construct() {
        var rows = Enumerable.Range(0, 10000).ToArray();

        return new Layout {
            FlexController = {
                AlignItems = Align.Stretch,
                JustifyContent = Justify.Center,
                Gap = 1.pt
            },

            Children = {
                new Table<int, Cell> {
                    FlexItem = {
                        Size = new() { x = 60.pt, y = 50.pt }
                    },

                    ScrollContext = Context,
                    Items = rows,
                    SelectionMode = SelectionMode.Single,
                    ConstructCell = x => new Cell(x)
                },

                new Scrollbar {
                    ScrollContext = Context
                }
            }
        }.Use();
    }
}

#endregion

#region Animation

internal class AnimatedStateSample : ReactiveComponent {
    protected override GameObject Construct() {
        var idle = Color.white with { a = 0.12f };
        var hovered = Samples2.Primary with { a = 0.5f };
        var color = RememberAnimated(idle, 250.ms, AnimationCurve.EaseOutCubic);
        var scale = RememberAnimated(1f, 300.ms, AnimationCurve.EaseOutBack);

        var card = new Background {
                FlexController = {
                    AlignItems = Align.Center,
                    JustifyContent = Justify.Center
                },

                FlexItem = {
                    Size = new() { x = 36.pt, y = 14.pt }
                },

                ContentTransform = {
                    slocalScale = scale.Map(x => Vector3.one * x)
                },

                Sprite = BeatSaberResources.Sprites.background,
                PixelsPerUnit = 10f,
                sColor = color,

                Do = x => x.WithPointerEvents(
                    onEnter: _ => {
                        color.TargetValue = hovered;
                        scale.TargetValue = 1.15f;
                    },
                    onLeave: _ => {
                        color.TargetValue = idle;
                        scale.TargetValue = 1f;
                    }
                ),

                Children = {
                    new Label { Text = "Hover me", FontSize = 4f }
                }
            };

        return Samples2.Row(0f, card).Use();
    }
}

internal class TimingSample : ReactiveComponent {
    private const float TrackWidth = 60f;
    private const float DotSize = 5f;

    private State<float> _target = null!;

    public float Target {
        get => _target.Value;
        set => _target.Value = value;
    }

    protected override GameObject Construct() {
        _target = Remember(0f);
        var timed = RememberAnimated(0f, 400.ms, AnimationCurve.EaseInOutCubic);
        var factored = RememberAnimated(0f, 8.fact);

        _target.AddCallback(x => {
            timed.TargetValue = x;
            factored.TargetValue = x;
        });

        return Samples2.Column(2f,
            CreateTrack("400.ms", timed),
            CreateTrack("8.fact", factored),

            new BsSlider {
                FlexItem = {
                    Size = new() { x = TrackWidth.pt, y = 7.pt },
                    Margin = new() { top = 2.pt }
                },

                ValueStep = 0.01f,
                sValue = _target,
                OnValueChanged = x => _target.Value = x
            }
        ).Use();
    }

    [StateGen]
    private static Layout CreateTrack(string name, IState<float> progress) {
        return new Layout {
            FlexController = {
                AlignItems = Align.Center,
                Gap = 2.pt
            },

            Children = {
                new Label {
                    FlexItem = { Size = new() { x = 14.pt } },
                    Alignment = TextAlignmentOptions.Right,
                    FontSize = 3.2f,
                    Text = name,
                    Color = Color.white with { a = 0.6f }
                },

                new Background {
                    FlexController = {
                        AlignItems = Align.Center
                    },

                    FlexItem = {
                        Size = new() { x = TrackWidth.pt, y = DotSize.pt }
                    },

                    Sprite = BeatSaberResources.Sprites.background,
                    PixelsPerUnit = 10f,
                    Color = Color.white with { a = 0.1f },

                    Children = {
                        new Image {
                            FlexItem = {
                                PositionType = PositionType.Absolute,
                                Size = DotSize.pt,
                                sPosition = progress.Map(x => new YogaFrame { left = (x * (TrackWidth - DotSize)).pt, top = 0.pt }).In()
                            },

                            Sprite = GameResources.CircleIcon,
                            PreserveAspect = true,
                            Color = Samples2.Primary
                        }
                    }
                }
            }
        };
    }
}

internal class CurvesSample : ReactiveComponent {
    private const float TrackWidth = 60f;
    private const float DotSize = 4f;

    private readonly List<AnimatedState<float>> _dots = new();

    public void Play() {
        foreach (var dot in _dots) {
            dot.TargetValue = dot.TargetValue < 0.5f ? 1f : 0f;
        }
    }

    protected override GameObject Construct() {
        var layout = new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Center,
                JustifyContent = Justify.Center,
                Gap = 1.5f.pt
            }
        };

        (string, AnimationCurve)[] curves = [
            ("Linear", AnimationCurve.Linear),
            ("EaseInQuad", AnimationCurve.EaseInQuad),
            ("EaseOutCubic", AnimationCurve.EaseOutCubic),
            ("EaseInOutSine", AnimationCurve.EaseInOutSine),
            ("EaseOutBack", AnimationCurve.EaseOutBack)
        ];

        foreach (var (name, curve) in curves) {
            var dot = RememberAnimated(0f, 1000.ms, curve);
            _dots.Add(dot);
            layout.Children.Add(CreateTrack(name, dot));
        }

        return layout.Use();
    }

    [StateGen]
    private static Layout CreateTrack(string name, IState<float> progress) {
        return new Layout {
            FlexController = {
                AlignItems = Align.Center,
                Gap = 2.pt
            },

            Children = {
                new Label {
                    FlexItem = { Size = new() { x = 22.pt } },
                    Alignment = TextAlignmentOptions.Right,
                    FontSize = 3f,
                    Text = name,
                    Color = Color.white with { a = 0.6f }
                },

                new Background {
                    FlexController = {
                        AlignItems = Align.Center
                    },

                    FlexItem = {
                        Size = new() { x = TrackWidth.pt, y = DotSize.pt }
                    },

                    Sprite = BeatSaberResources.Sprites.background,
                    PixelsPerUnit = 10f,
                    Color = Color.white with { a = 0.1f },

                    Children = {
                        new Image {
                            FlexItem = {
                                PositionType = PositionType.Absolute,
                                Size = DotSize.pt,
                                sPosition = progress.Map(x => new YogaFrame { left = (x * (TrackWidth - DotSize)).pt, top = 0.pt }).In()
                            },

                            Sprite = GameResources.CircleIcon,
                            PreserveAspect = true,
                            Color = Samples2.Primary
                        }
                    }
                }
            }
        };
    }
}

internal class HsvInterpolator : IValueInterpolator<Color> {
    public static readonly HsvInterpolator Instance = new();

    public Color Lerp(Color from, Color to, float t) {
        Color.RGBToHSV(from, out var h1, out var s1, out var v1);
        Color.RGBToHSV(to, out var h2, out var s2, out var v2);

        var hueDelta = Mathf.Repeat(h2 - h1 + 0.5f, 1f) - 0.5f;

        return Color.HSVToRGB(
            Mathf.Repeat(h1 + hueDelta * t, 1f),
            Mathf.Lerp(s1, s2, t),
            Mathf.Lerp(v1, v2, t)
        );
    }

    public bool Equals(Color x, Color y) => x == y;

    public int GetHashCode(Color obj) => obj.GetHashCode();
}

internal class InterpolatorsSample : ReactiveComponent {
    private AnimatedState<Color> _rgb = null!;
    private AnimatedState<Color> _hsv = null!;

    public void Play() {
        var target = _rgb.TargetValue == Color.red ? Color.cyan : Color.red;
        _rgb.TargetValue = target;
        _hsv.TargetValue = target;
    }

    protected override GameObject Construct() {
        _rgb = RememberAnimated(Color.red, 600.ms);
        _hsv = RememberAnimated(Color.red, HsvInterpolator.Instance, 600.ms);

        return Samples2.Row(4f,
            CreateSwatch("RGB", _rgb),
            CreateSwatch("HSV", _hsv)
        ).Use();
    }

    [StateGen]
    private static Layout CreateSwatch(string name, IState<Color> color) {
        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Center,
                Gap = 1.pt
            },

            Children = {
                new Background {
                    FlexItem = {
                        Size = new() { x = 24.pt, y = 14.pt }
                    },

                    Sprite = BeatSaberResources.Sprites.background,
                    PixelsPerUnit = 10f,
                    sColor = color.In()
                },

                new Label { Text = name, FontSize = 3f, Color = Color.white with { a = 0.6f } }
            }
        };
    }
}

#endregion
