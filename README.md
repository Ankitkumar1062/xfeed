# X-Feed Viewer

## Project Description
X-Feed Viewer is a Chrome extension designed to aggregate and display feeds from various social media platforms directly within your browser. This project consists of a backend server to handle API requests and an extension that interacts with the backend to fetch and display content.

## Features
- Integrates with multiple social media platforms (currently Twitter).
- Displays aggregated feeds in a user-friendly popup.
- Backend server to manage API keys and handle data fetching securely.

## Installation

### Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend` directory and add your API keys (e.g., `TWITTER_BEARER_TOKEN=YOUR_TOKEN_HERE`).
4. Start the backend server:
   ```bash
   npm start
   ```

### Chrome Extension Setup
1. Open Chrome and go to `chrome://extensions/`.
2. Enable 'Developer mode' in the top right corner.
3. Click 'Load unpacked' and select the `extension` directory from this project.

## Usage
1. Ensure the backend server is running.
2. Click on the X-Feed Viewer extension icon in your Chrome toolbar.
3. The popup will display aggregated social media feeds. 