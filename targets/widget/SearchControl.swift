import AppIntents
import SwiftUI
import WidgetKit

// A control lives in Control Center and on the lock screen, and iOS lets you
// assign one to the Action button: one press from anywhere, straight to search.
// Its intent is in _shared/OpenSearchIntent.swift.
struct SearchControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: "GrafiaSearchControl") {
      ControlWidgetButton(action: OpenSearchIntent()) {
        Label("Buscar palabra", systemImage: "text.magnifyingglass")
      }
    }
    .displayName("Buscar en Grafía")
    .description("Abre Grafía directo en la búsqueda.")
  }
}
