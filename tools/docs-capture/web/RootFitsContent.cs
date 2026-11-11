// A layout system screenshot. The orange panel stands for the parent and has no controller of its own, so the example
// inside it behaves the way the page describes, and its blue tint shows its bounds. The recorder runs this file on the
// playground page.
class RootFitsContent : ReactiveComponent {
    private static readonly Color Blue = new(0.35f, 0.75f, 1f, 0.45f);

    protected override GameObject Construct() {
        return new Layout {
            FlexController = {
                AlignItems = Align.Center,
                JustifyContent = Justify.Center
            },

            Children = {
                new Background {
                    FlexItem = {
                        Size = new() { x = 110.pt, y = 40.pt }
                    },

                    Sprite = BeatSaberResources.Sprites.background,
                    PixelsPerUnit = 10f,
                    Color = new Color(1f, 0.6f, 0.3f, 0.25f),

                    Children = {
                        new Background {
                            FlexController = {
                                Padding = 1.pt,
                                ConstrainHorizontal = false,
                                ConstrainVertical = false
                            },

                            Sprite = BeatSaberResources.Sprites.background,
                            PixelsPerUnit = 10f,
                            Color = Blue,

                            Children = {
                                new Label { Text = "Fits its text" }
                            }
                        }
                    }
                }
            }
        }.Use();
    }
}
