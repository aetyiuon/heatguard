import ExpoModulesCore
import HealthKit
import WatchConnectivity

public class HeatGuardHealthModule: Module {
  private let health = HKHealthStore()
  private var bridge: WatchBridge?
  public func definition() -> ModuleDefinition {
    Name("HeatGuardHealth")
    Events("heartRate")
    OnCreate { self.bridge = WatchBridge { [weak self] sample in self?.sendEvent("heartRate", sample) } }
    Function("available") { HKHealthStore.isHealthDataAvailable() }
    Function("watchInstalled") { self.bridge?.installed ?? false }
    AsyncFunction("connect") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable(), let type = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
        promise.reject("UNAVAILABLE", "HealthKit is unavailable"); return
      }
      // HealthKit deliberately does not reveal whether read access was granted.
      self.health.requestAuthorization(toShare: [], read: [type]) { completed, error in
        if let error = error { promise.reject("AUTH", error.localizedDescription) }
        else if completed { promise.resolve(true) }
        else { promise.reject("AUTH", "Authorization request did not complete") }
      }
    }
    AsyncFunction("latest") { (promise: Promise) in
      guard let type = HKQuantityType.quantityType(forIdentifier: .heartRate) else { promise.resolve(nil); return }
      let predicate = HKQuery.predicateForSamples(withStart: Date().addingTimeInterval(-300), end: Date(), options: .strictStartDate)
      let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: 1, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]) { _, samples, error in
        if let error = error { promise.reject("READ", error.localizedDescription); return }
        guard let sample = samples?.first as? HKQuantitySample else { promise.resolve(nil); return }
        promise.resolve(["bpm": sample.quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute())), "at": sample.endDate.timeIntervalSince1970 * 1000, "source": "apple-health"] as [String: Any])
      }
      self.health.execute(query)
    }
    AsyncFunction("launchWatch") { (promise: Promise) in
      guard self.bridge?.installed == true else { promise.reject("WATCH", "Install the paired Watch companion"); return }
      let config = HKWorkoutConfiguration()
      config.activityType = .walking
      config.locationType = .outdoor
      self.health.startWatchApp(with: config) { success, error in
        if success { promise.resolve(true) }
        else { promise.reject("WATCH", error?.localizedDescription ?? "Could not start Watch app") }
      }
    }
    AsyncFunction("stopWatch") { (promise: Promise) in
      guard let bridge = self.bridge else { promise.resolve(true); return }
      bridge.stop { error in
        if let error = error { promise.reject("WATCH", error.localizedDescription) }
        else { promise.resolve(true) }
      }
    }
  }
}

private final class WatchBridge: NSObject, WCSessionDelegate {
  private let receive: ([String: Any]) -> Void
  var installed: Bool { WCSession.isSupported() && WCSession.default.activationState == .activated && WCSession.default.isPaired && WCSession.default.isWatchAppInstalled }
  init(receive: @escaping ([String: Any]) -> Void) {
    self.receive = receive
    super.init()
    if WCSession.isSupported() { WCSession.default.delegate = self; WCSession.default.activate() }
  }
  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) { session.activate() }
  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    guard message["kind"] as? String == "heartRate", let bpm = message["bpm"] as? Double, let at = message["at"] as? Double,
          bpm >= 25, bpm <= 250, at <= Date().timeIntervalSince1970 * 1000 + 5000,
          at >= Date().timeIntervalSince1970 * 1000 - 30000 else { return }
    DispatchQueue.main.async { self.receive(["bpm": bpm, "at": at, "source": "apple-watch-live"]) }
  }
  func stop(completion: @escaping (Error?) -> Void) {
    guard installed, WCSession.default.isReachable else {
      completion(NSError(domain: "HeatGuardWatch", code: 1, userInfo: [NSLocalizedDescriptionKey: "Watch unreachable; end the workout on the Watch"])); return
    }
    WCSession.default.sendMessage(["command": "stop"], replyHandler: { _ in completion(nil) }, errorHandler: completion)
  }
}
