# iPhone testing

## Immediate mobile-web preview

Open https://heatguard-tan.vercel.app/ in Safari. This exercises the live web app without a native installation. Check the six tabs, maps, route weather, language and large-text layouts. It does not verify HealthKit, Watch connectivity or native notification delivery.

## Native development build

HeatGuard pins Expo SDK 57 and includes a custom iOS HealthKit module. Use a development build containing that module for native acceptance; Expo Go cannot load it. Recheck the installed Expo Go/SDK compatibility before attempting an optional screen-only preview. Do not upgrade the SDK just to follow an old checklist.

1. Install the project's pinned dependencies. A local iOS build requires a Mac with Xcode; review [Apple's current account and capability requirements](https://developer.apple.com/help/account/basics/about-your-developer-account).
2. Copy the placeholder environment files. Set EXPO_PUBLIC_API_URL to an HTTPS backend for distributed builds, or the computer's LAN address and port 8787 for local development. Localhost on a phone means the phone.
3. On a trusted local network, run `pnpm proxy` and then `pnpm start`. An Expo tunnel exposes Metro, not the separate API automatically.
4. On the Mac, build with `pnpm ios`, or use the configured EAS development profile after setting up the project/signing account. Preserve manual native work before running prebuild. Do not use a clean regeneration on a project containing a manually added Watch target.
5. Install the actual build on a physical iPhone and test grant/deny/revoke flows, maps, foreground location, notifications, storage, offline states, accessibility and lock/resume behavior. See [Apple Watch](apple-watch.md) for the additional paired-device setup and [Verification](verification.md) for pending acceptance.

Free Apple Account signing has capability/provisioning limitations; do not assume it supports every HeatGuard capability. Verify Apple's current rules before choosing the signing path. TestFlight/EAS distribution requires the appropriate account, capabilities and signing setup. No account provisioning or SDK upgrade is part of this cleanup.

References: [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/), [Expo build setup](https://docs.expo.dev/build/setup/), [SDK upgrades](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/), [internal distribution](https://docs.expo.dev/build/internal-distribution/), [iOS submission](https://docs.expo.dev/submit/ios/).
