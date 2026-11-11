using System;
using System.Collections.Generic;
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
/// The samples shown in the docs, built from the docs' own code.
/// </summary>
internal static class Samples {
    public static IReactiveComponent Create(string name) {
        return name switch {
            "Hello" => new HelloLabelDemo(),
            "Counter" => new Counter(),
            "Settings" => new Settings(),
            "Composing" => new Composing(),
            "Containers1" => new Containers(false),
            "Containers2" => new Containers(true),
            "FlexItems" => new FlexItems(),
            "RootSizes" => new RootSizes(),
            "Roots" => new Roots(),
            "Visibility" => new Visibility(),
            "WebImages" => new WebImages(),
            _ => Samples2.Create(name) ?? Samples3.Create(name) ?? throw new ArgumentException($"no sample {name}")
        };
    }
}

internal class HelloLabelDemo : ReactiveComponent {
    protected override GameObject Construct() {
        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Center,
                JustifyContent = Justify.Center,
                Gap = 1.pt
            },

            Children = {
                new Label {
                    Text = "Hello, Reactive!",
                    FontSize = 7f,
                    FontStyle = FontStyles.Bold
                },

                new Label {
                    Text = "Built once, in Construct",
                    FontSize = 3.5f,
                    Color = Color.white with { a = 0.6f }
                }
            }
        }.Use();
    }
}

internal class Counter : ReactiveComponent {
    protected override GameObject Construct() {
        var count = Remember(0);

        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Center,
                JustifyContent = Justify.Center,
                Gap = 2.pt
            },

            Children = {
                new Label {
                    FontSize = 9f,
                    sText = count.Map(x => x.ToString())
                },

                new BsPrimaryTextButton {
                    Text = "+1",
                    OnClick = () => count.Value++
                }
            }
        }.Use();
    }
}

internal class Settings : ReactiveComponent {
    private State<float> _volume = null!;
    private State<string> _language = null!;
    private BsDropdown<string> _dropdown = null!;

    public float Volume {
        set => _volume.Value = value;
    }

    public string Language {
        set {
            _language.Value = value;
            _dropdown.Key = value;
        }
    }

    protected override GameObject Construct() {
        var menuButton = Remember(true);
        var volume = _volume = Remember(70f);
        var language = _language = Remember("default");

        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                JustifyContent = Justify.Center,
                Gap = 1.pt,
                Padding = new() { left = 25.pt, right = 25.pt }
            },

            Children = {
                new BsToggle {
                    sToggled = menuButton,
                    OnToggleStateChanged = x => menuButton.Value = x
                }.InNamedRail("Menu button enabled"),

                new BsSlider {
                    FlexItem = {
                        Size = new() { x = 40.pt, y = 6.pt }
                    },

                    MinValue = 0f,
                    MaxValue = 100f,
                    ValueStep = 5f,
                    sValue = volume,
                    OnValueChanged = x => volume.Value = x
                }.InNamedRail("Volume"),

                new BsDropdown<string> {
                    FlexItem = {
                        Size = new() { x = 40.pt, y = 6.pt }
                    },

                    Items = new Dictionary<string, BsDropdownItem> {
                        ["default"] = new("Game Default", null),
                        ["english"] = new("English", null),
                        ["german"] = new("Deutsch", null)
                    },

                    Key = language.Value,
                    OnKeyChanged = x => language.Value = x
                }.Bind(ref _dropdown).InNamedRail("Language"),

                new Label {
                    FlexItem = {
                        Margin = new() { top = 3.pt },
                        AlignSelf = Align.Center
                    },

                    Color = Color.white with { a = 0.5f },
                    sText = volume.Map(x => $"Volume is at {x:0}%")
                }
            }
        }.Use();
    }
}

internal class Composing : ReactiveComponent {
    protected override GameObject Construct() {
        return new Layout {
            FlexController = {
                AlignItems = Align.Center,
                JustifyContent = Justify.Center,
                Gap = 3.pt
            },

            Children = {
                new Background {
                    FlexController = {
                        FlexDirection = FlexDirection.Column,
                        AlignItems = Align.Center,
                        Padding = 2.pt,
                        Gap = 0.5f.pt
                    },

                    Sprite = BeatSaberResources.Sprites.background,
                    PixelsPerUnit = 10f,
                    Color = Color.white with { a = 0.1f },

                    Children = {
                        new Label { Text = "Inline", FontSize = 3.5f, FontStyle = FontStyles.Bold },
                        new Label { Text = "used once", FontSize = 2.6f, Color = Color.white with { a = 0.6f } }
                    }
                },

                CreateCard("Method", "reused often"),

                new CounterCard {
                    Title = "Component"
                }
            }
        }.Use();
    }

    private static Background CreateCard(string title, string subtitle) {
        return new Background {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Center,
                Padding = 2.pt,
                Gap = 0.5f.pt
            },

            Sprite = BeatSaberResources.Sprites.background,
            PixelsPerUnit = 10f,
            Color = Color.white with { a = 0.1f },

            Children = {
                new Label { Text = title, FontSize = 3.5f, FontStyle = FontStyles.Bold },
                new Label { Text = subtitle, FontSize = 2.6f, Color = Color.white with { a = 0.6f } }
            }
        };
    }
}

internal class CounterCard : ReactiveComponent {
    public string Title {
        get => _title.Text;
        set => _title.Text = value;
    }

    private Label _title = null!;

    protected override GameObject Construct() {
        return new Background {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Center,
                Padding = 2.pt,
                Gap = 0.5f.pt
            },

            Sprite = BeatSaberResources.Sprites.background,
            PixelsPerUnit = 10f,
            Color = Color.white with { a = 0.1f },

            Children = {
                new Label { FontSize = 3.5f, FontStyle = FontStyles.Bold }.Bind(ref _title),
                new Label { Text = "has behaviour", FontSize = 2.6f, Color = Color.white with { a = 0.6f } }
            }
        }.Use();
    }
}

internal class Containers : ReactiveComponent {
    private readonly bool _withController;

    public Containers(bool withController) : base(false) {
        _withController = withController;
        ConstructAndInit();
    }

    protected override GameObject Construct() {
        var background = new Background {
            Sprite = BeatSaberResources.Sprites.background,
            PixelsPerUnit = 10f,
            Color = Color.white with { a = 0.15f },

            Children = {
                new Label {
                    Text = "Hello",
                    FontSize = 5f
                }
            }
        };

        if (_withController) {
            background.FlexController.JustifyContent = Justify.Center;
            background.FlexController.AlignItems = Align.Center;
        }

        return background.Use();
    }
}

/// <summary>
/// The troubleshooting entry on FlexItem: the same child with and without a controller on its parent.
/// </summary>
internal class FlexItems : ReactiveComponent {
    protected override GameObject Construct() {
        return new Layout {
            FlexController = {
                AlignItems = Align.FlexStart,
                Gap = 20.pt
            },

            Children = {
                CreateCase(withController: false, title: "Without a controller"),
                CreateCase(withController: true, title: "With a controller")
            }
        }.Use();
    }

    private static Layout CreateCase(bool withController, string title) {
        var parent = new Background {
            FlexItem = {
                Size = new() { x = 100.pt, y = 60.pt }
            },

            Sprite = BeatSaberResources.Sprites.background,
            PixelsPerUnit = 10f,
            Color = Color.white with { a = 0.15f },

            Children = {
                new Background {
                    FlexItem = {
                        Size = new() { x = 20.pt, y = 6.pt }
                    },

                    Sprite = BeatSaberResources.Sprites.background,
                    PixelsPerUnit = 10f,
                    Color = new Color(0f, 0.75f, 1f, 0.7f)
                }
            }
        };

        if (withController) {
            parent.FlexController.JustifyContent = Justify.Center;
            parent.FlexController.AlignItems = Align.Center;
        }

        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Center,
                Gap = 25.pt
            },

            Children = {
                parent,

                new Label {
                    Text = title,
                    FontSize = 4f,
                    Color = Color.white with { a = 0.6f }
                }
            }
        };
    }
}

/// <summary>
/// The troubleshooting entry on roots: a root inside a parent without a controller, with the default
/// constraints and with both turned off.
/// </summary>
internal class RootSizes : ReactiveComponent {
    protected override GameObject Construct() {
        return new Layout {
            FlexController = {
                AlignItems = Align.FlexStart,
                Gap = 20.pt
            },

            Children = {
                CreateCase(constrained: true, title: "Default constraints"),
                CreateCase(constrained: false, title: "Constraints off")
            }
        }.Use();
    }

    private static Layout CreateCase(bool constrained, string title) {
        // The parent has no controller, so the background inside it is a root
        var view = new Background {
            FlexItem = {
                Size = new() { x = 100.pt, y = 60.pt }
            },

            Sprite = BeatSaberResources.Sprites.background,
            PixelsPerUnit = 10f,
            Color = Color.white with { a = 0.15f },

            Children = {
                new Background {
                    FlexController = {
                        Padding = 2.pt,
                        JustifyContent = Justify.Center,
                        AlignItems = Align.Center,
                        ConstrainHorizontal = constrained,
                        ConstrainVertical = constrained
                    },

                    Sprite = BeatSaberResources.Sprites.background,
                    PixelsPerUnit = 10f,
                    Color = new Color(0f, 0.75f, 1f, 0.7f),

                    Children = {
                        new Label {
                            Text = "Fits its text",
                            FontSize = 4f
                        }
                    }
                }
            }
        };

        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Center,
                Gap = 5.pt
            },

            Children = {
                view,

                new Label {
                    Text = title,
                    FontSize = 4f,
                    Color = Color.white with { a = 0.6f }
                }
            }
        };
    }
}

/// <summary>
/// The introduction's animation sample: a grid that a diagonal wave runs across every period. Each tile pops up,
/// settles back with an overshoot and shifts its color. Two waves make a full cycle, so a 2 period recording loops.
/// </summary>
internal class Roots : ReactiveComponent {
    protected override GameObject Construct() {
        return new Background {
            FlexController = {
                Padding = 1.pt,
                ConstrainHorizontal = false,
                ConstrainVertical = false
            },

            Sprite = BeatSaberResources.Sprites.background,
            PixelsPerUnit = 10f,
            Color = Color.white with { a = 0.15f },

            Children = {
                new Label { Text = "Fits its text", FontSize = 4f }
            }
        }.Use();
    }
}

internal class Visibility : ReactiveComponent {
    private State<bool> _shown = null!;

    public bool Shown {
        set => _shown.Value = value;
    }

    protected override GameObject Construct() {
        var shown = _shown = Remember(false);

        return new Layout {
            FlexController = {
                AlignItems = Align.FlexStart,
                JustifyContent = Justify.Center,
                Gap = 10.pt,
                Padding = new() { top = 6.pt }
            },

            Children = {
                CreateColumn("Leaves the layout", shown, false),
                CreateColumn("WithinLayoutIfDisabled", shown, true)
            }
        }.Use();
    }

    [StateGen]
    private static Layout CreateColumn(string title, IState<bool> shown, bool keepSpace) {
        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Center,
                Gap = 1.pt
            },

            Children = {
                CreateBlock(new Color(0.35f, 0.75f, 1f)),

                new Background {
                    FlexItem = {
                        Size = new() { x = 24.pt, y = 8.pt }
                    },

                    Sprite = BeatSaberResources.Sprites.background,
                    PixelsPerUnit = 10f,
                    Color = new Color(1f, 0.6f, 0.3f),
                    WithinLayoutIfDisabled = keepSpace,
                    sEnabled = shown.In()
                },

                CreateBlock(new Color(0.35f, 0.75f, 1f)),

                new Label {
                    FlexItem = {
                        Margin = new() { top = 1.pt }
                    },

                    Text = title,
                    FontSize = 3f,
                    Color = Color.white with { a = 0.7f }
                }
            }
        };
    }

    private static Background CreateBlock(Color color) {
        return new Background {
            FlexItem = {
                Size = new() { x = 24.pt, y = 8.pt }
            },

            Sprite = BeatSaberResources.Sprites.background,
            PixelsPerUnit = 10f,
            Color = color
        };
    }
}

internal class WebImages : ReactiveComponent {
    protected override GameObject Construct() {
        return new Layout {
            FlexController = {
                AlignItems = Align.Center,
                JustifyContent = Justify.Center,
                Gap = 6.pt
            },

            Children = {
                CreateImage("http://127.0.0.1:8765/cover.png", false),
                CreateImage("http://10.255.255.1/cover.png", true),
                CreateImage("https://nowhere.invalid/cover.png", false)
            }
        }.Use();
    }

    private static ILayoutItem CreateImage(string url, bool loading) {
        return new Layout {
            FlexController = {
                AlignItems = Align.Center,
                JustifyContent = Justify.Center
            },

            FlexItem = {
                Size = new() { x = 20.pt, y = 20.pt }
            },

            Children = {
                new WebImage {
                    FlexItem = {
                        Size = new() { x = 20.pt, y = 20.pt },
                        PositionType = PositionType.Absolute
                    },

                    Src = url,
                    FallbackSprite = GameResources.CircleIcon,
                    PreserveAspect = true
                },

                new Spinner {
                    FlexItem = {
                        Size = 6.pt
                    },

                    Enabled = loading,
                    Image = {
                        Color = Color.white with { a = 0.8f }
                    }
                }
            }
        };
    }
}
