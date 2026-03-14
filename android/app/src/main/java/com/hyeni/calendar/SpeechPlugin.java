package com.hyeni.calendar;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

@CapacitorPlugin(
    name = "SpeechRecognition",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
    }
)
public class SpeechPlugin extends Plugin {

    private static final String TAG = "SpeechPlugin";
    private SpeechRecognizer speechRecognizer;

    @PluginMethod
    public void start(PluginCall call) {
        String language = call.getString("language", "ko-KR");

        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            bridge.saveCall(call);
            requestPermissionForAlias("microphone", call, "onMicPermissionResult");
            return;
        }

        doStart(call, language);
    }

    @PermissionCallback
    private void onMicPermissionResult(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED) {
            String language = call.getString("language", "ko-KR");
            doStart(call, language);
        } else {
            call.reject("Microphone permission denied");
        }
    }

    private void doStart(PluginCall call, String language) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Speech recognition not available on this device");
            return;
        }

        // Must run on main thread
        getActivity().runOnUiThread(() -> {
            try {
                if (speechRecognizer != null) {
                    speechRecognizer.destroy();
                }

                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getContext());

                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);

                speechRecognizer.setRecognitionListener(new RecognitionListener() {
                    @Override
                    public void onResults(Bundle results) {
                        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (matches != null && !matches.isEmpty()) {
                            JSObject ret = new JSObject();
                            ret.put("transcript", matches.get(0));
                            ret.put("success", true);
                            call.resolve(ret);
                        } else {
                            call.reject("No speech detected");
                        }
                        cleanup();
                    }

                    @Override
                    public void onError(int error) {
                        String msg;
                        switch (error) {
                            case SpeechRecognizer.ERROR_NO_MATCH:
                                msg = "음성을 인식하지 못했어요"; break;
                            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                                msg = "음성이 감지되지 않았어요"; break;
                            case SpeechRecognizer.ERROR_AUDIO:
                                msg = "오디오 오류"; break;
                            case SpeechRecognizer.ERROR_NETWORK:
                            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                                msg = "네트워크 오류 (인터넷 확인)"; break;
                            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                                msg = "마이크 권한이 필요해요"; break;
                            default:
                                msg = "음성 인식 오류 (" + error + ")"; break;
                        }
                        Log.e(TAG, "Speech error: " + error + " - " + msg);
                        call.reject(msg);
                        cleanup();
                    }

                    @Override public void onReadyForSpeech(Bundle params) {
                        Log.d(TAG, "Ready for speech");
                    }
                    @Override public void onBeginningOfSpeech() {}
                    @Override public void onRmsChanged(float rmsdB) {}
                    @Override public void onBufferReceived(byte[] buffer) {}
                    @Override public void onEndOfSpeech() {
                        Log.d(TAG, "End of speech");
                    }
                    @Override public void onPartialResults(Bundle partialResults) {}
                    @Override public void onEvent(int eventType, Bundle params) {}
                });

                speechRecognizer.startListening(intent);
                Log.i(TAG, "Speech recognition started (lang=" + language + ")");

            } catch (Exception e) {
                Log.e(TAG, "Failed to start speech recognition", e);
                call.reject("Failed to start: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (speechRecognizer != null) {
                speechRecognizer.stopListening();
            }
            call.resolve(new JSObject().put("status", "stopped"));
        });
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        boolean available = SpeechRecognizer.isRecognitionAvailable(getContext());
        call.resolve(new JSObject().put("available", available));
    }

    private void cleanup() {
        getActivity().runOnUiThread(() -> {
            if (speechRecognizer != null) {
                speechRecognizer.destroy();
                speechRecognizer = null;
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        cleanup();
        super.handleOnDestroy();
    }
}
