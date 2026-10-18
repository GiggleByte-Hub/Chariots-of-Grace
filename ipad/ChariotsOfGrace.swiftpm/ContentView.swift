import SwiftUI
import WebKit
import StoreKit

// The game's deep blue background (#141a33), shown behind the status bar and while loading.
private let gameBackground = UIColor(red: 20 / 255, green: 26 / 255, blue: 51 / 255, alpha: 1)

struct ContentView: View {
    var body: some View {
        GameWebView()
            .background(Color(gameBackground))
            .ignoresSafeArea(edges: .bottom)
            .preferredColorScheme(.dark)
    }
}

/// Shows the whole game (bundled in GameHTML.swift) full-screen. It works offline.
struct GameWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Tells the game it is running inside the Apple app, so it uses Apple in-app purchase
        // for donations instead of Ko-fi.
        config.userContentController.addUserScript(
            WKUserScript(source: "window.IOS_APP = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
        // The game's Donate buttons talk to the tip jar through window.webkit.messageHandlers.store.
        config.userContentController.add(context.coordinator, name: "store")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = gameBackground
        webView.scrollView.backgroundColor = gameBackground
        webView.navigationDelegate = context.coordinator
        context.coordinator.tipJar.webView = webView
        // The base address lets the game save progress on the device and resolves the privacy link.
        webView.loadHTMLString(gameHTML, baseURL: URL(string: "https://gigglebyte-hub.github.io/Chariots-of-Grace/"))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        let tipJar = TipJar()

        // Links the player taps (like the privacy policy) open in Safari instead of replacing the game.
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if navigationAction.navigationType == .linkActivated, let url = navigationAction.request.url {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        // Messages from the game: {action: "products", ids: [...]} or {action: "buy", id: "..."}.
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
            if action == "products", let ids = body["ids"] as? [String] {
                Task { await tipJar.loadProducts(ids) }
            } else if action == "buy", let id = body["id"] as? String {
                Task { await tipJar.buy(id) }
            }
        }
    }
}

/// Optional donations through Apple in-app purchase (consumable products, so they can be given again).
/// Product IDs in App Store Connect: com.gigglebyte.chariotsofgrace.donate_small / donate_medium / donate_large.
@MainActor
final class TipJar {
    weak var webView: WKWebView?
    private let prefix = "com.gigglebyte.chariotsofgrace."
    private var products: [String: Product] = [:]
    private var updates: Task<Void, Never>?

    init() {
        // Finish any donation that completed while the app was closed (for example, after Ask to Buy).
        updates = Task {
            for await result in Transaction.updates {
                if case .verified(let transaction) = result { await transaction.finish() }
            }
        }
    }

    func loadProducts(_ ids: [String]) async {
        var found: [[String: String]] = []
        if let list = try? await Product.products(for: ids.map { prefix + $0 }) {
            for product in list.sorted(by: { $0.price < $1.price }) {
                let id = String(product.id.dropFirst(prefix.count))
                products[id] = product
                found.append(["id": id, "price": product.displayPrice])
            }
        }
        send("window.AppleStore && AppleStore.onProducts(\(json(found)))")
    }

    func buy(_ id: String) async {
        guard let product = products[id] else { return report(id, "failed") }
        do {
            switch try await product.purchase() {
            case .success(let verification):
                if case .verified(let transaction) = verification {
                    await transaction.finish()
                    report(id, "success")
                } else {
                    report(id, "failed")
                }
            case .userCancelled:
                report(id, "cancelled")
            case .pending:
                report(id, "pending")
            @unknown default:
                report(id, "failed")
            }
        } catch {
            report(id, "failed")
        }
    }

    private func report(_ id: String, _ status: String) {
        send("window.AppleStore && AppleStore.onResult(\(json(id)), \(json(status)))")
    }

    private func send(_ script: String) {
        webView?.evaluateJavaScript(script)
    }

    private func json(_ value: Any) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed]),
              let text = String(data: data, encoding: .utf8) else { return "null" }
        return text
    }
}
