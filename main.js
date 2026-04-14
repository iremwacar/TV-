const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let remoteWindow;

const MAIN_WIDTH = 1280;
const MAIN_HEIGHT = 720;
const REMOTE_WIDTH = 190;

function createWindow() {
  const iconPath = path.join(__dirname, 'TV+icon.ico');

  // 1. ANA PENCERE OLUŞTURMA
  mainWindow = new BrowserWindow({
    width: MAIN_WIDTH,
    height: MAIN_HEIGHT,
    title: "Turkcell TV+ Big Screen",
    icon: iconPath,
    resizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: false // Geliştirici araçlarını kapat
    }
  });

  mainWindow.loadURL('https://smartstg.tvplus.com.tr/release/');
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
  });
  mainWindow.setMenuBarVisibility(false);

  // 2. KUMANDA PENCERESİ OLUŞTURMA
  const mainBounds = mainWindow.getBounds();
  remoteWindow = new BrowserWindow({
    width: REMOTE_WIDTH,
    height: MAIN_HEIGHT,
    x: mainBounds.x + MAIN_WIDTH,
    y: mainBounds.y,
    parent: mainWindow, // Ana pencereye bağlar
    resizable: false,
    frame: false, // Çerçevesiz
    icon: iconPath,
    alwaysOnTop: false, // Diğer uygulamaların üstüne çıkmasını engeller
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: false
    }
  });

  remoteWindow.loadFile('remote.html');

  // --- SENKRONİZASYON VE AKILLI TAKİP ---

  // Küçültme ve geri getirme işlemleri
  mainWindow.on('minimize', () => remoteWindow.hide());
  mainWindow.on('restore', () => remoteWindow.show());

  // Pencereyi sürüklerken kumandayı mıknatıs gibi yanında tut
  mainWindow.on('move', () => {
    if (remoteWindow && !remoteWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      remoteWindow.setPosition(bounds.x + MAIN_WIDTH, bounds.y);
    }
  });

  // Geliştirici kısayollarını (F12, Ctrl+Shift+I) engelle
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control && input.shift && input.key.toLowerCase() === 'i') || input.key === 'F12') {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    app.quit();
  });
}

// --- GLOBAL ODAK KONTROLÜ (Başka sekmeye geçince gizleme) ---

// Uygulama genelinde odak kaybedildiğinde (Başka bir programa tıklarsan)
app.on('browser-window-blur', () => {
  if (remoteWindow && !remoteWindow.isDestroyed()) {
    setTimeout(() => {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (!focusedWindow) {
        remoteWindow.hide();
      }
    }, 150);
  }
});

// Uygulamaya geri dönüldüğünde kumandayı göster
app.on('browser-window-focus', () => {
  if (remoteWindow && !remoteWindow.isDestroyed() && mainWindow.isVisible()) {
    remoteWindow.show();
    // Geri geldiğinde konumu tekrar doğrula
    const bounds = mainWindow.getBounds();
    remoteWindow.setPosition(bounds.x + MAIN_WIDTH, bounds.y);
  }
});

// --- IPC KOMUTLARI ---

// Standart kumanda tuşları (OK, Yönler vb.)
ipcMain.on('remote-control', (event, code) => {
  if (mainWindow) {
    const script = `(function() {
        const eventData = { keyCode: ${code}, which: ${code}, bubbles: true };
        document.dispatchEvent(new KeyboardEvent('keydown', eventData));
        document.dispatchEvent(new KeyboardEvent('keyup', eventData));
      })();`;
    mainWindow.webContents.executeJavaScript(script);
  }
});

// EXIT butonundan gelen özel temizlik script'i
ipcMain.on('execute-code', (event, script) => {
  if (mainWindow) {
    mainWindow.webContents.executeJavaScript(script);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});