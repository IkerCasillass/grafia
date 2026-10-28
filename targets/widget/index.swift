import SwiftUI
import WidgetKit

@main
struct GrafiaWidgets: WidgetBundle {
  var body: some Widget {
    SearchWidget()
    DailyWordWidget()
    SearchControl()
  }
}
