// ─── ERROR BOUNDARY ────────────────────────────────────────────────────────
// Last line of defence: if App ever throws during render (a bad localStorage
// shape that slipped past validation, a future regression, anything), this
// stops the screen from going permanently blank. It never touches storage —
// only reads it, to hand the user a raw JSON dump of every workout-* key so
// they can rescue their history even when the app itself cannot render.
import { Component } from "react";

function dumpWorkoutStorage() {
  const data = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.indexOf("workout-") === 0) data[key] = window.localStorage.getItem(key);
    }
  } catch { /* best effort — still show the reload/retry screen */ }
  return data;
}

function downloadRawBackup() {
  try {
    const blob = new Blob([JSON.stringify(dumpWorkoutStorage(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "workout-raw-backup-" + Date.now() + ".json" });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch { /* nothing more we can do from here */ }
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    // A thrown falsy value (`throw null`, `throw undefined`) must still count
    // as an error — otherwise `state.error` is falsy and render() below
    // decides there's nothing wrong, re-rendering the tree that just threw.
    return { error: error ?? new Error("Unknown error") };
  }

  componentDidCatch(error) {
    console.error("Render error caught by ErrorBoundary:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{background:"#08090E",color:"#ECEAF4",minHeight:"100vh",fontFamily:"'DM Sans','Segoe UI',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{maxWidth:520,width:"100%"}}>
          <div style={{fontSize:20,fontWeight:800,marginBottom:10}}>Something went wrong</div>
          <div style={{fontSize:13,color:"#9CA3AF",lineHeight:1.6,marginBottom:12}}>
            The app hit an error it couldn't recover from and can't render right now.
            Nothing has been deleted — your data is still on this device.
          </div>
          <pre style={{background:"#0F1018",border:"1px solid #16172A",borderRadius:10,padding:"12px 14px",fontSize:12,color:"#F87171",whiteSpace:"pre-wrap",wordBreak:"break-word",marginBottom:16,maxHeight:200,overflowY:"auto"}}>
            {String((this.state.error && (this.state.error.stack || this.state.error.message)) || this.state.error)}
          </pre>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button onClick={() => window.location.reload()}
              style={{background:"#3B82F6",border:"none",borderRadius:8,padding:"10px 18px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              Reload
            </button>
            <button onClick={downloadRawBackup}
              style={{background:"#13141F",border:"1px solid #2A2A3A",borderRadius:8,padding:"10px 18px",color:"#ECEAF4",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              Download my data
            </button>
          </div>
        </div>
      </div>
    );
  }
}
