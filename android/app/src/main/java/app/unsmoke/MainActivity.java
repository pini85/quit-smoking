package app.unsmoke;

import android.os.Bundle;
import app.unsmoke.snore.SnoreMonitorPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SnoreMonitorPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
