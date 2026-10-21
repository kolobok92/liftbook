import SwiftUI
import WidgetKit

// Liftbook's lock-screen card, replacing expo-live-activity's own LiveActivityView.swift
// (copied over it by plugins/withElapsedLiveActivity.js). Modelled on Boostcamp's: a quiet header
// with the app name and the elapsed clock, then the current exercise with a round photo.
// Keep the type names and the memberwise init: LiveActivityWidget.swift constructs
// LiveActivityView(contentState:attributes:).

#if canImport(ActivityKit)

  struct ConditionalForegroundViewModifier: ViewModifier {
    let color: String?

    func body(content: Content) -> some View {
      if let color = color {
        content.foregroundStyle(Color(hex: color))
      } else {
        content
      }
    }
  }

  struct DebugLog: View {
    init(_: String) {}
    var body: some View { EmptyView() }
  }

  struct LiveActivityView: View {
    let contentState: LiveActivityAttributes.ContentState
    let attributes: LiveActivityAttributes

    private var accent: Color {
      attributes.progressViewTint.map { Color(hex: $0) } ?? Color.yellow
    }

    var body: some View {
      VStack(alignment: .leading, spacing: 10) {
        HStack(spacing: 6) {
          Image(systemName: "dumbbell.fill")
            .font(.caption)
            .foregroundStyle(accent)
          Text("LIFTBOOK")
            .font(.caption)
            .fontWeight(.semibold)
            .foregroundStyle(Color.white.opacity(0.85))
          Spacer()
          if let start = contentState.timerEndDateInMilliseconds {
            // Counts up from the workout start (pauses excluded); iOS keeps it ticking.
            Text(timerInterval: Date.elapsedInterval(miliseconds: start), countsDown: false)
              .font(.subheadline.monospacedDigit())
              .fontWeight(.semibold)
              .foregroundStyle(accent)
              .multilineTextAlignment(.trailing)
              .frame(maxWidth: 96, alignment: .trailing)
          } else {
            Text("Paused")
              .font(.subheadline)
              .foregroundStyle(Color.white.opacity(0.6))
          }
        }

        HStack(spacing: 12) {
          if let imageName = contentState.imageName {
            Image.dynamic(assetNameOrPath: imageName)
              .resizable()
              .scaledToFill()
              .frame(width: 44, height: 44)
              .clipShape(Circle())
          }
          VStack(alignment: .leading, spacing: 2) {
            Text(contentState.title)
              .font(.headline)
              .foregroundStyle(Color.white)
              .lineLimit(1)
            if let subtitle = contentState.subtitle {
              Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(Color.white.opacity(0.65))
                .lineLimit(1)
            }
          }
          Spacer(minLength: 0)
        }

        if contentState.timerEndDateInMilliseconds == nil, let progress = contentState.progress {
          ProgressView(value: progress)
            .tint(accent)
        }
      }
      .padding(16)
    }
  }

#endif
