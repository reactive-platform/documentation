#pragma once

#include <format>
#include <string>
#include <utility>

#include "playground/Engine.hpp"

struct PlaygroundLogger {
    template <class... TArgs>
    void error(std::format_string<TArgs...> format, TArgs&&... args) const {
        playground::Log(0, std::format(format, std::forward<TArgs>(args)...));
    }

    template <class... TArgs>
    void warn(std::format_string<TArgs...> format, TArgs&&... args) const {
        playground::Log(2, std::format(format, std::forward<TArgs>(args)...));
    }

    template <class... TArgs>
    void info(std::format_string<TArgs...> format, TArgs&&... args) const {
        playground::Log(3, std::format(format, std::forward<TArgs>(args)...));
    }
};

inline constexpr PlaygroundLogger ReactiveLogger;
