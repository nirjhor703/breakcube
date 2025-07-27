const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { SerialPort } = require("serialport");

const COOLDOWN_FILE = path.join(app.getPath("userData"), "cooldown.json");
const COOLDOWN_DURATION = 1 * 60 * 1000; // 1 min for testing
const BREAK_DURATION = 3 * 60 * 1000;    // 1 min for testing

let mainWindow = null;
let gameWindow = null;
let sessionTimer = null;

function isUnderCooldown() {
    try {
        const data = fs.readFileSync(COOLDOWN_FILE, "utf-8");
        const { timestamp } = JSON.parse(data);
        return Date.now() - timestamp < COOLDOWN_DURATION;
    } catch {
        return false;
    }
}

function setCooldown() {
    try {
        fs.writeFileSync(COOLDOWN_FILE, JSON.stringify({ timestamp: Date.now() }));
        console.log("✅ Cooldown started.");
    } catch (err) {
        console.error("❌ Failed to write cooldown.json:", err);
    }
}

function getRandomCooldownMessage(remaining) {
    const messages = [
        `😴 BreakCube is resting. Come back in ${remaining} minute(s)!`,
        `🚫 You've already had a break. Wait ${remaining} more minute(s).`,
        `🕒 Patience! ${remaining} minute(s) left before your next break.`,
        `🥱 Too soon! Your next break will be ready in ${remaining} minute(s).`,
        `👋 Relax! Return in ${remaining} minute(s). BreakCube needs a timeout too!`
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

function createMainWindow() {
    if (mainWindow) {
        mainWindow.focus();
        return;
    }

    mainWindow = new BrowserWindow({
        fullscreen: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
        },
    });

    mainWindow.loadFile("index.html");

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    console.log("✅ Main window opened, session started.");

    // Start session timer on first open
    sessionTimer = setTimeout(() => {
        dialog.showMessageBoxSync({
            type: "info",
            title: "Session Ended",
            message: "✅ Your BreakCube session has ended. Come back in 1 hour!"
        });
        setCooldown();
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) win.close();
        });
        app.quit();
    }, BREAK_DURATION);
}

function loadInGameWindow(filePath) {
    if (!gameWindow) {
        gameWindow = new BrowserWindow({
            fullscreen: true,
            resizable: true,
            webPreferences: {
                preload: path.join(__dirname, "preload.js"),
                contextIsolation: true,
                nodeIntegration: false,
            },
        });

        gameWindow.on("closed", () => {
            gameWindow = null;
        });
    }

    if (!fs.existsSync(filePath)) {
        dialog.showErrorBox("File Not Found", `Cannot find file: ${filePath}`);
        return;
    }

    gameWindow.loadFile(filePath);
}

function openGameMenuWindow() {
    loadInGameWindow(path.join(__dirname, "gameMenu.html"));

    setTimeout(() => {
        if (gameWindow && !gameWindow.isDestroyed()) {
            gameWindow.close();
            gameWindow = null;
            setCooldown();
        }
    }, BREAK_DURATION);
}

// IPC for games
ipcMain.on("play-game", (event, gameName) => {
    const gamePath = path.join(__dirname, "games", gameName, "game.html");
    console.log(`🕹️ Opening game: ${gamePath}`);
    loadInGameWindow(gamePath);
});

function startSerialListener() {
    try {
        const port = new SerialPort({ path: "COM3", baudRate: 115200 });
        port.on("open", () => console.log("✅ Serial port opened (COM3)"));
        port.on("data", (data) => {
            const msg = data.toString().trim();
            if (msg === "FLIP") {
                console.log("↪️ FLIP detected");
                if (isUnderCooldown()) {
                    const { timestamp } = JSON.parse(fs.readFileSync(COOLDOWN_FILE));
                    const remaining = Math.ceil((COOLDOWN_DURATION - (Date.now() - timestamp)) / 60000);
                    dialog.showMessageBoxSync({
                        type: "info",
                        title: "Cooldown Active 💤",
                        message: getRandomCooldownMessage(remaining),
                    });
                } else {
                    createMainWindow();
                }
            }
        });
        port.on("error", (err) => console.error("❌ Serial error:", err.message));
    } catch (err) {
        console.error("❌ Could not open serial port:", err.message);
    }
}

// IPC for manual end
ipcMain.on("end-break", () => {
    clearTimeout(sessionTimer);
    setCooldown();
    BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) win.close();
    });
    console.log("✅ Break ended. All windows closed.");
    app.quit();
});

// 🚩 App initialization
app.whenReady().then(() => {
    startSerialListener(); // ✅ Ensure this is enabled
    console.log("✅ BreakCube ready. Waiting for FLIP...");
});

app.on("window-all-closed", () => {
    setCooldown();
    console.log("⏳ Manual exit — cooldown started.");
    app.quit();
});

app.on("before-quit", () => {
    if (sessionTimer) clearTimeout(sessionTimer);
    setCooldown();
});


ipcMain.on("exit-app", async (event) => {
  const result = await dialog.showMessageBox({
    type: "question",
    buttons: ["Yes", "No"],
    defaultId: 1,
    cancelId: 1,
    title: "Exit Confirmation",
    message: "Are you sure you want to exit?",
    detail: "Careful! Exiting now locks the break for 1 hour 🔒",
  });

  if (result.response === 0) {
    // User clicked Yes
    setCooldown(); // start cooldown logic here
    console.log("⏳ Exit confirmed — cooldown started.");
    app.quit();
  } else {
    // User clicked No
    console.log("❌ Exit canceled by user.");
  }
});
