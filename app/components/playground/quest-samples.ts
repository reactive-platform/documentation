const counter = `#include <string>

#include "reactive/beatsaber/BsTextButton.hpp"
#include "reactive/beatsaber/Label.hpp"
#include "reactive/layout/Layout.hpp"

using namespace reactive;
using namespace reactive::beatsaber;

class App : public ReactiveComponent {
protected:
    UnityEngine::GameObject* Construct() override {
        auto count = Remember(0);

        return (new Layout({
            .flexController = {
                .flexDirection  = FlexDirection::Column,
                .justifyContent = Justify::Center,
                .alignItems     = Align::Center,
                .gap            = YogaVector::All(2.f),
            },

            .children = {
                new Label({
                    .fontSize = 6.f,
                    .sText    = count->Map([](int x) { return "Pressed " + std::to_string(x) + " times"; }),
                }),

                new BsTextButton({
                    .flexItem = {.size = {25.f, 8.f}},
                    .onClick  = [count] { count->SetValue(count->Value() + 1); },
                    .text     = "Press",
                }),
            },
        }))->Use();
    }
};
`;

const buttons = `#include <string>

#include "reactive/beatsaber/BsTextButton.hpp"
#include "reactive/beatsaber/Label.hpp"
#include "reactive/layout/Layout.hpp"

using namespace reactive;
using namespace reactive::beatsaber;

class App : public ReactiveComponent {
protected:
    UnityEngine::GameObject* Construct() override {
        auto clicks = Remember(0);
        auto canClick = clicks->Map([](int x) { return x < 5; });

        return (new Layout({
            .flexController = {
                .flexDirection  = FlexDirection::Column,
                .justifyContent = Justify::Center,
                .alignItems     = Align::Center,
                .gap            = YogaVector::All(2.f),
            },

            .children = {
                new Layout({
                    .flexController = {.gap = YogaVector::All(2.f)},

                    .children = {
                        new BsTextButton({
                            .flexItem      = {.size = {25.f, 8.f}},
                            .onClick       = [clicks] { clicks->SetValue(clicks->Value() + 1); },
                            .sInteractable = canClick,
                            .text          = "Click me",
                        }),

                        new BsTextButton({
                            .flexItem      = {.size = {25.f, 8.f}},
                            .onClick       = [clicks] { clicks->SetValue(0); },
                            .showUnderline = false,
                            .text          = "Reset",
                        }),

                        new BsTextButton({
                            .flexItem     = {.size = {25.f, 8.f}},
                            .interactable = false,
                            .text         = "Disabled",
                        }),
                    },
                }),

                new Label({
                    .fontSize = 4.f,
                    .color    = SecondaryTextColor,
                    .sText    = clicks->Map([](int x) {
                        return x < 5 ? std::to_string(5 - x) + " clicks left" : std::string("No clicks left");
                    }),
                }),
            },
        }))->Use();
    }
};
`;

const animation = `#include "reactive/beatsaber/Background.hpp"
#include "reactive/beatsaber/BsTextButton.hpp"
#include "reactive/beatsaber/Spinner.hpp"
#include "reactive/layout/Layout.hpp"

using namespace reactive;
using namespace reactive::beatsaber;

class App : public ReactiveComponent {
protected:
    UnityEngine::GameObject* Construct() override {
        using UnityEngine::Color;

        auto expanded = Remember(false);
        auto width    = RememberAnimated(20.f, ms(450.f), AnimationCurve::EaseOutBack());
        auto color    = RememberAnimated(Color{0.3f, 0.6f, 1.f, 1.f}, ms(450.f));

        return (new Layout({
            .flexController = {
                .flexDirection  = FlexDirection::Column,
                .justifyContent = Justify::Center,
                .alignItems     = Align::Center,
                .gap            = YogaVector::All(3.f),
            },

            .children = {
                new Background({
                    .flexItem = {
                        .sSize = width->Map([](float x) { return YogaVector{x, 16.f}; }),
                    },

                    .sprite        = Sprites()->background,
                    .pixelsPerUnit = 12.f,
                    .sColor        = color,
                }),

                new Spinner({
                    .flexItem      = {.size = {8.f, 8.f}},
                    .rotationSpeed = 30.f,
                }),

                new BsTextButton({
                    .flexItem = {.size = {30.f, 8.f}},
                    .onClick  = [=] {
                        const bool next = !expanded->Value();
                        expanded->SetValue(next);
                        width->SetTargetValue(next ? 70.f : 20.f);
                        color->SetTargetValue(next ? Color{1.f, 0.35f, 0.5f, 1.f} : Color{0.3f, 0.6f, 1.f, 1.f});
                    },
                    .sText = expanded->Map([](bool x) { return std::string(x ? "Collapse" : "Expand"); }),
                }),
            },
        }))->Use();
    }
};
`;

const list = `#include <string>
#include <vector>

#include "reactive/beatsaber/Background.hpp"
#include "reactive/beatsaber/Label.hpp"
#include "reactive/beatsaber/ScrollArea.hpp"
#include "reactive/beatsaber/Scrollbar.hpp"
#include "reactive/components/Repeater.hpp"
#include "reactive/layout/Layout.hpp"

using namespace reactive;
using namespace reactive::beatsaber;

struct Player {
    std::string name;
    int score;
};

static std::vector<Player> CreatePlayers() {
    std::vector<Player> players;
    for (int i = 1; i <= 40; i++) players.push_back({"Player " + std::to_string(i), 1500000 - i * 12345});
    return players;
}

class App : public ReactiveComponent {
protected:
    UnityEngine::GameObject* Construct() override {
        auto scroll = std::make_shared<ScrollContext>();

        auto* rows = new Repeater<Player>({
            .flexController = {
                .gap               = YogaVector::All(1.f),
                .constrainVertical = false,
            },

            .constructCell = [](std::shared_ptr<CellContext<Player>> cell) -> IReactiveComponent* {
                return new Background({
                    .flexController = {
                        .justifyContent = Justify::SpaceBetween,
                        .alignItems     = Align::Center,
                        .padding        = YogaFrame::Symmetric(0.f, 2.f),
                    },
                    .flexItem = {.size = {.y = 7.f}},

                    .children = {
                        new Label({
                            .fontSize = 3.5f,
                            .sText    = cell->Map([](auto const& x) { return x.Item().name; }),
                        }),

                        new Label({
                            .fontSize = 3.5f,
                            .color    = SecondaryTextColor,
                            .sText    = cell->Map([](auto const& x) { return std::to_string(x.Item().score); }),
                        }),
                    },

                    .sprite        = Sprites()->background,
                    .color         = UnityEngine::Color{0.f, 0.f, 0.f, 0.5f},
                    .pixelsPerUnit = 12.f,
                });
            },

            .items = CreatePlayers(),
        });

        return (new Layout({
            .flexController = {
                .justifyContent = Justify::Center,
                .padding        = YogaFrame::All(3.f),
                .gap            = YogaVector::All(1.f),
            },

            .children = {
                new ScrollArea({
                    .flexItem      = {.flexGrow = 1.f, .maxSize = {.x = 80.f}},
                    .scrollContext = scroll,
                    .scrollContent = rows,
                }),

                new Scrollbar({.scrollContext = scroll}),
            },
        }))->Use();
    }
};
`;

const webImage = `#include "reactive/beatsaber/Label.hpp"
#include "reactive/beatsaber/WebImage.hpp"
#include "reactive/layout/Layout.hpp"

using namespace reactive;
using namespace reactive::beatsaber;

class App : public ReactiveComponent {
protected:
    UnityEngine::GameObject* Construct() override {
        auto* broken = new WebImage({
            .flexItem       = {.size = {24.f, 24.f}},
            .preserveAspect = true,
            .fallbackSprite = Sprites()->crossIcon,
            .src            = "https://placehold.co/does-not-exist",
        });
        broken->OnLoadFailed = [] { UnityEngine::Debug::LogWarning("The second image failed to load"); };

        return (new Layout({
            .flexController = {
                .justifyContent = Justify::Center,
                .alignItems     = Align::Center,
                .gap            = YogaVector::All(4.f),
            },

            .children = {
                new WebImage({
                    .flexItem       = {.size = {24.f, 24.f}},
                    .preserveAspect = true,
                    .src            = "https://placehold.co/240x240/3b82f6/white.png?text=Quest",
                }),

                broken,
            },
        }))->Use();
    }
};
`;

const layout = `#include "reactive/beatsaber/Background.hpp"
#include "reactive/beatsaber/Label.hpp"
#include "reactive/layout/Layout.hpp"

using namespace reactive;
using namespace reactive::beatsaber;

static Background* Box(float grow, UnityEngine::Color color, char const* text) {
    return new Background({
        .flexController = {
            .justifyContent = Justify::Center,
            .alignItems     = Align::Center,
        },
        .flexItem = {.flexGrow = grow},

        .children = {
            new Label({.fontSize = 4.f, .text = text}),
        },

        .color = color,
    });
}

class App : public ReactiveComponent {
protected:
    UnityEngine::GameObject* Construct() override {
        return (new Layout({
            .flexController = {
                .flexDirection = FlexDirection::Column,
                .padding       = YogaFrame::All(3.f),
                .gap           = YogaVector::All(2.f),
            },

            .children = {
                Box(1.f, {0.3f, 0.5f, 0.9f, 1.f}, "Grow 1"),

                new Layout({
                    .flexController = {.gap = YogaVector::All(2.f)},
                    .flexItem       = {.flexGrow = 3.f},

                    .children = {
                        Box(1.f, {0.7f, 0.3f, 0.6f, 1.f}, "Grow 1"),
                        Box(2.f, {0.9f, 0.4f, 0.3f, 1.f}, "Grow 2"),

                        (new Layout({
                            .flexController = {
                                .flexDirection = FlexDirection::Column,
                                .gap           = YogaVector::All(2.f),
                            },
                            .flexItem       = {.size = {.x = 30_pct}},

                            .children = {
                                Box(1.f, {0.2f, 0.7f, 0.5f, 1.f}, "30% wide"),
                                Box(1.f, {0.8f, 0.7f, 0.2f, 1.f}, "Stacked"),
                            },
                        })),
                    },
                }),

                Box(1.f, {0.4f, 0.4f, 0.45f, 1.f}, "Grow 1"),
            },
        }))->Use();
    }
};
`;

export const questSamples = [
    { name: 'Counter', code: counter },
    { name: 'Buttons', code: buttons },
    { name: 'Animation', code: animation },
    { name: 'List', code: list },
    { name: 'Web Image', code: webImage },
    { name: 'Layout', code: layout },
];
