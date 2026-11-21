#pragma once

#include <string>

#include "reactive/animations/AnimatedState.hpp"
#include "reactive/layout/Props.hpp"
#include "reactive/state/State.hpp"

#define PLAYGROUND_STATE(Keyword, Type)                 \
    Keyword template class reactive::IState<Type>;      \
    Keyword template class reactive::StateBase<Type>;   \
    Keyword template class reactive::State<Type>;       \
    Keyword template struct reactive::StateBinding<Type>;

#define PLAYGROUND_STATES(Keyword)                      \
    PLAYGROUND_STATE(Keyword, int)                      \
    PLAYGROUND_STATE(Keyword, float)                    \
    PLAYGROUND_STATE(Keyword, bool)                     \
    PLAYGROUND_STATE(Keyword, std::string)              \
    PLAYGROUND_STATE(Keyword, UnityEngine::Color)       \
    PLAYGROUND_STATE(Keyword, UnityEngine::Vector2)     \
    PLAYGROUND_STATE(Keyword, UnityEngine::Sprite*)     \
    PLAYGROUND_STATE(Keyword, reactive::YogaVector)     \
    PLAYGROUND_STATE(Keyword, reactive::YogaFrame)      \
    Keyword template class reactive::AnimatedState<float>;              \
    Keyword template class reactive::AnimatedState<UnityEngine::Color>; \
    Keyword template class reactive::AnimatedState<UnityEngine::Vector2>;

#ifndef PLAYGROUND_INSTANTIATE
PLAYGROUND_STATES(extern)
#endif
