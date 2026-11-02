using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices.JavaScript;
using System.Text;
using Reactive;
using UnityEngine;

namespace Preview;

public static class Program {
    public static void Main() {
        PlaygroundEngine.Root.gameObject.AddComponent<Composition>();
        Console.SetOut(new LogWriter());
    }

    private sealed class LogWriter : TextWriter {
        private readonly StringBuilder _line = new();

        public override Encoding Encoding => Encoding.UTF8;

        public override void Write(char value) {
            if (value == '\n') {
                Debug.Log(_line.ToString().TrimEnd('\r'));
                _line.Clear();
            } else {
                _line.Append(value);
            }
        }
    }
}

public static partial class Bridge {
    private static ReactiveComponent? _current;

    [JSExport]
    public static void Tick(double deltaTime) => PlaygroundEngine.Tick((float)deltaTime);

    [JSExport]
    public static void SetRootSize(double width, double height) => PlaygroundEngine.SetRootSize((float)width, (float)height);

    [JSExport]
    public static void Pointer(string kind, int id, double x, double y, double deltaY) {
        switch (kind) {
            case "move": PlaygroundEngine.PointerMove(id, (float)x, (float)y); break;
            case "down": PlaygroundEngine.PointerDown(id, (float)x, (float)y); break;
            case "up": PlaygroundEngine.PointerUp(id, (float)x, (float)y); break;
            case "scroll": PlaygroundEngine.PointerScroll(id, (float)x, (float)y, (float)deltaY); break;
        }
    }

    [JSExport]
    public static string? Run(byte[] image) {
        try {
            var assembly = Assembly.Load(image);
            var type = assembly.GetTypes().FirstOrDefault(static x => x.Name == "App" && typeof(ReactiveComponent).IsAssignableFrom(x))
                ?? assembly.GetTypes().FirstOrDefault(static x => !x.IsAbstract && typeof(ReactiveComponent).IsAssignableFrom(x));

            if (type == null) {
                return "No component to show, declare `public class App : ReactiveComponent`";
            }

            _current?.Destroy();
            _current = null;

            var instance = (ReactiveComponent)Activator.CreateInstance(type)!;
            instance.Use(PlaygroundEngine.Root);
            _current = instance;
            return null;
        } catch (TargetInvocationException e) {
            return (e.InnerException ?? e).ToString();
        } catch (Exception e) {
            return e.ToString();
        }
    }
}
