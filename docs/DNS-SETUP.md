# Connecting 123go.taxi (Njalla → GitHub Pages)

About 15 minutes of clicking, then up to a day of waiting for HTTPS. You'll do the Njalla and GitHub account parts; the repository part can be done by your coding assistant or by you (step 4).

GitHub's reference: [Managing a custom domain for your GitHub Pages site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

---

## 1. Register the domain on Njalla

1. Search for `123go.taxi` on [njal.la](https://njal.la) and register it.
2. Before paying, check the **yearly renewal price**. Printed QR codes need the domain to keep working, so it has to be renewed every year.

## 2. Prove to GitHub that the domain is yours

This stops anyone else from attaching your domain to their GitHub site.

1. On GitHub: click your profile picture → **Settings** → **Pages** (left menu, under "Code, planning, and automation").
2. Click **Add a domain**, type `123go.taxi`, click **Add domain**.
3. GitHub shows a **TXT record**: a name like `_github-pages-challenge-charles0xhorizonxyz` and a long random value. Keep this page open.
4. In Njalla: open **123go.taxi** → **DNS** → **Add record**:
   - Type: `TXT`
   - Name: `_github-pages-challenge-charles0xhorizonxyz` (exactly what GitHub showed, without `.123go.taxi` at the end if Njalla adds it automatically)
   - Content: the long value from GitHub
5. Back on GitHub, click **Verify**. If it fails, wait 10 minutes and try again.

## 3. Point the domain at GitHub Pages

In Njalla → **123go.taxi** → **DNS**:

1. **Delete** any records Njalla created for `@` (the bare domain) or `www`, such as parking or forwarding. Leave the TXT record from step 2.
2. Add these **8 records** for the bare domain (Name `@`, or empty, depending on how Njalla shows it):

   | Type | Name | Content |
   |---|---|---|
   | A | @ | `185.199.108.153` |
   | A | @ | `185.199.109.153` |
   | A | @ | `185.199.110.153` |
   | A | @ | `185.199.111.153` |
   | AAAA | @ | `2606:50c0:8000::153` |
   | AAAA | @ | `2606:50c0:8001::153` |
   | AAAA | @ | `2606:50c0:8002::153` |
   | AAAA | @ | `2606:50c0:8003::153` |

3. Add **1 record** for `www`:

   | Type | Name | Content |
   |---|---|---|
   | CNAME | www | `charles0xhorizonxyz.github.io` |

   (No repository name in it. GitHub works that out from step 4.)

Leave the TTL at Njalla's default.

## 4. Tell the repository its new address

Either ask your coding assistant to "connect 123go.taxi", or do it yourself:

1. Open [the repository's Pages settings](https://github.com/Charles0xhorizonxyz/gogogo-rodeo/settings/pages).
2. Under **Custom domain**, type `123go.taxi` and click **Save**. GitHub checks the DNS. A green "DNS check successful" can take from a few minutes to an hour.
3. Under [Settings → Secrets and variables → Actions → Variables](https://github.com/Charles0xhorizonxyz/gogogo-rodeo/settings/variables/actions), **delete** `BASE_PATH` and `PUBLIC_URL`. They only existed for the temporary github.io address. Without them, the site builds for `https://123go.taxi`.
4. Re-run the latest **Deploy** workflow (Actions tab → Deploy → Run workflow), so the site is rebuilt for the new address.

We publish with GitHub Actions, so **no `CNAME` file is needed** in the code. GitHub ignores it in this setup.

## 5. Turn on HTTPS

1. Back in the repository's Pages settings, wait until **Enforce HTTPS** can be ticked. GitHub has to get a certificate first, which usually takes minutes and can take up to 24 hours.
2. Tick **Enforce HTTPS**.

## 6. Check it works

On your phone and computer:

- [ ] `https://123go.taxi` shows the site with a padlock.
- [ ] `http://123go.taxi` switches to `https://` by itself.
- [ ] `https://www.123go.taxi` switches to `https://123go.taxi` by itself.
- [ ] The old test address `https://charles0xhorizonxyz.github.io/gogogo-rodeo/` now redirects to `https://123go.taxi`.
- [ ] Make a QR and scan it: it opens `https://123go.taxi/#v=1&…`.

## If something's wrong

| Symptom | Likely cause |
|---|---|
| GitHub says "DNS check unsuccessful" | Records not live yet (wait an hour), or a leftover Njalla parking record for `@`/`www` |
| "Enforce HTTPS" stays greyed out | Certificate not ready yet; wait up to 24 hours. Remove and re-save the custom domain if it's still stuck after that |
| Site loads but looks broken (no styles) | `BASE_PATH` variable still set; delete it and re-run Deploy (step 4) |
| QR codes point to github.io | `PUBLIC_URL` variable still set; delete it and re-run Deploy |
