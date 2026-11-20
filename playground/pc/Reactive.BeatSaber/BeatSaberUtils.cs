using UnityEngine;

namespace Reactive.BeatSaber;

// The game's version sets up canvases, VR raycasting and Zenject containers, none of which exist in the browser. The
// preview draws every component on one page, so these keep the same signatures and leave the object as it is.
public static class BeatSaberUtils {
    public static bool UsesFPFC => true;

    public static void Make3DScreen(IReactiveComponent component) { }

    public static void Make3DScreen(GameObject content) { }

    public static void Make3DRaycastable(GameObject content) { }

    public static void AddCanvas(IReactiveComponent component) { }

    public static void AddCanvas(GameObject content) { }
}
