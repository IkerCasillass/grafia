import SwiftUI
import WidgetKit

// The app opens this on the search screen, empty, with the keyboard up.
let searchURL = URL(string: "grafia://buscar")!

private let accent = Color(UIColor { traits in
  traits.userInterfaceStyle == .dark
    ? UIColor(red: 0.83, green: 0.60, blue: 0.45, alpha: 1)
    : UIColor(red: 0.54, green: 0.29, blue: 0.16, alpha: 1)
})

private let paper = Color(UIColor { traits in
  traits.userInterfaceStyle == .dark
    ? UIColor(red: 0.08, green: 0.07, blue: 0.07, alpha: 1)
    : UIColor(red: 0.98, green: 0.97, blue: 0.96, alpha: 1)
})

// Nothing to refresh: the widget is a door into the app, not a display.
struct StaticProvider: TimelineProvider {
  func placeholder(in context: Context) -> SimpleEntry { SimpleEntry(date: .now) }
  func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
    completion(SimpleEntry(date: .now))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
    completion(Timeline(entries: [SimpleEntry(date: .now)], policy: .never))
  }
}

struct SimpleEntry: TimelineEntry {
  let date: Date
}

struct SearchWidgetView: View {
  @Environment(\.widgetFamily) private var family

  var body: some View {
    switch family {
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        Image(systemName: "text.magnifyingglass").font(.title2)
      }
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 2) {
        Text("Grafía").font(.headline).fontDesign(.serif)
        Label("Buscar palabra", systemImage: "text.magnifyingglass").font(.caption)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    case .accessoryInline:
      Label("Buscar en Grafía", systemImage: "text.magnifyingglass")
    default:
      VStack(alignment: .leading) {
        Text("Grafía")
          .font(.system(.subheadline, design: .serif))
          .foregroundStyle(.secondary)
        Spacer()
        Image(systemName: "text.magnifyingglass")
          .font(.system(size: 30, weight: .medium))
          .foregroundStyle(accent)
        Text("¿Qué palabra encontraste?")
          .font(.system(.headline, design: .serif))
          .lineLimit(2)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
  }
}

struct SearchWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "GrafiaSearch", provider: StaticProvider()) { _ in
      SearchWidgetView()
        .containerBackground(paper, for: .widget)
        .widgetURL(searchURL)
    }
    .configurationDisplayName("Buscar palabra")
    .description("Abre Grafía directo en la búsqueda, con el teclado listo.")
    .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}
