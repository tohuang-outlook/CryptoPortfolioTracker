import AppKit
import Foundation

let outputPath = CommandLine.arguments.dropFirst().first
  ?? "build-assets/app-icon.png"
let outputURL = URL(fileURLWithPath: outputPath)
let directoryURL = outputURL.deletingLastPathComponent()

try FileManager.default.createDirectory(
  at: directoryURL,
  withIntermediateDirectories: true
)

let size = CGSize(width: 1024, height: 1024)
let image = NSImage(size: size)

image.lockFocus()

guard let context = NSGraphicsContext.current?.cgContext else {
  fatalError("Unable to create graphics context")
}

context.setAllowsAntialiasing(true)
context.setShouldAntialias(true)

let canvas = CGRect(origin: .zero, size: size)

func color(
  _ red: CGFloat,
  _ green: CGFloat,
  _ blue: CGFloat,
  _ alpha: CGFloat = 1
) -> NSColor {
  NSColor(
    calibratedRed: red / 255,
    green: green / 255,
    blue: blue / 255,
    alpha: alpha
  )
}

let shellRect = canvas.insetBy(dx: 68, dy: 68)
let shellPath = NSBezierPath(
  roundedRect: shellRect,
  xRadius: 230,
  yRadius: 230
)

NSGraphicsContext.saveGraphicsState()
shellPath.addClip()

let backgroundGradient = NSGradient(colors: [
  color(245, 251, 249),
  color(200, 230, 223),
  color(34, 107, 112)
])!
backgroundGradient.draw(
  in: shellRect,
  angle: -58
)

let ambientGlow = NSBezierPath(ovalIn: shellRect.insetBy(dx: 86, dy: 74))
color(255, 255, 255, 0.22).setFill()
ambientGlow.fill()

let lowerDepth = NSBezierPath(
  ovalIn: CGRect(x: 210, y: 160, width: 620, height: 420)
)
color(18, 62, 72, 0.12).setFill()
lowerDepth.fill()

NSGraphicsContext.restoreGraphicsState()

color(255, 255, 255, 0.68).setStroke()
shellPath.lineWidth = 6
shellPath.stroke()

let chartFrame = CGRect(x: 190, y: 190, width: 644, height: 644)
let chartBackground = NSBezierPath(ovalIn: chartFrame)

NSGraphicsContext.saveGraphicsState()
let chartShadow = NSShadow()
chartShadow.shadowBlurRadius = 42
chartShadow.shadowOffset = CGSize(width: 0, height: -18)
chartShadow.shadowColor = color(13, 42, 50, 0.22)
chartShadow.set()
color(19, 58, 67, 0.94).setFill()
chartBackground.fill()
NSGraphicsContext.restoreGraphicsState()

let chartHighlight = NSBezierPath(
  ovalIn: CGRect(x: 232, y: 470, width: 410, height: 248)
)
color(255, 255, 255, 0.12).setFill()
chartHighlight.fill()

let ringRect = chartFrame.insetBy(dx: 94, dy: 94)
let ringLineWidth: CGFloat = 84

func strokeArc(
  from startAngle: CGFloat,
  to endAngle: CGFloat,
  strokeColor: NSColor
) {
  let arc = NSBezierPath()
  arc.appendArc(
    withCenter: CGPoint(x: ringRect.midX, y: ringRect.midY),
    radius: ringRect.width / 2,
    startAngle: startAngle,
    endAngle: endAngle,
    clockwise: false
  )
  arc.lineWidth = ringLineWidth
  arc.lineCapStyle = .round
  strokeColor.setStroke()
  arc.stroke()
}

strokeArc(from: 90, to: 214, strokeColor: color(240, 249, 246))
strokeArc(from: 228, to: 318, strokeColor: color(109, 209, 184))
strokeArc(from: 332, to: 438, strokeColor: color(57, 155, 163))

let innerCoreRect = chartFrame.insetBy(dx: 224, dy: 224)
let innerCore = NSBezierPath(ovalIn: innerCoreRect)

let innerGradient = NSGradient(colors: [
  color(15, 53, 62),
  color(32, 93, 98)
])!
innerGradient.draw(in: innerCore, relativeCenterPosition: .zero)

let centerDot = NSBezierPath(
  ovalIn: CGRect(
    x: innerCoreRect.midX - 24,
    y: innerCoreRect.midY - 24,
    width: 48,
    height: 48
  )
)
color(240, 249, 246, 0.85).setFill()
centerDot.fill()

let tickBar = NSBezierPath(
  roundedRect: CGRect(x: 458, y: 348, width: 108, height: 20),
  xRadius: 10,
  yRadius: 10
)
color(240, 249, 246, 0.45).setFill()
tickBar.fill()

let smallTick = NSBezierPath(
  roundedRect: CGRect(x: 420, y: 380, width: 184, height: 16),
  xRadius: 8,
  yRadius: 8
)
color(109, 209, 184, 0.95).setFill()
smallTick.fill()

image.unlockFocus()

guard
  let tiffData = image.tiffRepresentation,
  let bitmap = NSBitmapImageRep(data: tiffData),
  let pngData = bitmap.representation(using: .png, properties: [:])
else {
  fatalError("Unable to export PNG data")
}

try pngData.write(to: outputURL)
