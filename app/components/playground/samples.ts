const settings = `using Reactive;
using Reactive.BeatSaber.Components;
using Reactive.Components;
using Reactive.Yoga;
using UnityEngine;

public class App : ReactiveComponent {
    protected override GameObject Construct() {
        var volume = Remember(70f);

        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                JustifyContent = Justify.Center,
                Gap = 1.pt,
                Padding = new() { left = 25.pt, right = 25.pt }
            },

            Children = {
                new BsSegmentedControl<string> {
                    FlexItem = {
                        Size = new() { x = 50.pt, y = 8.pt },
                        Margin = new() { bottom = 3.pt },
                        AlignSelf = Align.Center
                    },

                    Items = new Dictionary<string, BsSegmentedControlItem> {
                        ["global"] = new("Global", null),
                        ["ui"] = new("UI", null),
                        ["replays"] = new("Replays", null)
                    },
                    Key = "global"
                },

                new BsToggle { Toggled = true }.InNamedRail("Menu Button Enabled"),

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
                    Key = "default"
                }.InNamedRail("Language"),

                new BsListControl<int> {
                    FlexItem = {
                        Size = new() { x = 40.pt, y = 6.pt }
                    },

                    Items = new BsListControlItem<int>[] {
                        new(0, "Low", null),
                        new(1, "Medium", null),
                        new(2, "High", null)
                    },
                    Key = 1
                }.InNamedRail("Quality"),

                new Label {
                    FlexItem = {
                        Margin = new() { top = 3.pt },
                        AlignSelf = Align.Center
                    },

                    Color = Color.white with { a = 0.5f },
                    sText = volume.Map(x => $"Volume is at {x:0}%")
                }
            }
        }.WithRectExpand().Use();
    }
}
`;

const buttons = `using Reactive;
using Reactive.BeatSaber;
using Reactive.BeatSaber.Components;
using Reactive.Components;
using Reactive.Yoga;
using UnityEngine;

public class App : ReactiveComponent {
    protected override GameObject Construct() {
        var clicks = Remember(0);

        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                JustifyContent = Justify.Center,
                AlignItems = Align.Center,
                Gap = 4.pt
            },

            Children = {
                new Layout {
                    FlexController = {
                        Gap = 2.pt
                    },

                    Children = {
                        new BsTextButton {
                            FlexItem = {
                                Size = new() { x = 30.pt, y = 8.pt }
                            },

                            Text = "CANCEL",
                            OnClick = () => clicks.Value--
                        },

                        new BsPrimaryTextButton {
                            FlexItem = {
                                Size = new() { x = 30.pt, y = 8.pt }
                            },

                            Text = "PLAY",
                            OnClick = () => clicks.Value++
                        },

                        new BsImageButton {
                            FlexItem = {
                                Size = new() { x = 10.pt, y = 8.pt }
                            },

                            Sprite = GameResources.EditIcon,
                            OnClick = () => clicks.Value = 0
                        }
                    }
                },

                new Layout {
                    FlexController = {
                        AlignItems = Align.Center,
                        Gap = 2.pt
                    },

                    Children = {
                        new BsTextButton {
                            FlexItem = {
                                Size = new() { x = 30.pt, y = 8.pt }
                            },

                            Text = "DISABLED",
                            Interactable = false
                        },

                        new BsPrimaryTextButton {
                            FlexItem = {
                                Size = new() { x = 30.pt, y = 8.pt }
                            },

                            Text = "DISABLED",
                            Interactable = false
                        },

                        new Spinner {
                            FlexItem = {
                                Size = 8.pt
                            }
                        }
                    }
                },

                new Label {
                    FontSize = 6f,
                    sText = clicks.Map(x => $"Value: {x}")
                }
            }
        }.WithRectExpand().Use();
    }
}
`;

const dialog = `using Reactive;
using Reactive.BeatSaber.Components;
using Reactive.Components;
using Reactive.Yoga;
using UnityEngine;

public class App : ReactiveComponent {
    protected override GameObject Construct() {
        var isOpen = Remember(false);
        var deleted = Remember(0);

        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                JustifyContent = Justify.Center,
                AlignItems = Align.Center,
                Gap = 3.pt
            },

            Children = {
                new Dialog {
                    Title = "Delete Replay",
                    sIsPushed = isOpen,
                    OnClickOutside = () => isOpen.Value = false,

                    CancelButton = {
                        OnClick = () => isOpen.Value = false
                    },

                    OkButton = {
                        OnClick = () => {
                            isOpen.Value = false;
                            deleted.Value++;
                        }
                    },

                    Children = {
                        new Label {
                            FlexItem = {
                                FlexGrow = 1f,
                                Size = new() { x = 60.pt, y = 14.pt }
                            },

                            Text = "Do you really want to delete this replay?\\nYou won't be able to recover it."
                        }
                    }
                },

                new BsTextButton {
                    FlexItem = {
                        Size = new() { x = 30.pt, y = 8.pt }
                    },

                    Text = "DELETE",
                    OnClick = () => isOpen.Value = true
                },

                new Label {
                    sText = deleted.Map(x => $"Deleted {x} replays")
                }
            }
        }.WithRectExpand().Use();
    }
}
`;

const input = `using Reactive;
using Reactive.BeatSaber;
using Reactive.BeatSaber.Components;
using Reactive.Components;
using Reactive.Yoga;
using UnityEngine;

public class App : ReactiveComponent {
    protected override GameObject Construct() {
        var name = new BsInputFieldContext();
        var color = new BsColorPickerContext { Color = Color.cyan, SelectedColor = Color.cyan };

        return new Layout {
            FlexController = {
                JustifyContent = Justify.Center,
                AlignItems = Align.Center
            },

            Children = {
                new BsKeyboardModal { Context = name },
                new BsColorCircleModal { Context = color },

                new Layout {
                    FlexItem = {
                        Size = new() { x = 60.pt }
                    },

                    FlexController = {
                        FlexDirection = FlexDirection.Column,
                        Gap = 3.pt
                    },

                    Children = {
                        new BsInputField {
                            FlexItem = {
                                Size = new() { y = 8.pt }
                            },

                            Context = name,
                            Placeholder = "Enter Name",
                            Icon = GameResources.EditIcon
                        },

                        new BsColorPicker {
                            FlexItem = {
                                Size = new() { x = 20.pt, y = 8.pt }
                            },

                            Context = color
                        }.InNamedRail("Saber Color"),

                        new Background {
                            FlexItem = {
                                Size = new() { y = 12.pt }
                            },

                            FlexController = {
                                JustifyContent = Justify.Center,
                                AlignItems = Align.Center
                            },

                            Sprite = BeatSaberResources.Sprites.background,
                            PixelsPerUnit = 8f,
                            Color = Color.black with { a = 0.5f },

                            Children = {
                                new Label {
                                    sText = name.Map(x => string.IsNullOrEmpty(x.Text) ? "Your name goes here" : x.Text!),
                                    sColor = color.Map(x => x.Color)
                                }
                            }
                        }
                    }
                }
            }
        }.WithRectExpand().Use();
    }
}
`;

const list = `using Reactive;
using Reactive.BeatSaber;
using Reactive.BeatSaber.Components;
using Reactive.Components;
using Reactive.Yoga;
using UnityEngine;

public class App : ReactiveComponent {
    protected override GameObject Construct() {
        var items = Remember<IReadOnlyList<string>>(Enumerable.Range(1, 30).Select(x => $"Beatmap {x}").ToArray());
        var scroll = new ScrollContext();

        return new Layout {
            FlexController = {
                JustifyContent = Justify.Center,
                AlignItems = Align.Center
            },

            Children = {
                new Background {
                    FlexItem = {
                        Size = new() { x = 80.pt, y = 60.pt }
                    },

                    FlexController = {
                        Gap = 2.pt,
                        Padding = 3.pt
                    },

                    Sprite = BeatSaberResources.Sprites.background,
                    PixelsPerUnit = 8f,
                    Color = Color.white with { a = 0.05f },

                    Children = {
                        new ScrollArea {
                            FlexItem = {
                                FlexGrow = 1f
                            },

                            ScrollContext = scroll,
                            LineSize = 9f,

                            ScrollContent = new Repeater<string, IReactiveComponent> {
                                FlexController = {
                                    FlexDirection = FlexDirection.Column,
                                    Gap = 1.pt,
                                    ConstrainVertical = false
                                },

                                sItems = items,

                                ConstructCell = cell => new Background {
                                    FlexItem = {
                                        Size = new() { y = 8.pt }
                                    },

                                    FlexController = {
                                        JustifyContent = Justify.Center,
                                        AlignItems = Align.Center
                                    },

                                    Sprite = BeatSaberResources.Sprites.background,
                                    PixelsPerUnit = 12f,
                                    Color = Color.black with { a = 0.5f },

                                    Children = {
                                        new Label { sText = cell.Map(x => x.Item) }
                                    }
                                }
                            }
                        },

                        new Scrollbar {
                            FlexItem = {
                                Size = new() { x = 6.pt }
                            },

                            ScrollContext = scroll
                        }
                    }
                }
            }
        }.WithRectExpand().Use();
    }
}
`;

const webImage = `using Reactive;
using Reactive.BeatSaber.Components;
using Reactive.Components;
using Reactive.Yoga;
using UnityEngine;

public class App : ReactiveComponent {
    protected override GameObject Construct() {
        var text = Remember("Reactive");
        var playing = Remember(true);

        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                JustifyContent = Justify.Center,
                AlignItems = Align.Center,
                Gap = 3.pt
            },

            Children = {
                new WebImage {
                    FlexItem = {
                        Size = new() { x = 60.pt, y = 15.pt }
                    },

                    sSrc = text.Map(x => $"https://placehold.co/800x200/000000/FFFFFF/png?text={x}")
                },

                new BsSegmentedControl<string> {
                    FlexItem = {
                        Size = new() { x = 60.pt, y = 8.pt }
                    },

                    Items = new Dictionary<string, BsSegmentedControlItem> {
                        ["Reactive"] = new("Reactive", null),
                        ["Beat+Saber"] = new("Beat Saber", null),
                        ["BeatLeader"] = new("BeatLeader", null)
                    },
                    Key = "Reactive",
                    OnKeyChanged = x => text.Value = x
                },

                new WebImage {
                    FlexItem = {
                        Size = new() { x = 40.pt, y = 30.pt }
                    },

                    Src = "https://upload.wikimedia.org/wikipedia/commons/d/d3/Newtons_cradle_animation_book_2.gif",
                    sIsPlaying = playing
                },

                new BsToggle {
                    sToggled = playing,
                    OnToggleStateChanged = x => playing.Value = x
                }.InNamedRail("Playing")
            }
        }.WithRectExpand().Use();
    }
}
`;

const layout = `using Reactive;
using Reactive.BeatSaber;
using Reactive.BeatSaber.Components;
using Reactive.Components;
using Reactive.Yoga;
using UnityEngine;

public class Box : Image {
    protected override void OnInitialize() {
        Sprite = BeatSaberResources.Sprites.background;
        PixelsPerUnit = 12f;
    }
}

public class App : ReactiveComponent {
    protected override GameObject Construct() {
        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                Gap = 5.pt,
                Padding = 8.pt
            },

            Children = {
                new Layout {
                    FlexItem = {
                        Size = new() { y = 20.pt }
                    },

                    FlexController = {
                        Gap = 3.pt
                    },

                    Children = {
                        new Box { FlexItem = { Size = new() { x = 20.pt } }, Color = Color.cyan },
                        new Box { FlexItem = { FlexGrow = 1f }, Color = Color.magenta },
                        new Box { FlexItem = { FlexGrow = 2f }, Color = Color.yellow }
                    }
                },

                new Layout {
                    FlexItem = {
                        FlexGrow = 1f
                    },

                    FlexController = {
                        JustifyContent = Justify.SpaceBetween
                    },

                    Children = {
                        new Box { FlexItem = { Size = 16.pt, AlignSelf = Align.FlexStart }, Color = Color.green },
                        new Box { FlexItem = { Size = 16.pt, AlignSelf = Align.Center }, Color = Color.green },
                        new Box { FlexItem = { Size = 16.pt, AlignSelf = Align.FlexEnd }, Color = Color.green }
                    }
                },

                new Layout {
                    FlexItem = {
                        Size = new() { y = 16.pt }
                    },

                    FlexController = {
                        AlignItems = Align.Center
                    },

                    Children = {
                        new Box { FlexItem = { Size = 12.pt }, Color = Color.white },

                        new Label {
                            FlexItem = {
                                Margin = new() { left = 4.pt }
                            },

                            Text = "Sized by its text",
                            FontSize = 5f
                        }
                    }
                }
            }
        }.WithRectExpand().Use();
    }
}
`;

export const samples = [
    { name: 'Settings', code: settings },
    { name: 'Buttons', code: buttons },
    { name: 'Dialog', code: dialog },
    { name: 'Input', code: input },
    { name: 'List', code: list },
    { name: 'Web Image', code: webImage },
    { name: 'Layout', code: layout },
];
