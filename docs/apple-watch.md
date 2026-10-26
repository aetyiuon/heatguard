# Apple Watch integration

This repository now contains a local iOS Expo module and a SwiftUI Watch companion source. These are not a signed or device-tested Watch release. The browser correctly disables connection; Expo Go and an existing development binary cannot load this new module. Android Health Connect remains outside this Apple-first implementation.

The iPhone reads the latest heart-rate sample from the last five minutes through HealthKit after a user-triggered authorization request. A completed permission sheet does not reveal whether HealthKit read permission was granted. Empty results remain unavailable. Phone polling runs every 15 seconds while foregrounded; source acquisition timestamps stay intact. This is **synced Apple Health**, not guaranteed live Apple Watch telemetry.

The installed Watch companion uses `HKWorkoutSession`, `HKLiveWorkoutBuilder` and `WatchConnectivity` to send actual recent workout heart rate to the paired iPhone while reachable. The phone can launch the companion with `startWatchApp(with:completion:)`; the Watch also has Start and End controls. Live samples become stale after 30 seconds. Delayed synced samples use a five-minute display policy. These are app freshness policies, not clinical thresholds. No fake pulse, hydration percentage, core-temperature estimate, medical anomaly detection or pulse-based extension of outdoor minutes is supplied.

## Build on a Mac

1. Install project dependencies from the lockfile. Preserve this repository's source and local configuration before generating native projects. Run `pnpm exec expo prebuild --platform ios` (do not use `--clean` on a native project containing manual work). Local Expo module discovery includes `modules/heatguard-health`; reinstall pods after native changes. Build the iPhone development client with Xcode or `pnpm ios`.
2. In the generated Xcode workspace, add a **watchOS App** target paired with the HeatGuard iOS app. Use bundle ID `org.heatguard.app.watchkitapp`, SwiftUI, watchOS 10 or later, the same signing team, and the iPhone companion bundle ID `org.heatguard.app`. This target creation/embedding must be performed in Xcode; it has not been generated or signed from this Windows workspace.
3. Replace the generated Watch app entry point with `watch/HeatGuardWatchApp.swift`. Do not compile that file in the iOS target. Apply the entries from `watch/Info.plist` to the Watch target (retain Xcode's generated bundle/version values) and use `watch/HeatGuardWatch.entitlements` for its entitlements. Enable HealthKit and background Workout Processing for that Watch target. The iPhone's HealthKit entitlement and read-purpose string are already in `app.json`.
4. Confirm the iOS target embeds the Watch app; pair a real iPhone and Apple Watch, choose matching provisioning profiles and build/install both. Health capabilities/signing availability depend on the developer account. Re-generating native projects can remove a manually added target; preserve the native project in the working branch after integration.
5. In HeatGuard, open Journey or My plan and tap **Connect Apple Health**. Grant/deny the actual system dialog deliberately. With the companion installed, tap **Start live Watch workout**, or start directly from the Watch. Real workouts compete with other Watch workout apps; finish any existing workout first. The companion starts an outdoor walking session; GPS recording and the app's exertion selection remain separate.
6. End on the Watch or disconnect on the phone while reachable. If the Watch is unreachable, use **End workout** on the Watch; phone disconnection cannot guarantee a remote stop. The companion discards its workout rather than saving a HeatGuard workout or route. Apple Health manages any underlying health records under its own permissions/settings.

## Required device acceptance

- Build Swift/iOS/watchOS targets, install, grant/deny/revoke heart-rate access, and confirm empty read results reveal no claimed permission state.
- Verify actual bpm acquisition times and source labels, delayed sync, 30-second live staleness, five-minute synced staleness, source switching and reconnect behavior.
- Test phone locked, Watch out of range, competing workouts, phone/Watch restart, End/disconnect, and no continuing session after a successful stop.
- Confirm heart-rate events remain local and in memory, never enter route weather/community/share payloads, and are cleared by disconnect and erase-all. Revocation is handled through Apple Health settings.
- Exercise VoiceOver, large text, battery use, missing sensors and secure device behavior. JS exports cannot validate any of these native paths.

Reference: [Apple workout sessions](https://developer.apple.com/documentation/healthkit/hkworkoutsession), [live workout builder](https://developer.apple.com/documentation/healthkit/hkliveworkoutbuilder), [starting the Watch companion](<https://developer.apple.com/documentation/healthkit/hkhealthstore/startwatchapp(with:completion:)>), [local Expo modules](https://docs.expo.dev/modules/get-started/).
