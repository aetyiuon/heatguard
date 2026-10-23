# Free iPhone testing — saved for later

Saved October 22, 2026. No SDK upgrade or Apple/Expo account setup was performed when saving these notes.

## Expo Go from Windows

Expo Go is the free route for previewing supported native screens and interactions on an iPhone without an Apple Developer Program membership.

HeatGuard currently uses Expo SDK 57. As checked on October 22, 2026, the current Expo Go uses SDK 58 and supports only the latest SDK. Before using this route, upgrade HeatGuard deliberately, align dependencies, and verify the app. Recheck the current supported SDK when returning to this task.

1. Install Expo Go on the iPhone and create a free Expo account: https://expo.dev/go.
2. From this project directory, upgrade to the SDK supported by Expo Go. The commands for SDK 58 are:

   ```powershell
   pnpm add expo@^58.0.0
   pnpm exec expo install --fix
   pnpm dlx expo-doctor
   ```

   Review the SDK release notes, resolve compatibility issues, and run type checking, tests, and exports before proceeding.
3. Connect the iPhone and Windows computer to the same Wi-Fi. Run `ipconfig` and find the computer's Wi-Fi IPv4 address.
4. Set `EXPO_PUBLIC_API_URL` in `.env` to `http://YOUR_COMPUTER_LAN_IP:8787`. Do not use localhost for the phone's API connection. Keep provider secrets on the backend.
5. Start the API in one terminal with `pnpm proxy`.
6. In a second terminal, run:

   ```powershell
   pnpm exec expo login
   pnpm exec expo start --go
   ```

7. Sign into Expo Go with the same Expo account. Scan the terminal QR code with the iPhone Camera and open it in Expo Go. Accept the local-network prompt if shown. If Windows Firewall asks, allow the development servers on the trusted private network.

Expo Go is useful for map, screen, and foreground interaction checks. It does not replace acceptance testing of HeatGuard's own signed app, its permissions/configuration, or background monitoring. An Expo tunnel only exposes Metro; it does not automatically expose the separate API on port 8787.

Sources:
- https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
- https://docs.expo.dev/get-started/start-developing/
- https://docs.expo.dev/more/expo-cli/
- https://docs.expo.dev/versions/latest/sdk/map-view/

## Free native installation with access to a Mac

Xcode can install an app on a personal iPhone using a free Apple Account/Personal Team. Provisioning expires after seven days, requiring rebuild and reinstall; supported capabilities are limited. This requires a Mac with Xcode, and is separate from the Windows/Expo Go route.

Source: https://developer.apple.com/help/account/basics/about-your-developer-account

## Later distribution

The project already contains development, preview, and production EAS build profiles. Signed EAS iPhone builds and TestFlight distribution require the appropriate Apple Developer Program membership and project/signing setup. Use a deployed HTTPS API for distributed builds; verify maps, location grant/deny, notification behavior, storage, offline behavior, accessibility, and background scheduling on physical devices before release.

Sources:
- https://docs.expo.dev/build/setup/
- https://docs.expo.dev/build/internal-distribution/
- https://docs.expo.dev/submit/ios/
