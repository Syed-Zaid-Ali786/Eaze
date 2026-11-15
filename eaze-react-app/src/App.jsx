import React, { useEffect, useState } from "react";
import { AppProvider, useAppContext } from "./context/AppContext";
import { isFullscreen, onFullscreenChange } from "./lib/desktop";
import WindowBar from "./components/WindowBar";
import Toolbar from "./components/Toolbar";
import Sidebar from "./components/Sidebar";
import BlocksBar from "./components/BlocksBar";
import Editor from "./components/Editor";
import Console from "./components/Console";
import SettingsModal from "./components/SettingsModal";
import TemplatesModal from "./components/TemplatesModal";
import HelpModal from "./components/HelpModal";
import AIPanel from "./components/AIPanel";
import "./App.css";
import "./studio.css";

const AppContent = () => {
  const {
    activeFile,
    updateActiveFileContent,
    modals,
    setModals,
    sidebarCollapsed,
    isDesktop,
    settings,
    files,
  } = useAppContext();

  // Desktop only: hide our window bar while the window is fullscreen.
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!isDesktop) return undefined;
    let alive = true;
    isFullscreen().then((value) => {
      if (alive) setFullscreen(!!value);
    });
    const unsubscribe = onFullscreenChange((value) => setFullscreen(!!value));
    return () => {
      alive = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [isDesktop]);

  const showWindowBar = isDesktop && !fullscreen;

  const handleInsertSnippet = (snippet) => {
    updateActiveFileContent(
      activeFile.content + (activeFile.content ? "\n" : "") + snippet,
    );
  };

  const closeModal = (name) => {
    setModals((prev) => ({ ...prev, [name]: false }));
  };

  return (
    <div className="app-root" data-window-bar={showWindowBar ? "true" : undefined}>
      {showWindowBar && <WindowBar />}

      <div className="frame-wrap">
        <div
          className="app-frame"
          data-sidebar-collapsed={sidebarCollapsed ? "true" : undefined}
        >
          <Toolbar />
          <div className="app-shell">
            <Sidebar />
            <main className="main">
              <div className="workspace-heading">
                <div><span className="eyebrow">YOUR CODING SPACE</span><h1>A little code. A lot of possibility.</h1><p>Think it. Write it. Watch it work.</p></div>
                <span className="language-badge"><span className="status-dot" /> Eaze language</span>
              </div>
              <div className="workspace">
                <div className="code-column">
                <Editor
                  code={activeFile.content}
                  onCodeChange={updateActiveFileContent}
                />
                <BlocksBar onInsert={handleInsertSnippet} />
                </div>
                <Console />
              </div>
            </main>

            <AIPanel />
          </div>
          <footer className="statusbar"><span><span className="status-dot" /> All systems ready</span><span>{files.length} files in workspace</span><span className="statusbar-right">{settings.liveMode ? "Live execution on" : "F5 to run"}<span>Eaze 1.0</span></span></footer>

          <SettingsModal
            isOpen={modals.settings}
            onClose={() => closeModal("settings")}
          />
          <TemplatesModal
            isOpen={modals.templates}
            onClose={() => closeModal("templates")}
          />
          <HelpModal isOpen={modals.help} onClose={() => closeModal("help")} />
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
