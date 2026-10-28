import AppIntents
import Foundation

// Linked into both the app and the widget (that is what _shared does): with
// openAppWhenRun, iOS launches Grafía and runs this inside the app. Living only
// in the widget extension, it ran there and could not open the app at all.
@available(iOS 18.0, *)
struct OpenSearchIntent: ControlConfigurationIntent {
  static let title: LocalizedStringResource = "Buscar palabra"
  static let description = IntentDescription("Abre Grafía en la búsqueda.")
  static let isDiscoverable = true
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(URL(string: "grafia://buscar")!))
  }
}
