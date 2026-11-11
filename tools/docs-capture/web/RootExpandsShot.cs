// The troubleshooting screenshot for a root that fills its parent. The orange panels stand for the parents and have
// no controller, so the blue background in each is a root, in the colors the layout system screenshots use. The
// recorder runs this file on the playground page.
class RootExpandsShot : ReactiveComponent {
    private static readonly Color Blue = new(0.35f, 0.75f, 1f, 0.45f);
    private static readonly Color Orange = new(1f, 0.6f, 0.3f, 0.25f);

    protected override GameObject Construct() {
        return new Layout {
            FlexController = {
                AlignItems = Align.Center,
                JustifyContent = Justify.Center,
                Gap = 16.pt
            },

            Children = {
                CreateColumn("Default constraints", constrained: true),
                CreateColumn("Constraints off", constrained: false)
            }
        }.Use();
    }

    private static Layout CreateColumn(string caption, bool constrained) {
        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Center,
                Gap = 3.pt
            },

            Children = {
                new Background {
                    FlexItem = { Size = new() { x = 110.pt, y = 40.pt } },
                    Sprite = BeatSaberResources.Sprites.background,
                    PixelsPerUnit = 10f,
                    Color = Orange,

                    Children = {
                        new Background {
                            FlexController = {
                                JustifyContent = Justify.Center,
                                AlignItems = Align.Center,
                                Padding = 1.pt,
                                ConstrainHorizontal = constrained,
                                ConstrainVertical = constrained
                            },

                            Sprite = BeatSaberResources.Sprites.background,
                            PixelsPerUnit = 10f,
                            Color = Blue,

                            Children = {
                                new Label { Text = "Fits its text", FontSize = 3.5f }
                            }
                        }
                    }
                },

                new Label {
                    Text = caption,
                    FontSize = 3f,
                    Color = Color.white with { a = 0.6f }
                }
            }
        };
    }
}
