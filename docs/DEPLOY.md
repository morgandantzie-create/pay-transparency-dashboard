# Setup and deployment

There are two ways to run this project. Both use **personal accounts only**.

| Mode | Best for | Data source |
|---|---|---|
| **Static demo** (GitHub Pages) | The public portfolio link: one click, no sign-in | Generated in the browser from the seed |
| **Apps Script web app** | Showing Google Workspace integration | A Google Sheet in your personal Drive |

> **Keep it separate from work.**
> - Use a personal GitHub account and a personal Google account.
> - Use a separate Chrome profile for the personal Google account, so nothing is accidentally created in a work Drive.
> - Set the repo's commit email to your personal or GitHub "noreply" address. **Don't** use a work address.

---

## 0. Prerequisites
- Node.js 18 or later (`node -v`). No npm packages are needed.
- For GitHub: the GitHub CLI (`gh`), signed in to your personal account with `gh auth login`.
- For Apps Script: a personal Google account. Optionally, also install [clasp](https://github.com/google/clasp).

## 1. Run locally
```bash
npm test                 # unit tests
node tests/parity.js     # Sheets ⇄ static parity
npm run dev              # open http://localhost:5180/ui/index.html
npm run build            # writes dist/web and dist/apps-script
```
You can also open `dist/web/index.html` directly from disk. It's a single self-contained file, with Chart.js loaded from cdnjs.

## 2. Publish the static demo to GitHub Pages
The workflow at `.github/workflows/pages.yml` tests, builds and deploys on every push to `main`.

```bash
git init -b main
git config user.name "Your Name"
git config user.email "<id>+<username>@users.noreply.github.com"   # personal / noreply only
git add . && git commit -m "Pay Transparency Dashboard v1"
gh repo create pay-transparency-dashboard --public --source . --push
gh api -X POST repos/{owner}/pay-transparency-dashboard/pages -f build_type=workflow
```
After the first workflow run finishes (**Actions** tab), the demo is live at `https://<username>.github.io/pay-transparency-dashboard/`. Add that link to the top of the README.

## 3. Deploy the Apps Script web app

### 3a. Create the Sheet and script (in your personal account)
1. In your personal Google account, create a new Google Sheet called **Fernvale Pay Transparency (demo)**.
2. Open **Extensions → Apps Script**.
3. Run `npm run build`, then add the files from `dist/apps-script/` using one of the two options below.

**Option A: copy and paste (no tools needed)**
1. Replace the contents of `Code.gs` with `dist/apps-script/Code.gs`.
2. Add a script file named `Generator` and paste in `dist/apps-script/Generator.gs`.
3. Add an HTML file named `Index` and paste in `dist/apps-script/Index.html`.
4. Go to **Project Settings** and tick *Show "appsscript.json" manifest file in editor*. Then replace the manifest with `dist/apps-script/appsscript.json`.

**Option B: clasp**
```bash
npm install -g @google/clasp
clasp login                                   # choose your PERSONAL Google account
```
1. Turn on the Apps Script API at <https://script.google.com/home/usersettings>.
2. Copy the Script ID from Apps Script **Project Settings**.
3. Create `.clasp.json` in the project root. It's git-ignored.
   ```json
   { "scriptId": "<your-script-id>", "rootDir": "dist/apps-script" }
   ```
4. Push the files:
   ```bash
   npm run push
   ```

### 3b. Load the demo data
1. In the Apps Script editor, select `setupDemoData` and click **Run**.
2. Approve the permission prompt. The script only needs access to spreadsheets.
3. The Sheet now has these tabs: `Config`, `Entities`, `Families`, `Levels`, `Bands`, `Employees`, `Compensation` and `Scenarios`.

Re-running `setupDemoData` regenerates the same dataset, because the seed is fixed. Saved scenarios are kept.

### 3c. Deploy
1. Go to **Deploy → New deployment → Web app**.
2. Set **Execute as** to *Me*.
3. Set **Who has access**:
   - *Anyone* is the most open choice. Note that visitors can then save and delete scenarios in your demo Sheet. That's harmless with fictional data, but you can reset it at any time by clearing the `Scenarios` tab.
   - *Anyone with a Google account* is more restrictive.
4. Open the web app URL. The header badge should read **Fictional data · Google Sheets**.

Google shows a "This application was created by a Google Apps Script user" banner on personal-account web apps. That's expected, and it's one reason the static demo is the primary portfolio link.

### Updating
- Static demo: push to `main`.
- Apps Script: run `npm run push`, then go to **Deploy → Manage deployments → Edit → New version**. Alternatively, run `npm run deploy`, which creates a new deployment.

## 4. Troubleshooting
| Symptom | Fix |
|---|---|
| "Missing sheet …" in the web app | Run `setupDemoData()` once from the editor |
| "No spreadsheet" error | The script isn't bound to a Sheet. Either create it from the Sheet (**Extensions → Apps Script**), or set a Script Property `SPREADSHEET_ID` |
| Charts don't appear | The page couldn't reach `cdnjs.cloudflare.com`. Check your network or ad-blocker |
| `clasp push` refused | Turn on the Apps Script API in user settings, and check that `clasp login` used your personal account |
