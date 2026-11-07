using IPA;
using IPA.Logging;

namespace DocsCapture;

[Plugin(RuntimeOptions.SingleStartInit)]
public class Plugin {
    public static Logger Log { get; private set; } = null!;

    [Init]
    public Plugin(Logger logger) {
        Log = logger;
    }

    [OnStart]
    public void OnStart() {
        Driver.Boot();
    }
}
