import Foundation
import Capacitor

@objc(RichHapticsPlugin)
public class RichHapticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RichHapticsPlugin"
    public let jsName = "RichHaptics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "preset", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playPattern", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playAHAP", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playAHAPFromString", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startContinuous", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateParameters", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopPlayer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "preload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playPreloaded", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "registerAudio", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDiagnostics", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setIntensityScale", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getIntensityScale", returnType: CAPPluginReturnPromise),
    ]

    private let haptics = RichHapticsEngine()
    private var enabled = true
    private var intensityScale: Float = 1.0

    public override func load() {
        super.load()
        haptics.onReset = { [weak self] in
            self?.notifyListeners("engineDidReset", data: [:])
        }
    }

    @objc func isSupported(_ call: CAPPluginCall) {
        let supported = haptics.isSupported()
        call.resolve([
            "supported": supported,
            "engine": supported ? "core-haptics" : "none",
            "userEnabled": haptics.userEnabled(),
        ])
    }

    @objc func play(_ call: CAPPluginCall) {
        if !enabled { call.resolve(); return }
        let intensity = (call.getFloat("intensity") ?? 1.0) * intensityScale
        let sharpness = call.getFloat("sharpness") ?? 0.5
        let duration = call.getDouble("duration") ?? 0.0

        do {
            try haptics.play(intensity: intensity, sharpness: sharpness, duration: duration)
            call.resolve()
        } catch {
            call.reject("Haptic play error: \(error.localizedDescription)")
        }
    }

    @objc func preset(_ call: CAPPluginCall) {
        if !enabled { call.resolve(); return }
        guard let name = call.getString("name") else {
            call.reject("Must provide preset name")
            return
        }

        let (rawIntensity, sharpness, duration) = Self.presetParams(name)
        let intensity = rawIntensity * intensityScale
        do {
            try haptics.play(intensity: intensity, sharpness: sharpness, duration: duration)
            call.resolve()
        } catch {
            call.reject("Haptic preset error: \(error.localizedDescription)")
        }
    }

    @objc func playPattern(_ call: CAPPluginCall) {
        if !enabled { call.resolve(); return }
        guard let pattern = call.getObject("pattern") else {
            call.reject("Must provide AHAP pattern object")
            return
        }
        do {
            let sanitized = Self.sanitizeForCoreHaptics(pattern)
            let scaled = Self.applyIntensityScale(sanitized, scale: intensityScale)
            let data = try JSONSerialization.data(withJSONObject: scaled, options: [])
            guard let json = String(data: data, encoding: .utf8) else {
                call.reject("Pattern could not be serialized to JSON")
                return
            }
            try haptics.playAHAP(json: json)
            call.resolve()
        } catch {
            call.reject("playPattern error: \(error.localizedDescription)")
        }
    }

    @objc func playAHAP(_ call: CAPPluginCall) {
        if !enabled { call.resolve(); return }
        guard let name = call.getString("name") else {
            call.reject("Must provide AHAP file name")
            return
        }
        do {
            try haptics.playAHAP(name: name)
            call.resolve()
        } catch {
            call.reject("AHAP error: \(error.localizedDescription)")
        }
    }

    @objc func playAHAPFromString(_ call: CAPPluginCall) {
        if !enabled { call.resolve(); return }
        guard let json = call.getString("json") else {
            call.reject("Must provide AHAP JSON string")
            return
        }
        do {
            try haptics.playAHAP(json: json)
            call.resolve()
        } catch {
            call.reject("AHAP error: \(error.localizedDescription)")
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        haptics.stop()
        call.resolve()
    }

    @objc func startContinuous(_ call: CAPPluginCall) {
        if !enabled { call.resolve(["id": "disabled"]); return }
        let intensity = (call.getFloat("intensity") ?? 0.5) * intensityScale
        let sharpness = call.getFloat("sharpness") ?? 0.5
        do {
            let id = try haptics.startContinuous(intensity: intensity, sharpness: sharpness)
            call.resolve(["id": id])
        } catch {
            call.reject("startContinuous error: \(error.localizedDescription)")
        }
    }

    @objc func updateParameters(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("Must provide player id")
            return
        }
        let intensity: Float? = call.hasOption("intensity")
            ? (call.getFloat("intensity") ?? 0.5) * intensityScale
            : nil
        let sharpness: Float? = call.hasOption("sharpness") ? call.getFloat("sharpness") : nil
        do {
            try haptics.updateParameters(id: id, intensity: intensity, sharpness: sharpness)
            call.resolve()
        } catch {
            call.reject("updateParameters error: \(error.localizedDescription)")
        }
    }

    @objc func stopPlayer(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("Must provide player id")
            return
        }
        do {
            try haptics.stopPlayer(id: id)
            call.resolve()
        } catch {
            call.reject("stopPlayer error: \(error.localizedDescription)")
        }
    }

    @objc func preload(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("Must provide id")
            return
        }
        do {
            if let pattern = call.getObject("pattern") {
                let sanitized = Self.sanitizeForCoreHaptics(pattern)
                let scaled = Self.applyIntensityScale(sanitized, scale: intensityScale)
                let data = try JSONSerialization.data(withJSONObject: scaled, options: [])
                guard let json = String(data: data, encoding: .utf8) else {
                    call.reject("Pattern could not be serialized to JSON")
                    return
                }
                try haptics.preloadAHAP(id: id, json: json)
            } else {
                let intensity = (call.getFloat("intensity") ?? 1.0) * intensityScale
                let sharpness = call.getFloat("sharpness") ?? 0.5
                let duration = call.getDouble("duration") ?? 0.0
                try haptics.preloadSimple(id: id, intensity: intensity, sharpness: sharpness, duration: duration)
            }
            call.resolve()
        } catch {
            call.reject("preload error: \(error.localizedDescription)")
        }
    }

    @objc func playPreloaded(_ call: CAPPluginCall) {
        if !enabled { call.resolve(); return }
        guard let id = call.getString("id") else {
            call.reject("Must provide id")
            return
        }
        do {
            try haptics.playPreloaded(id: id)
            call.resolve()
        } catch {
            call.reject("playPreloaded error: \(error.localizedDescription)")
        }
    }

    @objc func unload(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("Must provide id")
            return
        }
        haptics.unload(id: id)
        call.resolve()
    }

    @objc func getDiagnostics(_ call: CAPPluginCall) {
        call.resolve(haptics.diagnostics())
    }

    @objc func registerAudio(_ call: CAPPluginCall) {
        guard let id = call.getString("id"),
              let filename = call.getString("filename") else {
            call.reject("Must provide id and filename")
            return
        }
        do {
            try haptics.registerAudio(id: id, filename: filename)
            call.resolve()
        } catch {
            call.reject("registerAudio error: \(error.localizedDescription)")
        }
    }

    @objc func setEnabled(_ call: CAPPluginCall) {
        let value = call.getBool("enabled") ?? true
        enabled = value
        if !value { haptics.stop() }
        call.resolve()
    }

    @objc func isEnabled(_ call: CAPPluginCall) {
        call.resolve(["enabled": enabled])
    }

    @objc func setIntensityScale(_ call: CAPPluginCall) {
        let raw = call.getFloat("scale") ?? 1.0
        intensityScale = max(0.0, min(1.0, raw))
        call.resolve()
    }

    @objc func getIntensityScale(_ call: CAPPluginCall) {
        call.resolve(["scale": intensityScale])
    }

    /// Strip non-standard `_androidPrimitive` hint keys before handing the
    /// pattern to Core Haptics. Apple's AHAP parser ignores most unknown keys
    /// but we shouldn't rely on it — keep the contract tight.
    private static func sanitizeForCoreHaptics(_ obj: Any) -> Any {
        if var dict = obj as? [String: Any] {
            dict.removeValue(forKey: "_androidPrimitive")
            for (k, v) in dict {
                dict[k] = sanitizeForCoreHaptics(v)
            }
            return dict
        }
        if let arr = obj as? [Any] {
            return arr.map { sanitizeForCoreHaptics($0) }
        }
        return obj
    }

    /// Walk an AHAP dictionary and multiply every `HapticIntensity`
    /// EventParameter and `HapticIntensityControl` curve point by `scale`.
    /// Idempotent for `scale == 1.0`. Skips audio parameters.
    private static func applyIntensityScale(_ obj: Any, scale: Float) -> Any {
        if scale == 1.0 { return obj }
        if let dict = obj as? [String: Any] {
            // Event parameter: { ParameterID: 'HapticIntensity', ParameterValue: <num> }
            if let pid = dict["ParameterID"] as? String,
               (pid == "HapticIntensity" || pid == "HapticIntensityControl"),
               let v = dict["ParameterValue"] as? Double {
                var copy = dict
                copy["ParameterValue"] = max(0.0, min(1.0, v * Double(scale)))
                return copy
            }
            var out: [String: Any] = [:]
            for (k, v) in dict { out[k] = applyIntensityScale(v, scale: scale) }
            return out
        }
        if let arr = obj as? [Any] {
            return arr.map { applyIntensityScale($0, scale: scale) }
        }
        return obj
    }

    private static func presetParams(_ name: String) -> (Float, Float, Double) {
        switch name {
        // Original 7
        case "softTap":     return (0.6, 0.3, 0.0)
        case "sharpClick":  return (1.0, 1.0, 0.0)
        case "scrollTick":  return (0.3, 1.0, 0.0)
        case "gentlePulse": return (0.5, 0.0, 0.4)
        case "success":     return (0.8, 0.5, 0.0)
        case "warning":     return (0.7, 0.8, 0.15)
        case "error":       return (1.0, 0.9, 0.25)
        // UIKit-aligned impacts
        case "mediumImpact":    return (0.7, 0.5, 0.0)
        case "heavyImpact":     return (1.0, 0.7, 0.0)
        case "softImpact":      return (0.7, 0.2, 0.0)
        case "rigidImpact":     return (1.0, 1.0, 0.0)
        // Selection / picker
        case "selectionStrong": return (0.5, 1.0, 0.0)
        case "detent":          return (0.4, 0.9, 0.0)
        // Gestures
        case "longPress":       return (0.8, 0.5, 0.0)
        case "dragStart":       return (0.6, 0.5, 0.0)
        case "dragEnd":         return (0.6, 0.3, 0.0)
        // Lighter notification family
        case "confirm":         return (0.6, 0.6, 0.0)
        case "reject":          return (0.7, 0.7, 0.05)
        case "info":            return (0.5, 0.7, 0.0)
        case "alert":           return (0.7, 0.85, 0.0)
        // Toggle
        case "toggleOn":        return (0.7, 0.9, 0.0)
        case "toggleOff":       return (0.5, 0.4, 0.0)
        // UI actions
        case "expand":          return (0.4, 0.5, 0.0)
        case "collapse":        return (0.4, 0.3, 0.04)
        case "pop":             return (0.5, 0.95, 0.0)
        // Specific physical metaphors
        case "subtle":          return (0.2, 0.4, 0.0)
        case "keyTap":          return (0.3, 0.85, 0.0)
        case "bump":            return (0.6, 0.15, 0.04)
        case "loadingPulse":    return (0.3, 0.0, 0.8)
        default:                return (0.7, 0.5, 0.0)
        }
    }
}
