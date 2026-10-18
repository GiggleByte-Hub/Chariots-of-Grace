// In-app donations: Google Play (Digital Goods API + Payment Request) in the Play app,
// and Apple in-app purchase (via the Swift wrapper) in the App Store app.
// Active only inside an app (body.play-app or body.ios-app). When the store has the products,
// body gets the "billing" class and the .play-only donate section appears.
// Each donate button: <button class="play-tier" data-sku="donate_small">… <span class="price"></span></button>
// The SKUs must match the one-time products in Play Console; in App Store Connect the product IDs
// are "com.gigglebyte.chariotsofgrace." + SKU (the Swift wrapper adds the prefix).
(function () {
  const METHOD = "https://play.google.com/billing";
  let service = null;

  const $ = id => document.getElementById(id);
  function say(html) { const s = $("play-donate-status"); if (s) s.innerHTML = html; }

  // A simple "ask a grown-up" check before any purchase, since these are children's games.
  function gate(onPass) {
    const box = $("play-gate");
    if (!box) return onPass();
    const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
    box.hidden = false;
    box.innerHTML = `<p><b>Grown-ups only:</b> what is ${a} × ${b}?</p>
      <div class="gate-row"><input id="play-gate-answer" type="number" inputmode="numeric" aria-label="Answer">
      <button id="play-gate-ok" class="primary">Continue</button>
      <button id="play-gate-cancel">Cancel</button></div>`;
    const input = $("play-gate-answer");
    input.focus();
    const close = () => { box.hidden = true; box.innerHTML = ""; };
    const check = () => {
      if (parseInt(input.value, 10) === a * b) { close(); onPass(); }
      else { close(); say("That answer wasn't right — please ask a grown-up to help."); }
    };
    $("play-gate-ok").addEventListener("click", check);
    input.addEventListener("keydown", e => { if (e.key === "Enter") check(); });
    $("play-gate-cancel").addEventListener("click", close);
  }

  async function buy(sku) {
    say("Opening Google Play…");
    let response;
    try {
      const request = new PaymentRequest(
        [{ supportedMethods: METHOD, data: { sku } }],
        { total: { label: "Donation", amount: { currency: "USD", value: "0" } } } // price comes from Play Console
      );
      response = await request.show();
    } catch (e) {
      say(e && e.name === "AbortError" ? "Donation cancelled — you were not charged." : "Google Play couldn't start the donation. Please try again later.");
      return;
    }
    // Payment went through. Consume it so the same tier can be given again later.
    try { await service.consume(response.details.purchaseToken); } catch (e) {}
    try { await response.complete("success"); } catch (e) {}
    say("💛 Thank you for your gift! It helps keep this game free for every family.");
  }

  // Apple App Store app: the Swift wrapper exposes a "store" message handler and buys through
  // StoreKit (Apple in-app purchase). It answers by calling AppleStore.onProducts / onResult.
  function initApple() {
    const handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.store;
    if (!handler) return;
    const storeName = $("store-name");
    if (storeName) storeName.textContent = "the App Store";
    const buttons = [...document.querySelectorAll(".play-tier")];
    window.AppleStore = {
      onProducts(list) {
        if (!list || !list.length) return; // products not set up yet: Donate stays hidden
        for (const p of list) {
          const b = buttons.find(x => x.dataset.sku === p.id);
          const price = b && b.querySelector(".price");
          if (price) price.textContent = p.price;
        }
        document.body.classList.add("billing");
      },
      onResult(id, status) {
        if (status === "success") say("💛 Thank you for your gift! It helps keep this game free for every family.");
        else if (status === "cancelled") say("Donation cancelled — you were not charged.");
        else if (status === "pending") say("Your donation is waiting for approval (for example, Ask to Buy). Thank you!");
        else say("The App Store couldn't complete the donation. Please try again later.");
      }
    };
    buttons.forEach(b => b.addEventListener("click", () => gate(() => {
      say("Opening the App Store…");
      handler.postMessage({ action: "buy", id: b.dataset.sku });
    })));
    handler.postMessage({ action: "products", ids: buttons.map(b => b.dataset.sku) });
  }

  async function init() {
    if (document.body.classList.contains("ios-app")) return initApple();
    if (!document.body.classList.contains("play-app")) return;
    if (!("getDigitalGoodsService" in window) || !window.PaymentRequest) return;
    try { service = await window.getDigitalGoodsService(METHOD); } catch (e) { return; }
    if (!service) return;
    document.body.classList.add("billing");

    // Finish any donation that was paid but interrupted before it was consumed.
    try { for (const p of await service.listPurchases()) await service.consume(p.purchaseToken); } catch (e) {}

    const buttons = [...document.querySelectorAll(".play-tier")];
    try {
      const details = await service.getDetails(buttons.map(b => b.dataset.sku));
      for (const d of details) {
        const b = buttons.find(x => x.dataset.sku === d.itemId);
        const price = b && b.querySelector(".price");
        if (price) price.textContent = new Intl.NumberFormat(undefined, { style: "currency", currency: d.price.currency }).format(d.price.value);
      }
    } catch (e) {}
    buttons.forEach(b => b.addEventListener("click", () => gate(() => buy(b.dataset.sku))));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
