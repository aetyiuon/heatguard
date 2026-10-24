import SwiftUI
import HealthKit
import WatchConnectivity
import WatchKit

@main
struct HeatGuardWatchApp: App {
  @WKApplicationDelegateAdaptor(WorkoutDelegate.self) var delegate
  var body: some Scene {
    WindowGroup {
      WatchPanel()
    }
  }
}
struct WatchPanel: View {
  @ObservedObject private var workout = WorkoutStore.shared
  var body: some View {
      VStack(spacing: 12) {
        Image(systemName: "sun.max").foregroundStyle(.orange)
        Text("HeatGuard").font(.headline)
        Text(workout.bpm.map { "\(Int($0)) bpm" } ?? "— bpm").font(.title2)
        Text(workout.message).font(.caption)
        Button("Start outdoor walk") { workout.start() }
        Button("End workout") { workout.end() }.tint(.orange)
        Text("Pulse is context, not a heat-safety limit.").font(.caption2)
      }.padding()
  }
}
final class WorkoutDelegate: NSObject, WKApplicationDelegate {
  func handle(_ workoutConfiguration: HKWorkoutConfiguration) { WorkoutStore.shared.start(workoutConfiguration) }
}
final class WorkoutStore: NSObject, ObservableObject, HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate, WCSessionDelegate {
  static let shared = WorkoutStore()
  @Published var bpm: Double?
  @Published var message = "Optional live pulse to paired iPhone"
  private let health = HKHealthStore()
  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?
  private var starting = false
  override init() {
    super.init()
    if WCSession.isSupported() { WCSession.default.delegate = self; WCSession.default.activate() }
  }
  func start(_ configuration: HKWorkoutConfiguration? = nil) {
    guard session == nil, !starting, let pulse = HKQuantityType.quantityType(forIdentifier: .heartRate) else { return }
    starting = true
    health.requestAuthorization(toShare: [HKObjectType.workoutType()], read: [pulse]) { success, error in
      DispatchQueue.main.async {
        self.starting = false
        guard success, error == nil else { self.message = "Check Health permissions"; return }
        let config = configuration ?? HKWorkoutConfiguration()
        if configuration == nil { config.activityType = .walking; config.locationType = .outdoor }
        do {
          let session = try HKWorkoutSession(healthStore: self.health, configuration: config)
          let builder = session.associatedWorkoutBuilder()
          self.session = session; self.builder = builder
          session.delegate = self; builder.delegate = self
          builder.dataSource = HKLiveWorkoutDataSource(healthStore: self.health, workoutConfiguration: config)
          let start = Date(); session.startActivity(with: start)
          builder.beginCollection(withStart: start) { success, error in
            if !success || error != nil { DispatchQueue.main.async { self.message = "Workout collection unavailable"; self.end() } }
          }
          self.message = "Workout active · sending recent pulse"
        } catch { self.message = error.localizedDescription }
      }
    }
  }
  func end() { session?.end(); bpm = nil }
  func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {
    guard toState == .ended else { return }
    builder?.endCollection(withEnd: date) { _, _ in
      // Do not save a hidden workout or route to Health; this opt-in session supplies live pulse only.
      self.builder?.discardWorkout()
      DispatchQueue.main.async { self.builder = nil; self.session = nil; self.bpm = nil; self.message = "Workout ended" }
    }
  }
  func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) { DispatchQueue.main.async { self.message = error.localizedDescription; self.end() } }
  func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
  func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
    guard let type = HKQuantityType.quantityType(forIdentifier: .heartRate), collectedTypes.contains(type), let stats = workoutBuilder.statistics(for: type), let quantity = stats.mostRecentQuantity(), let interval = stats.mostRecentQuantityDateInterval() else { return }
    let value = quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
    let at = interval.end.timeIntervalSince1970 * 1000
    DispatchQueue.main.async {
      self.bpm = value
      if WCSession.default.isReachable { WCSession.default.sendMessage(["kind":"heartRate", "bpm":value, "at":at], replyHandler:nil) { _ in DispatchQueue.main.async { self.message = "Phone unreachable · use Watch End to stop" } } }
      else { self.message = "Phone unreachable · use Watch End to stop" }
    }
  }
  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
  func session(_ session: WCSession, didReceiveMessage message: [String:Any], replyHandler: @escaping ([String:Any])->Void) {
    guard message["command"] as? String == "stop" else { replyHandler(["ok":false]); return }
    DispatchQueue.main.async { self.end(); replyHandler(["ok":true]) }
  }
}
