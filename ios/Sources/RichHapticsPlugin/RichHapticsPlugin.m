#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(RichHapticsPlugin, "RichHaptics",
    CAP_PLUGIN_METHOD(isSupported, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(play, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(preset, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(playPattern, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(playAHAP, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(playAHAPFromString, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stop, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(startContinuous, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(updateParameters, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopPlayer, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(preload, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(playPreloaded, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(unload, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(registerAudio, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getDiagnostics, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setEnabled, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(isEnabled, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setIntensityScale, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getIntensityScale, CAPPluginReturnPromise);
)
