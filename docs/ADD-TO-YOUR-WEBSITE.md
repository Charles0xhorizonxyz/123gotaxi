# Add 123go.taxi to your website

For restaurants, hotels, shops, clinics, venues: anywhere guests come by taxi.

Put a **Reach us with 123go.taxi** card, the words over a QR code, on your Contact or Getting here page. A guest taps the card on their phone (or scans the QR on a computer screen), your place lands in their 123go.taxi list with your name, and they show the QR to the driver. The driver scans it and the route starts in their own navigation app: Google Maps, Yandex, Waze, Apple Maps or any other.

It's free, needs no account, and nothing about your guests is collected. The short version, in six languages, to send to a place: **https://123go.taxi/onmysite/**

---

## The two-minute way

1. Open **https://123go.taxi** on your phone or computer.
2. In **Where to?**, type your address (or paste your Google Maps link) and pick your place from the list. Check that the address shown above the QR is your door.
3. Under the QR, tap **Put it on your website**.
4. Type your place's name as guests know it (for example *Pandeli Restaurant*). It goes into the QR, so guests and drivers see it.
5. Choose the card's language: English, Français, Türkçe, Deutsch, Español or Русский.
6. Tap **Copy the code**, then paste it into your website (see below). Or tap **Download the QR** to print it on menus, flyers or your door.

### Where to paste the code

| Website builder | Where |
|---|---|
| WordPress | Edit the page, add a **Custom HTML** block, paste. |
| Wix | **Add › Embed Code › Embed HTML**, choose *Code*, paste. |
| Squarespace | Edit the page, add a **Code** block, paste (leave "Display source" off). |
| Shopify | Online Store › Pages › your page, switch the editor to **<>** (HTML), paste. |
| Webflow | Drag an **Embed** element onto the page, paste. |
| Google Sites | **Insert › Embed › Embed code**, paste. |
| Plain HTML | Paste it where the button should appear. |

Not sure? Send this page and your copied code to whoever looks after your website, or to an AI assistant (the next part is written for them).

---

## For AI assistants and developers

Everything needed to add a working 123go.taxi card without opening the app. Follow it exactly; every rule is there for a reason.

### 1. Find the coordinates of the entrance

Latitude and longitude in decimal degrees, of the **door guests use** (not the middle of the building or the map). In Google Maps on a computer, right-click the entrance: the first line of the menu is `lat, lon`. Round to **5 decimals** (about 1 m).

### 2. Build the link

```
https://123go.taxi/#v=1&lat=<LAT>&lon=<LON>&n=<NAME>&a=<ADDRESS>
```

| Part | Required | Rule |
|---|---|---|
| `v=1` | yes | Format version. Always `1`. |
| `lat`, `lon` | yes | Decimal degrees, at most 5 decimals, `.` as the decimal point. `lat` −90…90, `lon` −180…180. |
| `n` | recommended | The place's public name, max 60 characters. Shown to guests and drivers. |
| `a` | optional | Readable street address, max 100 characters, shown under the name. |
| `via` | optional | Stops before the destination, `lat,lon~lat,lon`, in order, at most 3. Rarely useful for a business. |

- Everything goes **after `#`**. Browsers never send that part to a server, which is why 123go.taxi can't see where anyone goes. Never move it into `?…`.
- Encode `n` and `a` as URL query values: spaces as `+`, other characters percent-encoded (`URLSearchParams` does exactly this). `,` and `~` may stay as they are.
- Add nothing else: no tracking parameters, no shortened links. A short link would hide the place behind someone else's server.

Example (Galata Tower, Istanbul):

```
https://123go.taxi/#v=1&lat=41.02564&lon=28.97417&n=Galata+Kulesi&a=Bereketzade,+Beyo%C4%9Flu
```

### 3. Make the QR code

Encode **exactly the link from step 2**: no changes, no redirect. Use error correction level **Q** (it still scans when a printed code is creased or dirty) and a quiet margin of at least 2 modules, black on white. Any standard QR library works (`qrcode` for Node.js, `segno` or `qrcode` for Python). Save it as a PNG of at least 360 × 360 px, or inline it as a `data:image/png;base64,…` URL.

Don't hotlink images from 123go.taxi: the site doesn't serve QR images.

### 4. The code to paste

One card: the words on top, the QR under them, the whole card a link (phones tap it, computers scan it).

```html
<!-- 123go.taxi -->
<a href="https://123go.taxi/#v=1&amp;lat=41.02564&amp;lon=28.97417&amp;n=Galata+Kulesi&amp;a=Bereketzade,+Beyo%C4%9Flu" style="display:inline-flex;flex-direction:column;align-items:center;gap:12px;max-width:220px;padding:16px;border-radius:18px;background:#141414;color:#ffc61a;font:700 16px/1.25 system-ui,-apple-system,sans-serif;text-align:center;text-decoration:none" lang="en">
  <span>Reach us with 123go.taxi</span>
  <img src="QR_IMAGE_URL" width="180" height="180" alt="QR code: reach us with 123go.taxi" style="display:block;width:180px;height:180px;border-radius:8px;background:#fff">
</a>
```

The words, by language (set `lang` to match):

| `lang` | Card text | `alt` of the QR |
|---|---|---|
| `en` | Reach us with 123go.taxi | QR code: reach us with 123go.taxi |
| `fr` | Rejoignez-nous avec 123go.taxi | Code QR : rejoignez-nous avec 123go.taxi |
| `tr` | 123go.taxi ile bize ulaşın | QR kod: 123go.taxi ile bize ulaşın |
| `de` | Mit 123go.taxi zu uns | QR-Code: mit 123go.taxi zu uns |
| `es` | Llega hasta nosotros con 123go.taxi | Código QR: llega hasta nosotros con 123go.taxi |
| `ru` | Доберитесь до нас с 123go.taxi | QR-код: доберитесь до нас с 123go.taxi |

- In HTML attributes, `&` must be written `&amp;` (as above).
- Keep the words over the QR, and the whole card one link.
- The colours (taxi yellow `#ffc61a` on asphalt `#141414`) are 123go.taxi's own; matching them to the website is fine. Keep the QR black on white.

### 5. Check it before you finish

1. Open the link on a phone. It must show **the place's name** as the title, and the address under it.
2. Compare the coordinates with the entrance in Google Maps: they should be within a few metres.
3. Scan the QR with a phone camera: it must open the same page.
4. On that page, tap the guest's usual navigation app and check the route ends at the door.

If the name is missing, `n` was dropped or badly encoded. If the page says the link looks broken, `lat`/`lon` are missing, out of range or use `,` as the decimal point.

---

Questions or a place that doesn't work: open an issue on [GitHub](https://github.com/Charles0xhorizonxyz/123gotaxi/issues) or write to 0xhorizonxyz@gmail.com.
