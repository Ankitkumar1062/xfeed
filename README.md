# Mail Tracker Pro

A privacy-friendly, open-source email tracking extension for Gmail. Track when your sent emails are opened, with a beautiful dashboard and real-time notifications.

---

## Features
- **Real-Time Tracking:** Know instantly when your emails are opened.
- **Dashboard:** View all tracked emails, see which have been opened, and get statistics.
- **Export Data:** Download your tracking data as JSON.

---

## 1. Deploying the Server on Render.com

### Prerequisites
- A [Render.com](https://render.com/) account
- A GitHub account (to connect your repo)

### Steps
1. **Push your code to GitHub** (if not already):
   - Make sure your server code (`server.js`, `package.json`, etc.) is in a public or private repo.

2. **Create a New Web Service on Render:**
   - Go to your Render dashboard and click **"New +" > "Web Service"**.
   - Connect your GitHub account and select your repository.

3. **Configure the Service:**
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Root Directory:** (leave blank if your server.js is in the root)
   - **Instance Type:** Free or Starter (as needed)
   - **Environment Variables:**
     - (Optional) `PORT=10000` (Render will set this automatically, but your code should use `process.env.PORT`)

4. **Deploy:**
   - Click **Create Web Service**. Wait for the build and deployment to finish.
   - Once deployed, note your public URL (e.g., `https://your-app.onrender.com`).

5. **Update Extension:**
   - In your extension code (background.js, content.js), set the server URL to your Render URL.
   - Example: `const TRACKING_SERVER = 'https://your-app.onrender.com';`

---

## 2. Local Development Setup

### Prerequisites
- Node.js (v14+ recommended)
- npm

### Steps
1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/mail.git
   cd mail
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Start the server locally:**
   ```bash
   node server.js
   ```
   The server will run on `http://localhost:8000` by default.

4. **Update Extension for Local Testing:**
   - In `background.js` and `content.js`, set `TRACKING_SERVER = 'http://localhost:8000'`.

---

## 3. Chrome Extension Installation & Usage

1. **Go to `chrome://extensions/` in your browser.**
2. **Enable Developer Mode.**
3. **Click "Load unpacked" and select the project folder.**
4. **Pin the extension for easy access.**
5. **Compose and send emails in Gmail as usual.**
   - The extension will inject a tracking pixel and monitor opens.
6. **Open the extension popup to view tracking stats and details.**

---

## 4. Configuration & Environment Variables

- **PORT:** The port the server runs on (default: 8000). Set via `process.env.PORT`.
- **CORS:** The server allows all origins by default. Adjust in `server.js` if needed.
- **TRACKING_SERVER:** The URL used by the extension to communicate with the server. Set in `background.js` and `content.js`.

---

## 5. Troubleshooting & FAQ

**Q: I don't see any tracking data in the popup?**
- Make sure the server is running and accessible from your browser.
- Check the extension's background page for errors.
- Ensure the tracking pixel is being injected (inspect sent emails).

**Q: How do I change the server URL after deploying to Render?**
- Edit `background.js` and `content.js` to use your Render URL, then reload the extension.

**Q: Can I use this with other email providers?**
- The extension is optimized for Gmail but may work with others if the pixel is injected.

**Q: How do I reset all tracking data?**
- Use the "Clear All Data" button in the extension popup settings.

---

## 6. Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## 7. License

This project is licensed under the MIT License. 
