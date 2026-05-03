import Foundation
import CoreHaptics
import UIKit

/// Wraps CHHapticEngine for rich haptic playback on iOS (A13+).
public class RichHapticsEngine {
    private var engine: CHHapticEngine?
    private var supportsHaptics: Bool
    private var transientPlayers: [CHHapticPatternPlayer] = []
    private var continuousPlayers: [String: CHHapticAdvancedPatternPlayer] = [:]
    private var preloaded: [String: CHHapticPatternPlayer] = [:]
    private var audioResources: [String: CHHapticAudioResourceID] = [:]
    private var isEngineRunning = false

    /// Called whenever the engine resets and rebuilds itself (e.g. after audio session interruption).
    /// Preloaded players are invalidated and should be recreated.
    public var onReset: (() -> Void)?

    /// Last native error encountered (engine init, play call, etc.). Cleared on success.
    public private(set) var lastError: String?

    public init() {
        supportsHaptics = CHHapticEngine.capabilitiesForHardware().supportsHaptics
        if supportsHaptics {
            prepareEngine()
            registerLifecycleObservers()
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    public func isSupported() -> Bool {
        return supportsHaptics
    }

    public func diagnostics() -> [String: Any] {
        return [
            "engine": supportsHaptics ? "core-haptics" : "none",
            "engineRunning": isEngineRunning,
            "preloadedCount": preloaded.count,
            "activeContinuousPlayers": continuousPlayers.count,
            "registeredAudioCount": audioResources.count,
            "lastError": lastError as Any,
        ]
    }

    /// True if the user has not disabled haptics in OS settings.
    public func userEnabled() -> Bool {
        if UIAccessibility.isReduceMotionEnabled { return false }
        return true
    }

    // MARK: - Play single event

    public func play(intensity: Float, sharpness: Float, duration: Double) throws {
        guard supportsHaptics, let engine = engine else { return }

        let event = makeEvent(intensity: intensity, sharpness: sharpness, duration: duration, time: 0)
        try ensureRunning(engine)
        let pattern = try CHHapticPattern(events: [event], parameters: [])
        let player = try engine.makePlayer(with: pattern)
        try player.start(atTime: CHHapticTimeImmediate)
        transientPlayers.append(player)
    }

    // MARK: - Play AHAP

    public func playAHAP(name: String) throws {
        guard supportsHaptics, let engine = engine else { return }
        guard let url = Bundle.main.url(forResource: name, withExtension: "ahap") else {
            throw NSError(domain: "RichHaptics", code: 404, userInfo: [
                NSLocalizedDescriptionKey: "AHAP file '\(name).ahap' not found in bundle",
            ])
        }
        try ensureRunning(engine)
        try engine.playPattern(from: url)
    }

    public func playAHAP(json: String) throws {
        guard supportsHaptics, let engine = engine else { return }
        guard let data = json.data(using: .utf8) else {
            throw NSError(domain: "RichHaptics", code: 400, userInfo: [
                NSLocalizedDescriptionKey: "AHAP JSON could not be decoded as UTF-8",
            ])
        }
        try ensureRunning(engine)
        try engine.playPattern(from: data)
    }

    // MARK: - Stop

    public func stop() {
        for player in transientPlayers {
            try? player.stop(atTime: CHHapticTimeImmediate)
        }
        transientPlayers.removeAll()
        for (_, player) in continuousPlayers {
            try? player.stop(atTime: CHHapticTimeImmediate)
        }
        continuousPlayers.removeAll()
    }

    // MARK: - Live continuous players

    public func startContinuous(intensity: Float, sharpness: Float) throws -> String {
        guard supportsHaptics, let engine = engine else {
            throw NSError(domain: "RichHaptics", code: 501, userInfo: [
                NSLocalizedDescriptionKey: "Core Haptics not supported on this device",
            ])
        }
        try ensureRunning(engine)

        let event = CHHapticEvent(
            eventType: .hapticContinuous,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: clamp01(intensity)),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: clamp01(sharpness)),
            ],
            relativeTime: 0,
            duration: 100  // long; we'll stop manually
        )
        let pattern = try CHHapticPattern(events: [event], parameters: [])
        let player = try engine.makeAdvancedPlayer(with: pattern)
        try player.start(atTime: CHHapticTimeImmediate)

        let id = UUID().uuidString
        continuousPlayers[id] = player
        return id
    }

    public func updateParameters(id: String, intensity: Float?, sharpness: Float?) throws {
        guard let player = continuousPlayers[id] else {
            throw NSError(domain: "RichHaptics", code: 404, userInfo: [
                NSLocalizedDescriptionKey: "No continuous player with id '\(id)'",
            ])
        }
        var params: [CHHapticDynamicParameter] = []
        if let intensity = intensity {
            params.append(CHHapticDynamicParameter(
                parameterID: .hapticIntensityControl,
                value: clamp01(intensity),
                relativeTime: 0
            ))
        }
        if let sharpness = sharpness {
            params.append(CHHapticDynamicParameter(
                parameterID: .hapticSharpnessControl,
                value: clamp01(sharpness),
                relativeTime: 0
            ))
        }
        if params.isEmpty { return }
        try player.sendParameters(params, atTime: CHHapticTimeImmediate)
    }

    public func stopPlayer(id: String) throws {
        guard let player = continuousPlayers.removeValue(forKey: id) else { return }
        try player.stop(atTime: CHHapticTimeImmediate)
    }

    // MARK: - Preload

    public func preloadSimple(id: String, intensity: Float, sharpness: Float, duration: Double) throws {
        guard supportsHaptics, let engine = engine else { return }
        try ensureRunning(engine)
        let event = makeEvent(intensity: intensity, sharpness: sharpness, duration: duration, time: 0)
        let pattern = try CHHapticPattern(events: [event], parameters: [])
        let player = try engine.makePlayer(with: pattern)
        preloaded[id] = player
    }

    public func preloadAHAP(id: String, json: String) throws {
        guard supportsHaptics, let engine = engine else { return }
        guard let data = json.data(using: .utf8) else {
            throw NSError(domain: "RichHaptics", code: 400, userInfo: [
                NSLocalizedDescriptionKey: "AHAP JSON could not be decoded as UTF-8",
            ])
        }
        try ensureRunning(engine)
        guard let raw = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
            throw NSError(domain: "RichHaptics", code: 400, userInfo: [
                NSLocalizedDescriptionKey: "AHAP JSON root must be an object",
            ])
        }
        let dictionary = ahapKeyDict(raw)
        let pattern = try CHHapticPattern(dictionary: dictionary)
        let player = try engine.makePlayer(with: pattern)
        preloaded[id] = player
    }

    /// Recursively rewrap [String: Any] keys as CHHapticPattern.Key for `init(dictionary:)`.
    private func ahapKeyDict(_ dict: [String: Any]) -> [CHHapticPattern.Key: Any] {
        var result: [CHHapticPattern.Key: Any] = [:]
        for (key, value) in dict {
            let wrapped = CHHapticPattern.Key(rawValue: key)
            result[wrapped] = ahapValue(value)
        }
        return result
    }

    private func ahapValue(_ value: Any) -> Any {
        if let dict = value as? [String: Any] {
            return ahapKeyDict(dict)
        }
        if let array = value as? [Any] {
            return array.map { ahapValue($0) }
        }
        return value
    }

    public func playPreloaded(id: String) throws {
        guard let player = preloaded[id] else {
            throw NSError(domain: "RichHaptics", code: 404, userInfo: [
                NSLocalizedDescriptionKey: "No preloaded pattern with id '\(id)'",
            ])
        }
        guard let engine = engine else { return }
        try ensureRunning(engine)
        try player.start(atTime: CHHapticTimeImmediate)
    }

    public func unload(id: String) {
        if let player = preloaded.removeValue(forKey: id) {
            try? player.stop(atTime: CHHapticTimeImmediate)
        }
    }

    // MARK: - Audio resources

    public func registerAudio(id: String, filename: String) throws {
        guard supportsHaptics, let engine = engine else { return }
        let url: URL
        let parts = filename.split(separator: ".")
        if parts.count >= 2 {
            let name = parts.dropLast().joined(separator: ".")
            let ext = String(parts.last!)
            guard let resolved = Bundle.main.url(forResource: name, withExtension: ext) else {
                throw NSError(domain: "RichHaptics", code: 404, userInfo: [
                    NSLocalizedDescriptionKey: "Audio file '\(filename)' not found in bundle",
                ])
            }
            url = resolved
        } else {
            guard let resolved = Bundle.main.url(forResource: filename, withExtension: nil) else {
                throw NSError(domain: "RichHaptics", code: 404, userInfo: [
                    NSLocalizedDescriptionKey: "Audio file '\(filename)' not found in bundle",
                ])
            }
            url = resolved
        }

        let resourceID = try engine.registerAudioResource(url, options: [:])
        audioResources[id] = resourceID
    }

    // MARK: - Engine lifecycle

    private func prepareEngine() {
        do {
            engine = try CHHapticEngine()
            engine?.isAutoShutdownEnabled = true
            engine?.playsHapticsOnly = false  // allow audio for AHAP audio events

            engine?.stoppedHandler = { [weak self] _ in
                self?.isEngineRunning = false
            }
            engine?.resetHandler = { [weak self] in
                guard let self = self else { return }
                self.isEngineRunning = false
                // Preloaded players bound to the previous engine state are now invalid.
                self.preloaded.removeAll()
                self.continuousPlayers.removeAll()
                try? self.engine?.start()
                self.isEngineRunning = true
                self.onReset?()
            }

            try engine?.start()
            isEngineRunning = true
        } catch {
            lastError = "Engine init: \(error.localizedDescription)"
            NSLog("[RichHaptics] Engine init error: \(error)")
        }
    }

    private func ensureRunning(_ engine: CHHapticEngine) throws {
        if !isEngineRunning {
            try engine.start()
            isEngineRunning = true
        }
    }

    private func registerLifecycleObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleResign),
            name: UIApplication.willResignActiveNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleForeground),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
    }

    @objc private func handleResign() {
        engine?.stop(completionHandler: nil)
        isEngineRunning = false
    }

    @objc private func handleForeground() {
        guard supportsHaptics, let engine = engine else { return }
        try? engine.start()
        isEngineRunning = true
    }

    // MARK: - Helpers

    private func makeEvent(intensity: Float, sharpness: Float, duration: Double, time: TimeInterval) -> CHHapticEvent {
        let i = clamp01(intensity)
        let s = clamp01(sharpness)
        if duration <= 0 {
            return CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: i),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: s),
                ],
                relativeTime: time
            )
        } else {
            return CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: i),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: s),
                ],
                relativeTime: time,
                duration: TimeInterval(duration)
            )
        }
    }

    private func clamp01(_ v: Float) -> Float {
        return max(0, min(1, v))
    }
}
