// The troubleshooting screenshot for a FlexItem without a controller above it. The orange panels stand for the parents
// and the blue boxes for the children, in the colors the layout system screenshots use. The recorder runs this file on
// the playground page.
class FlexItemShot : ReactiveComponent {
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
                // The child keeps Unity's default rect and spills out, so the caption sits below the spill
                CreateColumn("Without a controller", gap: 34f, new Background {
                    FlexItem = { Size = new() { x = 110.pt, y = 40.pt } },
                    Sprite = BeatSaberResources.Sprites.background,
                    PixelsPerUnit = 10f,
                    Color = Orange,

                    Children = { CreateChild() }
                }),

                CreateColumn("With a controller", gap: 34f, new Background {
                    FlexController = {
                        JustifyContent = Justify.Center,
                        AlignItems = Align.Center
                    },

                    FlexItem = { Size = new() { x = 110.pt, y = 40.pt } },
                    Sprite = BeatSaberResources.Sprites.background,
                    PixelsPerUnit = 10f,
                    Color = Orange,

                    Children = { CreateChild() }
                })
            }
        }.Use();
    }

    private static Background CreateChild() {
        return new Background {
            FlexItem = {
                Size = new() { x = 20.pt, y = 6.pt }
            },

            Sprite = BeatSaberResources.Sprites.background,
            PixelsPerUnit = 10f,
            Color = Blue
        };
    }

    private static Layout CreateColumn(string caption, float gap, ILayoutItem panel) {
        return new Layout {
            FlexController = {
                FlexDirection = FlexDirection.Column,
                AlignItems = Align.Center,
                Gap = gap.pt
            },

            Children = {
                panel,

                new Label {
                    Text = caption,
                    FontSize = 3f,
                    Color = Color.white with { a = 0.6f }
                }
            }
        };
    }
}
