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
        if (intensity <= 0f) {
            clearLastError();
            call.resolve();
            return;
        }
        float sharpness = clamp01(call.getFloat("sharpness", 0.5f));
        double duration = call.getDouble("duration", 0.0);

        VibrationEffect effect = buildEffect(intensity, sharpness, duration, null);
        if (effect != null) vibrator.vibrate(effect);
        else if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            vibrator.vibrate(duration > 0 ? Math.max(1, (long) (duration * 1000)) : 20);
        }
        clearLastError();
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
        clearLastError();
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
            reject(call, "Must provide pattern");
            return;
        }
        try {
            if (!playAHAPJson(pattern.toString())) playMapped(0.7f, 0.5f, 0.0);
            clearLastError();
            call.resolve();
        } catch (Exception e) {
            reject(call, "playPattern error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void playAHAP(PluginCall call) {
        // Bundle-loaded AHAP files are iOS-only. Approximate with a soft tap.
        if (enabled && hasVibrator()) playPresetByName("softTap");
        clearLastError();
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
            reject(call, "Must provide AHAP JSON string");
            return;
        }
        try {
            if (!playAHAPJson(json)) playMapped(0.7f, 0.5f, 0.0);
            clearLastError();
            call.resolve();
        } catch (Exception e) {
            reject(call, "playAHAPFromString error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (vibrator != null) vibrator.cancel();
        for (ContinuousLoop loop : continuousLoops.values()) loop.cancel();
        continuousLoops.clear();
        clearLastError();
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
        clearLastError();
        call.resolve(ret);
    }

    @PluginMethod
    public void updateParameters(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            reject(call, "Must provide id");
            return;
        }
        ContinuousLoop loop = continuousLoops.get(id);
        if (loop != null) {
            if (call.hasOption("intensity")) loop.intensity = clamp01(call.getFloat("intensity", loop.intensity) * intensityScale);
            if (call.hasOption("sharpness")) loop.sharpness = clamp01(call.getFloat("sharpness", loop.sharpness));
        }
        clearLastError();
        call.resolve();
    }

    @PluginMethod
    public void stopPlayer(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            reject(call, "Must provide id");
            return;
        }
        ContinuousLoop loop = continuousLoops.remove(id);
        if (loop != null) loop.cancel();
        clearLastError();
        call.resolve();
    }

    // ── Preload ─────────────────────────────────────────────────────────────

    @PluginMethod
    public void preload(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            reject(call, "Must provide id");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve(); // can't pre-build VibrationEffect, fallback at play time
            return;
        }

        if (call.hasOption("pattern")) {
            JSObject pattern = call.getObject("pattern");
            if (pattern == null) {
                reject(call, "Must provide pattern");
                return;
            }
            try {
                VibrationEffect effect = buildEffectFromAHAP(pattern.toString());
                if (effect == null) effect = buildEffect(clamp01(0.7f * intensityScale), 0.5f, 0.0, null);
                if (effect != null) preloaded.put(id, effect);
            } catch (Exception e) {
                reject(call, "preload error: " + e.getMessage());
                return;
            }
        } else {
            float intensity = clamp01(call.getFloat("intensity", 1.0f) * intensityScale);
            float sharpness = clamp01(call.getFloat("sharpness", 0.5f));
            double duration = call.getDouble("duration", 0.0);
            VibrationEffect effect = buildEffect(intensity, sharpness, duration, null);
            if (effect != null) preloaded.put(id, effect);
        }
        clearLastError();
        call.resolve();
    }

    @PluginMethod
    public void playPreloaded(PluginCall call) {
        if (!enabled || !hasVibrator()) {
            call.resolve();
            return;
        }
        String id = call.getString("id");
        if (id == null) {
            reject(call, "Must provide id");
            return;
        }
        VibrationEffect effect = preloaded.get(id);
        if (effect != null) vibrator.vibrate(effect);
        else {
            reject(call, "No preloaded pattern with id '" + id + "'");
            return;
        }
        clearLastError();
        call.resolve();
    }

    @PluginMethod
    public void unload(PluginCall call) {
        String id = call.getString("id");
        if (id != null) preloaded.remove(id);
        clearLastError();
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
        clearLastError();
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
        clearLastError();
        call.resolve();
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        clearLastError();
        call.resolve(ret);
    }

    @PluginMethod
    public void setIntensityScale(PluginCall call) {
        float raw = call.getFloat("scale", 1.0f);
        intensityScale = Math.max(0f, Math.min(1f, raw));
        clearLastError();
        call.resolve();
    }

    @PluginMethod
    public void getIntensityScale(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("scale", intensityScale);
        clearLastError();
        call.resolve(ret);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private boolean hasVibrator() {
        return vibrator != null && vibrator.hasVibrator();
    }

    private void clearLastError() {
        lastError = null;
    }

    private void reject(PluginCall call, String message) {
        lastError = message;
        call.reject(message);
    }

    private boolean isFullStrength() {
        return intensityScale >= 0.999f;
    }

    private boolean isMuted() {
        return intensityScale <= 0f;
    }

    private float scaled(float intensity) {
        return clamp01(intensity * intensityScale);
    }

    private int scaledAmplitude(int amplitude) {
        if (amplitude <= 0 || isMuted()) return 0;
        return Math.max(1, Math.min(255, Math.round(amplitude * intensityScale)));
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

    private int supportedPrimitiveOrFallback(int preferred) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || vibrator == null) return -1;
        if (preferred != -1 && vibrator.areAllPrimitivesSupported(preferred)) return preferred;
        int[] fallbacks = new int[] {
            VibrationEffect.Composition.PRIMITIVE_CLICK,
            VibrationEffect.Composition.PRIMITIVE_TICK,
            VibrationEffect.Composition.PRIMITIVE_THUD,
            VibrationEffect.Composition.PRIMITIVE_LOW_TICK
        };
        for (int op : fallbacks) {
            if (vibrator.areAllPrimitivesSupported(op)) return op;
        }
        return -1;
    }

    private boolean canComposeAHAP() {
        return (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            vibrator != null &&
            vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_CLICK)
        );
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
        if (intensity <= 0f) return null;
        if (duration <= 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            int op = primitiveForHint(primitiveHint);
            if (op == -1) op = primitiveForSharpness(sharpness, intensity);
            op = supportedPrimitiveOrFallback(op);
            if (op != -1) {
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
        if (isMuted()) return;
        switch (name) {
            // ── Original 7 ──────────────────────────────────────────────
            case "softTap":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && isFullStrength() && hasPredefined(VibrationEffect.EFFECT_TICK)) {
                    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK));
                } else playMapped(0.6f, 0.3f, 0.0);
                break;
            case "sharpClick":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && isFullStrength() && hasPredefined(VibrationEffect.EFFECT_CLICK)) {
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
                if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && isFullStrength() && hasPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK)
                ) {
                    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK));
                } else playPattern(new long[] { 0, 12, 60, 18 }, new int[] { 0, 180, 0, 220 });
                break;
            case "warning":
                playPattern(new long[] { 0, 40, 80, 40 }, new int[] { 0, 200, 0, 200 });
                break;
            case "error":
                if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && isFullStrength() && hasPredefined(VibrationEffect.EFFECT_HEAVY_CLICK)
                ) {
                    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK));
                } else playPattern(new long[] { 0, 60, 60, 60, 60, 60 }, new int[] { 0, 255, 0, 255, 0, 255 });
                break;
            // ── UIKit-aligned impacts ───────────────────────────────────
            case "mediumImpact":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && isFullStrength() && hasPredefined(VibrationEffect.EFFECT_CLICK)) {
                    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK));
                } else playMapped(0.7f, 0.5f, 0.0);
                break;
            case "heavyImpact":
                if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && isFullStrength() && hasPredefined(VibrationEffect.EFFECT_HEAVY_CLICK)
                ) {
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
                        VibrationEffect.startComposition().addPrimitive(VibrationEffect.Composition.PRIMITIVE_THUD, scaled(0.7f)).compose()
                    );
                } else playMapped(0.7f, 0.2f, 0.0);
                break;
            case "rigidImpact":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && isFullStrength() && hasPredefined(VibrationEffect.EFFECT_CLICK)) {
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
                        VibrationEffect.startComposition().addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, scaled(1.0f)).compose()
                    );
                } else playMapped(0.5f, 1.0f, 0.0);
                break;
            case "detent":
                if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                    vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_TICK)
                ) {
                    vibrator.vibrate(
                        VibrationEffect.startComposition().addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, scaled(0.4f)).compose()
                    );
                } else playMapped(0.4f, 0.9f, 0.0);
                break;
            // ── Gestures (no direct Vibrator constants — mapped) ────────
            case "longPress":
                if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && isFullStrength() && hasPredefined(VibrationEffect.EFFECT_HEAVY_CLICK)
                ) {
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
                if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && isFullStrength() && hasPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK)
                ) {
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
                        VibrationEffect.startComposition()
                            .addPrimitive(VibrationEffect.Composition.PRIMITIVE_QUICK_FALL, scaled(0.4f))
                            .compose()
                    );
                } else playMapped(0.4f, 0.3f, 0.04);
                break;
            case "pop":
                if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                    vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_CLICK)
                ) {
                    vibrator.vibrate(
                        VibrationEffect.startComposition().addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, scaled(0.5f)).compose()
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
                        VibrationEffect.startComposition()
                            .addPrimitive(VibrationEffect.Composition.PRIMITIVE_LOW_TICK, scaled(1.0f))
                            .compose()
                    );
                } else playMapped(0.2f, 0.4f, 0.0);
                break;
            case "keyTap":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && isFullStrength() && hasPredefined(VibrationEffect.EFFECT_TICK)) {
                    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK));
                } else playMapped(0.3f, 0.85f, 0.0);
                break;
            case "bump":
                if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                    vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_THUD)
                ) {
                    vibrator.vibrate(
                        VibrationEffect.startComposition().addPrimitive(VibrationEffect.Composition.PRIMITIVE_THUD, scaled(0.6f)).compose()
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
        if (isMuted()) return;
        VibrationEffect effect = buildEffect(scaled(intensity), sharpness, duration, null);
        if (effect != null) vibrator.vibrate(effect);
        else if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            long ms = duration > 0 ? Math.max(1, (long) (duration * 1000)) : 20;
            vibrator.vibrate(ms);
        }
    }

    private void playPattern(long[] timings, int[] amplitudes) {
        if (isMuted()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            int[] scaledAmplitudes = new int[amplitudes.length];
            boolean hasNonZero = false;
            for (int i = 0; i < amplitudes.length; i++) {
                scaledAmplitudes[i] = scaledAmplitude(amplitudes[i]);
                if (scaledAmplitudes[i] > 0) hasNonZero = true;
            }
            if (!hasNonZero) return;
            vibrator.vibrate(VibrationEffect.createWaveform(timings, scaledAmplitudes, -1));
        } else {
            vibrator.vibrate(timings, -1);
        }
    }

    /**
     * Best-effort AHAP → Composition translation. Walks the Pattern array,
     * extracts HapticTransient events with Intensity/Sharpness parameters,
     * and chains them as Composition primitives spaced by Time deltas.
     */
    private boolean playAHAPJson(String json) throws Exception {
        VibrationEffect effect = buildEffectFromAHAP(json);
        if (effect == null) return false;
        vibrator.vibrate(effect);
        return true;
    }

    private VibrationEffect buildEffectFromAHAP(String json) throws Exception {
        JSONObject root = new JSONObject(json);
        JSONArray pattern = root.optJSONArray("Pattern");
        if (pattern == null || pattern.length() == 0) {
            throw new IllegalArgumentException("AHAP Pattern must be a non-empty array");
        }

        if (isMuted() || !canComposeAHAP()) return null;

        VibrationEffect.Composition composition = VibrationEffect.startComposition();
        double previousTime = 0;
        int eventsAdded = 0;

        for (int i = 0; i < pattern.length(); i++) {
            JSONObject entry = pattern.optJSONObject(i);
            if (entry == null) continue;
            JSONObject event = entry.optJSONObject("Event");
            if (event == null) continue;

            String type = event.optString("EventType", "");
            if (!"HapticTransient".equals(type) && !"HapticContinuous".equals(type)) {
                if (type.startsWith("Audio")) continue;
                throw new IllegalArgumentException("Unsupported AHAP EventType: " + type);
            }
            if ("HapticContinuous".equals(type) && !event.has("EventDuration")) {
                throw new IllegalArgumentException("HapticContinuous requires EventDuration");
            }

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
            if (time < 0) throw new IllegalArgumentException("AHAP event Time must be non-negative");
            int delayMs = (int) Math.max(0, Math.round((time - previousTime) * 1000));
            previousTime = time;

            // _androidPrimitive is our non-standard hint — chooses between
            // the 8 Composition primitives explicitly. Falls back to the
            // intensity/sharpness heuristic if unknown or unsupported.
            String hint = event.optString("_androidPrimitive", null);
            int op = primitiveForHint(hint);
            if (op == -1) op = primitiveForSharpness(sharpness, intensity);
            op = supportedPrimitiveOrFallback(op);
            if (op == -1) return null;

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
