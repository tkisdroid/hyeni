package com.hyeni.calendar;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "KakaoMapLauncher")
public class KakaoMapLauncherPlugin extends Plugin {

    private static final String KAKAO_MAP_PACKAGE = "net.daum.android.map";
    private static final java.util.regex.Pattern COORD_PATTERN =
        java.util.regex.Pattern.compile("^-?\\d+(\\.\\d+)?,-?\\d+(\\.\\d+)?$");

    @PluginMethod
    public void openRouteFoot(PluginCall call) {
        String sp = call.getString("sp", "");
        String ep = call.getString("ep", "");
        if (sp == null || !COORD_PATTERN.matcher(sp).matches()
                || ep == null || !COORD_PATTERN.matcher(ep).matches()) {
            call.reject("invalid coords");
            return;
        }

        String uri = "kakaomap://route?sp=" + sp + "&ep=" + ep + "&by=FOOT";
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
        intent.setPackage(KAKAO_MAP_PACKAGE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        JSObject ret = new JSObject();
        try {
            getContext().startActivity(intent);
            ret.put("opened", true);
            call.resolve(ret);
        } catch (ActivityNotFoundException e) {
            ret.put("opened", false);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("startActivity failed: " + e.getMessage());
        }
    }
}
