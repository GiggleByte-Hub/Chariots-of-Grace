# Chariots of Grace — iPad / iPhone app (Swift Playgrounds)

`ChariotsOfGrace.swiftpm` is a ready-made Swift Playgrounds app project. It carries the whole game inside it, works offline, and takes optional donations through Apple in-app purchase.

## Open it on an iPad

1. On the iPad, open **Safari** and go to <https://github.com/GiggleByte-Hub/Chariots-of-Grace>.
2. Tap **Code → Download ZIP**, then open the **Files** app → **Downloads**, and tap the ZIP to unzip it.
3. Open the unzipped folder → **ipad**, then tap **ChariotsOfGrace.swiftpm**. It opens in **Swift Playgrounds** (free from the App Store).
4. Tap **▶ Run** to try the game.

## Send it to the App Store

You need an **Apple Developer Program** membership ($99/year), signed in under **App Settings → Team** in Swift Playgrounds.

1. In App Store Connect (appstoreconnect.apple.com), create the app with bundle ID `com.gigglebyte.chariotsofgrace`.
2. In Swift Playgrounds, open **App Settings** and tap **Upload to App Store Connect**.
3. Finish the listing in App Store Connect and submit for review.

Full step-by-step instructions, including the donation products, are in the separate **iPad App Store Guide** (Word document).

## Donations (Apple in-app purchase)

Create three **consumable** in-app purchases in App Store Connect:

| Product ID | Suggested price | Name |
|---|---|---|
| `com.gigglebyte.chariotsofgrace.donate_small` | $2.99 | Two small coins |
| `com.gigglebyte.chariotsofgrace.donate_medium` | $9.99 | Loaves & fishes |
| `com.gigglebyte.chariotsofgrace.donate_large` | $24.99 | A double portion |

Until these exist, the Donate tab stays hidden in the app. A "grown-ups only" math question appears before every donation.

## Updating the game inside the app

The game is bundled in `GameHTML.swift`, generated from the web game. After changing the game, run `sh ipad/make-game-html.sh` from the game folder, then re-upload.
