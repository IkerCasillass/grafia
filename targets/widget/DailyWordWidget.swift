import SwiftUI
import WidgetKit

// Must match CONTENT_URL in src/daily.ts. The file contract is in
// grafia-corpus/docs/BACKEND.md, Stage 0.
let contentBase = "https://content.grafia.mx"

struct DailyFile: Codable {
  struct Word: Codable {
    let lemma: String
    let pos: String?
    let definition: String
    let example: String?
  }
  let date: String
  let word: Word
}

// The day is America/Mexico_City for everyone, never the phone's own zone.
private let mexico = TimeZone(identifier: "America/Mexico_City")!

private func mexicoDate(_ date: Date) -> String {
  let format = DateFormatter()
  format.locale = Locale(identifier: "en_US_POSIX")
  format.timeZone = mexico
  format.dateFormat = "yyyy-MM-dd"
  return format.string(from: date)
}

private func nextMexicoMidnight(after date: Date) -> Date {
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = mexico
  return calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: date))!
}

// No App Group: the extension keeps its own copy, so the word survives no signal.
private enum Cache {
  static func save(_ data: Data, for key: String) {
    UserDefaults.standard.set(data, forKey: "daily.\(key)")
  }

  static func load(_ key: String) -> DailyFile? {
    guard let data = UserDefaults.standard.data(forKey: "daily.\(key)") else { return nil }
    return try? JSONDecoder().decode(DailyFile.self, from: data)
  }
}

private func fetch(_ key: String) async -> DailyFile? {
  guard let url = URL(string: "\(contentBase)/palabra/\(key).json"),
        let (data, response) = try? await URLSession.shared.data(from: url),
        (response as? HTTPURLResponse)?.statusCode == 200,
        let file = try? JSONDecoder().decode(DailyFile.self, from: data),
        file.date == key
  else { return nil }
  Cache.save(data, for: key)
  return file
}

struct DailyEntry: TimelineEntry {
  let date: Date
  let file: DailyFile?
}

private let sample = DailyFile(
  date: "2026-11-06",
  word: .init(lemma: "crisálida", pos: "noun",
              definition: "Etapa donde la oruga se envuelve para transformarse en mariposa.",
              example: nil))

struct DailyProvider: TimelineProvider {
  func placeholder(in context: Context) -> DailyEntry { DailyEntry(date: .now, file: sample) }

  func getSnapshot(in context: Context, completion: @escaping (DailyEntry) -> Void) {
    completion(DailyEntry(date: .now, file: Cache.load(mexicoDate(.now)) ?? sample))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<DailyEntry>) -> Void) {
    Task {
      let now = Date.now
      let key = mexicoDate(now)
      let fresh = await fetch(key)
      let file = fresh ?? Cache.load(key)
      // A word in hand waits for tomorrow; a miss retries soon.
      let next = file != nil ? nextMexicoMidnight(after: now).addingTimeInterval(60)
                             : now.addingTimeInterval(30 * 60)
      completion(Timeline(entries: [DailyEntry(date: now, file: file)], policy: .after(next)))
    }
  }
}

private let partsOfSpeech = [
  "noun": "sustantivo", "adj": "adjetivo", "verb": "verbo", "adv": "adverbio",
]

struct DailyWordView: View {
  @Environment(\.widgetFamily) private var family
  let entry: DailyEntry

  var body: some View {
    if let file = entry.file {
      content(file)
    } else {
      VStack(alignment: .leading, spacing: 4) {
        kicker
        Text("Abre Grafía para ver la palabra de hoy.")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
  }

  private var kicker: some View {
    Text("PALABRA DEL DÍA")
      .font(.caption2.weight(.semibold))
      .foregroundStyle(accent)
  }

  @ViewBuilder
  private func content(_ file: DailyFile) -> some View {
    switch family {
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 1) {
        Text(file.word.lemma).font(.headline).fontDesign(.serif).lineLimit(1)
        Text(file.word.definition).font(.caption).lineLimit(2)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    case .systemMedium:
      VStack(alignment: .leading, spacing: 4) {
        kicker
        HStack(alignment: .firstTextBaseline, spacing: 6) {
          Text(file.word.lemma).font(.system(.title2, design: .serif)).lineLimit(1)
          if let pos = file.word.pos.flatMap({ partsOfSpeech[$0] }) {
            Text(pos).font(.caption).italic().foregroundStyle(.secondary)
          }
        }
        Text(file.word.definition).font(.subheadline).lineLimit(2)
        if let example = file.word.example {
          Text("«\(example)»").font(.caption).italic().foregroundStyle(.secondary).lineLimit(2)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    default:
      VStack(alignment: .leading, spacing: 4) {
        kicker
        Spacer(minLength: 0)
        Text(file.word.lemma)
          .font(.system(.title2, design: .serif))
          .minimumScaleFactor(0.6)
          .lineLimit(1)
        Text(file.word.definition)
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(3)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
  }
}

struct DailyWordWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "GrafiaDaily", provider: DailyProvider()) { entry in
      DailyWordView(entry: entry)
        .containerBackground(paper, for: .widget)
        .widgetURL(entry.file.map { URL(string: "grafia://palabra/\($0.date)")! } ?? searchURL)
    }
    .configurationDisplayName("Palabra del día")
    .description("Una palabra nueva cada día, la misma para todos. Tócala para guardarla.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
  }
}
