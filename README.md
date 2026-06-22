# scheduler-export-excel

Automates login to EVO Payment portal, selects all transactions, exports to Excel, and saves as a zip file.

## How it works

1. Opens browser and logs in to `bkk-portal.everonet.com`
2. Navigates to the Payments transaction list for the target date
3. Clicks **Select All** toggle (selects all 258+ items)
4. Clicks **Export All → Export Excel**
5. Waits for the Excel file to download
6. Compresses the file into a timestamped `.zip` archive

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure credentials and settings
cp .env.example .env   # or edit .env directly
```

Edit `.env`:
```
USERNAME=Vietxiong
PASSWORD=your_password
CRON_SCHEDULE=0 1 * * *   # daily at 1:00 AM
```

---

## Usage

### Run immediately (today's date)
```bash
node scheduler.js --now
# or
npm test
```

### Run for a specific date
```bash
node scheduler.js --date 2026-03-12
```

### Start the scheduler (cron)
```bash
node scheduler.js
# or
npm start
```

---

## Output

- **Downloads:** `./downloads/` — raw Excel file from portal
- **Exports (zip):** `./exports/transactions_YYYY-MM-DD_TIMESTAMP.zip`

---

## Configuration (`.env`)

| Variable         | Default                | Description                              |
|------------------|------------------------|------------------------------------------|
| `USERNAME`       | `Vietxiong`            | Portal login user ID                     |
| `PASSWORD`       | *(required)*           | Portal password                          |
| `CRON_SCHEDULE`  | `0 1 * * *`            | Cron expression for auto-schedule        |
| `DOWNLOAD_DIR`   | `./downloads`          | Where browser saves Excel files          |
| `ZIP_DIR`        | `./exports`            | Where zip archives are saved             |
| `DYNAMIC_DATE`   | `true`                 | Use today's date automatically           |
| `MANUAL_DATE`    | `2026-03-12`           | Used only when `DYNAMIC_DATE=false`      |
| `HEADLESS`       | `true`                 | Run browser headlessly (no UI)           |
| `UTC_OFFSET`     | `420`                  | UTC offset in minutes (UTC+7 = 420)      |

---

## Requirements

- Node.js 18+
- Google Chrome installed at `/opt/google/chrome/chrome`
  - Or update `executablePath` in `exporter.js`


  https://github.com/vietxiong/scheduler-export-excel.git

…or create a new repository on the command line
echo "# scheduler-export-excel" >> README.md
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/vietxiong/scheduler-export-excel.git
git push -u origin main

…or push an existing repository from the command line
git remote add origin https://github.com/vietxiong/scheduler-export-excel.git
git branch -M main
git push -u origin main
