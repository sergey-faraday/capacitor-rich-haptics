package com.sergeyfaraday.plugins.richhaptics;

import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Android implementation of RichHaptics.
 *
 * Engine selection:
 *   API 31+ (Android 12) → VibrationEffect.Composition with full primitive set
 *                          (CLICK, TICK, LOW_TICK, THUD, SPIN, QUICK_RISE,
 *                           SLOW_RISE, QUICK_FALL — selected per event)
 *   API 26+ (Android 8)  → VibrationEffect.createOneShot with amplitude
 *   API <26              → vibrator.vibrate(ms)
 */
@CapacitorPlugin(name = "RichHaptics")
public class RichHapticsPlugin extends Plugin {

    private Vibrator vibrator;
    private final Map<String, VibrationEffect> preloaded = new HashMap<>();
    private final Map<String, ContinuousLoop> continuousLoops = new HashMap<>();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private String lastError = null;
    private boolean enabled = true;
    private float intensityScale = 1.0f;

    @Override
    public void load() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = (VibratorManager) getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            vibrator = vm != null ? vm.getDefaultVibrator() : null;
        } else {
            vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
        }
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        boolean supported = vibrator != null && vibrator.hasVibrator();
        JSObject ret = new JSObject();
        ret.put("supported", supported);
        ret.put("engine", supported ? engineName() : "none");
        // Android exposes no per-app "haptics enabled" toggle equivalent to iOS Reduce Motion.
        // Treat as enabled when the device has a vibrator.
        ret.put("userEnabled", supported);
        call.resolve(ret);
    }

    @PluginMethod
    public void play(PluginCall call) {
        if (!enabled || !hasVibrator()) {
            call.resolve();
            return;
        }

        float intensity = clamp01(call.getFloat("intensity", 1.0f) * intensityScale);
        float sharpness = clamp01(call.getFloat("sharpness", 0.5f));
        double duration = call.getDouble("duration", 0.0);

        VibrationEffect effect = buildEffect(intensity, sharpness, duration, null);
        if (effect != null) vibrator.vibrate(effect);
        else if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            vibrator.vibrate(duration > 0 ? Math.max(1, (long) (duration * 1000)) : 20);
        }
        call.resolve();
    }

    @PluginMethod
    public void preset(PluginCall call) {
        if (!enabled || !hasVibrator()) {
            call.resolve();
            return;
        }
        String name = call.getString("name", "softTap");
        playPresetByName(name);
        call.resolve();
    }

    @PluginMethod
    public void playPattern(PluginCall call) {
        if (!enabled || !hasVibrator()) {
            call.resolve();
            return;
        }
        JSObject pattern = call.getObject("pattern");
        if (pattern == null) {
            call.reject("Must provide pattern");
            return;
        }
        try {
            playAHAPJson(pattern.toString());
            call.resolve();
        } catch (Exception e) {
            playMapped(0.7f * intensityScale, 0.5f, 0.0);
            call.resolve();
        }
    }

    @PluginMethod
    public void playAHAP(PluginCall call) {
        // Bundle-loaded AHAP files are iOS-only. Approximate with a soft tap.
        if (enabled && hasVibrator()) playPresetByName("softTap");
        call.resolve();
    }

    @PluginMethod
    public void playAHAPFromString(PluginCall call) {
        if (!enabled || !hasVibrator()) {
            call.resolve();
            return;
        }
        String json = call.getString("json");
        if (json == null) {
            call.reject("Must provide AHAP JSON string");
            return;
        }
        try {
            playAHAPJson(json);
            call.resolve();
        } catch (Exception e) {
            playMapped(0.7f, 0.5f, 0.0);
            call.resolve();
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (vibrator != null) vibrator.cancel();
        for (ContinuousLoop loop : continuousLoops.values()) loop.cancel();
        continuousLoops.clear();
        call.resolve();
    }

    // ── Live continuous players ─────────────────────────────────────────────

    @PluginMethod
    public void startContinuous(PluginCall call) {
        if (!enabled || !hasVibrator()) {
            call.resolve(new JSObject().put("id", "disabled"));
            return;
        }
        float intensity = clamp01(call.getFloat("intensity", 0.5f) * intensityScale);
        float sharpness = clamp01(call.getFloat("sharpness", 0.5f));
        String id = UUID.randomUUID().toString();
        ContinuousLoop loop = new ContinuousLoop(intensity, sharpness);
        continuousLoops.put(id, loop);
        loop.start();
        JSObject ret = new JSObject();
        ret.put("id", id);
        call.resolve(ret);
    }

    @PluginMethod
    public void updateParameters(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("Must provide id");
            return;
        }
        ContinuousLoop loop = continuousLoops.get(id);
        if (loop != null) {
            if (call.hasOption("intensity")) loop.intensity = clamp01(call.getFloat("intensity", loop.intensity) * intensityScale);
            if (call.hasOption("sharpness")) loop.sharpness = clamp01(call.getFloat("sharpness", loop.sharpness));
        }
        call.resolve();
    }

    @PluginMethod
    public void stopPlayer(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("Must provide id");
            return;
        }
        ContinuousLoop loop = continuousLoops.remove(id);
        if (loop != null) loop.cancel();
        call.resolve();
    }

    // ── Preload ─────────────────────────────────────────────────────────────

    @PluginMethod
    public void preload(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("Must provide id");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve(); // can't pre-build VibrationEffect, fallback at play time
            return;
        }

        if (call.hasOption("pattern")) {
            JSObject pattern = call.getObject("pattern");
            try {
                VibrationEffect effect = buildEffectFromAHAP(pattern.toString());
                if (effect != null) preloaded.put(id, effect);
            } catch (Exception ignored) {}
        } else {
            float intensity = clamp01(call.getFloat("intensity", 1.0f) * intensityScale);
            float sharpness = clamp01(call.getFloat("sharpness", 0.5f));
            double duration = call.getDouble("duration", 0.0);
            VibrationEffect effect = buildEffect(intensity, sharpness, duration, null);
            if (effect != null) preloaded.put(id, effect);
        }
        call.resolve();
    }

    @PluginMethod
    public void playPreloaded(PluginCall call) {
        if (!enabled || !hasVibrator()) {
            call.resolve();
            return;
        }
        String id = call.getString("id");
        VibrationEffect effect = preloaded.get(id);
        if (effect != null) vibrator.vibrate(effect);
        else playMapped(0.7f, 0.5f, 0.0);
        call.resolve();
    }

    @PluginMethod
    public void unload(PluginCall call) {
        String id = call.getString("id");
        if (id != null) preloaded.remove(id);
        call.resolve();
    }

    // ── Audio (no-op on Android) ────────────────────────────────────────────

    @PluginMethod
    public void getDiagnostics(PluginCall call) {
        JSObject ret = new JSObject();
        boolean has = hasVibrator();
        ret.put("engine", has ? engineName() : "none");
        ret.put("engineRunning", has);
        ret.put("preloadedCount", preloaded.size());
        ret.put("activeContinuousPlayers", continuousLoops.size());
        ret.put("registeredAudioCount", 0);
        ret.put("lastError", lastError == null ? org.json.JSONObject.NULL : lastError);
        call.resolve(ret);
    }

    @PluginMethod
    public void registerAudio(PluginCall call) {
        // Synchronized audio + haptics is iOS-only via CHHapticEngine.
        // App authors should pair this with a regular audio plugin on Android.
        call.resolve();
    }

    // ── App-wide kill switch ────────────────────────────────────────────────

    @PluginMethod
    public void setEnabled(PluginCall call) {
        Boolean value = call.getBoolean("enabled", true);
        enabled = value != null && value;
        if (!enabled && vibrator != null) {
            vibrator.cancel();
            for (ContinuousLoop loop : continuousLoops.values()) loop.cancel();
            continuousLoops.clear();
        }
        call.resolve();
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void setIntensityScale(PluginCall call) {
        float raw = call.getFloat("scale", 1.0f);
        intensityScale = Math.max(0f, Math.min(1f, raw));
        call.resolve();
    }

    @PluginMethod
    public void getIntensityScale(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("scale", intensityScale);
        call.resolve(ret);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private boolean hasVibrator() {
        return vibrator != null && vibrator.hasVibrator();
    }

    private String engineName() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            int[] all = new int[] {
                VibrationEffect.Composition.PRIMITIVE_CLICK,
                VibrationEffect.Composition.PRIMITIVE_TICK,
                VibrationEffect.Composition.PRIMITIVE_THUD
            };
            if (vibrator.areAllPrimitivesSupported(all)) return "composition";
        }
        return "basic";
    }

    private int primitiveForSharpness(float sharpness, float intensity) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return 0;
        // Very faint, low-frequency taps map to LOW_TICK (a designed-for-repetition
        // primitive that's barely perceptible) when supported.
        if (intensity < 0.3f && sharpness < 0.5f && vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_LOW_TICK)) {
            return VibrationEffect.Composition.PRIMITIVE_LOW_TICK;
        }
        if (sharpness >= 0.7f) return VibrationEffect.Composition.PRIMITIVE_CLICK;
        if (sharpness <= 0.25f) return VibrationEffect.Composition.PRIMITIVE_THUD;
        return VibrationEffect.Composition.PRIMITIVE_TICK;
    }

    /**
     * Resolve a JS-side primitive hint name (passed as Event._androidPrimitive)
     * to an Android Composition primitive constant. Returns -1 if unknown or
     * the primitive isn't supported on this device — caller should fall back
     * to the sharpness-based heuristic.
     */
    private int primitiveForHint(String hint) {
        if (hint == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return -1;
        int op;
        switch (hint) {
            case "click":
                op = VibrationEffect.Composition.PRIMITIVE_CLICK;
                break;
            case "tick":
                op = VibrationEffect.Composition.PRIMITIVE_TICK;
                break;
            case "lowTick":
                op = VibrationEffect.Composition.PRIMITIVE_LOW_TICK;
                break;
            case "thud":
                op = VibrationEffect.Composition.PRIMITIVE_THUD;
                break;
            case "spin":
                op = VibrationEffect.Composition.PRIMITIVE_SPIN;
                break;
            case "quickRise":
                op = VibrationEffect.Composition.PRIMITIVE_QUICK_RISE;
                break;
            case "slowRise":
                op = VibrationEffect.Composition.PRIMITIVE_SLOW_RISE;
                break;
            case "quickFall":
                op = VibrationEffect.Composition.PRIMITIVE_QUICK_FALL;
                break;
            default:
                return -1;
        }
        return vibrator.areAllPrimitivesSupported(op) ? op : -1;
    }

    private VibrationEffect buildEffect(float intensity, float sharpness, double duration, String primitiveHint) {
        if (duration <= 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            int op = primitiveForHint(primitiveHint);
            if (op == -1) op = primitiveForSharpness(sharpness, intensity);
            if (vibrator.areAllPrimitivesSupported(op)) {
                return VibrationEffect.startComposition().addPrimitive(op, intensity).compose();
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            long ms = duration > 0 ? Math.max(1, (long) (duration * 1000)) : 20;
            int amplitude = Math.max(1, Math.min(255, (int) (intensity * 255)));
            return VibrationEffect.createOneShot(ms, amplitude);
        }
        return null;
    }

    private void playPresetByName(String name) {
        switch (name) {
            // ── Original 7 ──────────────────────────────────────────────
            case "softTap":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && hasPredefined(VibrationEffect.EFFECT_TICK)) {
                    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK));
                } else playMapped(0.6f, 0.3f, 0.0);
                break;
            case "sharpClick":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && hasPredefined(VibrationEffect.EFFECT_CLICK)) {
                    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK));
                } else playMapped(1.0f, 1.0f, 0.0);
                break;
            case "scrollTick":
                playMapped(0.3f, 1.0f, 0.0);
                break;
            case "gentlePulse":
                playMapped(0.5f, 0.0f, 0.4);
                break;
            case "success":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && hasPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK)) {
                    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK));
                } else playPattern(new long[] { 0, 12, 60, 18 }, new int[] { 0, 180, 0, 220 });
                break;
            case "warning":
                playPattern(new long[] { 0, 40, 80, 40 }, new int[] { 0, 200, 0, 200 });
                break;
            case "error":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && hasPredefined(VibrationEffect.EFFECT_HEAVY_CLICK)) {
                    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK));
                } else playPattern(new long[] { 0, 60, 60, 60, 60, 60 }, new int[] { 0, 255, 0, 255, 0, 255 });
                break;
            // ── UIKit-aligned impacts ───────────────────────────────────
            case "mediumImpact":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && hasPredefined(VibrationEffect.EFFECT_CLICK)) {
                    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK));
                } else playMapped(0.7f, 0.5f, 0.0);
                break;
            case "heavyImpact":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && hasPredefined(VibrationEffect.EFFECT_HEAVY_CLICK)) {
                    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK));
                } else playMapped(1.0f, 0.7f, 0.0);
                break;
            case "softImpact":
                // Low-frequency thud — Composition THUD if available
                if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                    vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_THUD)
                ) {
                    vibrator.vibrate(
                        VibrationEffect.startComposition().addPrimitive(VibrationEffect.Composition.PRIMITIVE_THUD, 0.7f).compose()
                    );
                } else playMapped(0.7f, 0.2f, 0.0);
                break;
            case "rigidImpact":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && hasPredefined(VibrationEffect.EFFECT_CLICK)) {
                    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK));
                } else playMapped(1.0f, 1.0f, 0.0);
                break;
            // ── Selection ───────────────────────────────────────────────
            case "selectionStrong":
                if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                    vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_TICK)
                ) {
                    vibrator.vibrate(
                        VibrationEffect.startComposition().addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, 1.0f).compose()
                    );
                } else playMapped(0.5f, 1.0f, 0.0);
                break;
            case "detent":
                if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                    vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_TICK)
                ) {
                    vibrator.vibrate(
                        VibrationEffect.startComposition().addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, 0.4f).compose()
                    );
                } else playMapped(0.4f, 0.9f, 0.0);
                break;
            // ── Gestures (no direct Vibrator constants — mapped) ────────
            case "longPress":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && hasPredefined(VibrationEffect.EFFECT_HEAVY_CLICK)) {
                    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK));
                } else playMapped(0.8f, 0.5f, 0.0);
                break;
            case "dragStart":
                playMapped(0.6f, 0.5f, 0.0);
                break;
            case "dragEnd":
                playMapped(0.6f, 0.3f, 0.0);
                break;
            // ── Lighter notification family ────────────────────────────
            case "confirm":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && hasPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK)) {
                    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK));
                } else playPattern(new long[] { 0, 12, 50, 12 }, new int[] { 0, 150, 0, 180 });
                break;
            case "reject":
                playPattern(new long[] { 0, 16, 60, 16 }, new int[] { 0, 180, 0, 180 });
                break;
            case "info":
                playMapped(0.5f, 0.7f, 0.0);
                break;
            case "alert":
                playMapped(0.7f, 0.85f, 0.0);
                break;
            // ── Toggle ──────────────────────────────────────────────────
            case "toggleOn":
                playMapped(0.7f, 0.9f, 0.0);
                break;
            case "toggleOff":
                playMapped(0.5f, 0.4f, 0.0);
                break;
            // ── UI actions ──────────────────────────────────────────────
            case "expand":
                playMapped(0.4f, 0.5f, 0.0);
                break;
            case "collapse":
                // Soft fading thud — Composition QUICK_FALL when available
                if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                    vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_QUICK_FALL)
                ) {
                    vibrator.vibrate(
                        VibrationEffect.startComposition().addPrimitive(VibrationEffect.Composition.PRIMITIVE_QUICK_FALL, 0.4f).compose()
                    );
                } else playMapped(0.4f, 0.3f, 0.04);
                break;
            case "pop":
                if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                    vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_CLICK)
                ) {
                    vibrator.vibrate(
                        VibrationEffect.startComposition().addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 0.5f).compose()
                    );
                } else playMapped(0.5f, 0.95f, 0.0);
                break;
            // ── Specific physical metaphors ────────────────────────────
            case "subtle":
                // Lightest meaningful haptic — LOW_TICK when available
                if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                    vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_LOW_TICK)
                ) {
                    vibrator.vibrate(
                        VibrationEffect.startComposition().addPrimitive(VibrationEffect.Composition.PRIMITIVE_LOW_TICK, 1.0f).compose()
                    );
                } else playMapped(0.2f, 0.4f, 0.0);
                break;
            case "keyTap":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && hasPredefined(VibrationEffect.EFFECT_TICK)) {
                    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK));
                } else playMapped(0.3f, 0.85f, 0.0);
                break;
            case "bump":
                if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                    vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_THUD)
                ) {
                    vibrator.vibrate(
                        VibrationEffect.startComposition().addPrimitive(VibrationEffect.Composition.PRIMITIVE_THUD, 0.6f).compose()
                    );
                } else playMapped(0.6f, 0.15f, 0.04);
                break;
            case "loadingPulse":
                playMapped(0.3f, 0.0f, 0.8);
                break;
            default:
                playMapped(0.7f, 0.5f, 0.0);
                break;
        }
    }

    private boolean hasPredefined(int effectId) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return true; // assume supported
        int[] supported = vibrator.areEffectsSupported(effectId);
        return supported.length > 0 && supported[0] == Vibrator.VIBRATION_EFFECT_SUPPORT_YES;
    }

    private void playMapped(float intensity, float sharpness, double duration) {
        VibrationEffect effect = buildEffect(intensity, sharpness, duration, null);
        if (effect != null) vibrator.vibrate(effect);
        else if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            long ms = duration > 0 ? Math.max(1, (long) (duration * 1000)) : 20;
            vibrator.vibrate(ms);
        }
    }

    private void playPattern(long[] timings, int[] amplitudes) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1));
        } else {
            vibrator.vibrate(timings, -1);
        }
    }

    /**
     * Best-effort AHAP → Composition translation. Walks the Pattern array,
     * extracts HapticTransient events with Intensity/Sharpness parameters,
     * and chains them as Composition primitives spaced by Time deltas.
     */
    private void playAHAPJson(String json) throws Exception {
        VibrationEffect effect = buildEffectFromAHAP(json);
        if (effect != null) vibrator.vibrate(effect);
        else playMapped(0.7f, 0.5f, 0.0);
    }

    private VibrationEffect buildEffectFromAHAP(String json) throws Exception {
        if (
            Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            !vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_CLICK)
        ) {
            return null;
        }

        JSONObject root = new JSONObject(json);
        JSONArray pattern = root.optJSONArray("Pattern");
        if (pattern == null || pattern.length() == 0) return null;

        VibrationEffect.Composition composition = VibrationEffect.startComposition();
        double previousTime = 0;
        int eventsAdded = 0;

        for (int i = 0; i < pattern.length(); i++) {
            JSONObject entry = pattern.optJSONObject(i);
            if (entry == null) continue;
            JSONObject event = entry.optJSONObject("Event");
            if (event == null) continue;

            String type = event.optString("EventType", "");
            if (!"HapticTransient".equals(type) && !"HapticContinuous".equals(type)) continue;

            float intensity = 1.0f;
            float sharpness = 0.5f;
            JSONArray params = event.optJSONArray("EventParameters");
            if (params != null) {
                for (int p = 0; p < params.length(); p++) {
                    JSONObject param = params.optJSONObject(p);
                    if (param == null) continue;
                    String id = param.optString("ParameterID");
                    double value = param.optDouble("ParameterValue", 0.0);
                    if ("HapticIntensity".equals(id)) intensity = (float) value;
                    else if ("HapticSharpness".equals(id)) sharpness = (float) value;
                }
            }

            double time = event.optDouble("Time", previousTime);
            int delayMs = (int) Math.max(0, Math.round((time - previousTime) * 1000));
            previousTime = time;

            // _androidPrimitive is our non-standard hint — chooses between
            // the 8 Composition primitives explicitly. Falls back to the
            // intensity/sharpness heuristic if unknown or unsupported.
            String hint = event.optString("_androidPrimitive", null);
            int op = primitiveForHint(hint);
            if (op == -1) op = primitiveForSharpness(sharpness, intensity);

            composition.addPrimitive(op, clamp01(intensity * intensityScale), delayMs);
            eventsAdded++;
        }

        return eventsAdded == 0 ? null : composition.compose();
    }

    private static float clamp01(float v) {
        return Math.max(0f, Math.min(1f, v));
    }

    /**
     * Lightweight ~30Hz re-trigger loop used to simulate continuous playback
     * with live parameter modulation on Android. Far from the smoothness of
     * iOS CHHapticDynamicParameter, but honest about it.
     */
    private class ContinuousLoop implements Runnable {

        volatile float intensity;
        volatile float sharpness;
        volatile boolean cancelled = false;
        private static final long INTERVAL_MS = 33;

        ContinuousLoop(float intensity, float sharpness) {
            this.intensity = intensity;
            this.sharpness = sharpness;
        }

        void start() {
            mainHandler.post(this);
        }

        void cancel() {
            cancelled = true;
            mainHandler.removeCallbacks(this);
        }

        @Override
        public void run() {
            if (cancelled || !hasVibrator()) return;
            VibrationEffect effect = buildEffect(intensity, sharpness, 0, null);
            if (effect != null) vibrator.vibrate(effect);
            mainHandler.postDelayed(this, INTERVAL_MS);
        }
    }
}
