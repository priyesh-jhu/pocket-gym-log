import { useEffect, useState } from "react";
import { registerWorkoutPWA } from "./pwa.js";

export default function PWAStatus() {
  const [online,setOnline]=useState(()=>typeof navigator==="undefined"?true:navigator.onLine);
  const [applyUpdate,setApplyUpdate]=useState(null);
  const [installPrompt,setInstallPrompt]=useState(null);

  useEffect(()=>{
    const wentOnline=()=>setOnline(true), wentOffline=()=>setOnline(false);
    const canInstall=event=>{event.preventDefault();setInstallPrompt(event);};
    window.addEventListener("online",wentOnline); window.addEventListener("offline",wentOffline); window.addEventListener("beforeinstallprompt",canInstall);
    const unregister=registerWorkoutPWA({onUpdate:callback=>setApplyUpdate(()=>callback)});
    return ()=>{window.removeEventListener("online",wentOnline);window.removeEventListener("offline",wentOffline);window.removeEventListener("beforeinstallprompt",canInstall);unregister();};
  },[]);

  async function install() {
    await installPrompt?.prompt();
    setInstallPrompt(null);
  }

  if (online&&!applyUpdate&&!installPrompt) return null;
  return <div style={{position:"fixed",top:8,left:"50%",transform:"translateX(-50%)",zIndex:250,width:"calc(100% - 24px)",maxWidth:680,display:"flex",flexDirection:"column",gap:6,pointerEvents:"none"}}>
    {!online&&<div role="status" style={{background:"#2A2112",border:"1px solid #7C5B16",borderRadius:10,padding:"9px 12px",color:"#FBBF24",fontSize:11,fontWeight:700,boxShadow:"0 5px 20px rgba(0,0,0,.45)"}}>Offline mode · workouts and drafts remain saved on this device and will sync when you reconnect.</div>}
    {applyUpdate&&<div role="status" style={{background:"#111D31",border:"1px solid #2457A6",borderRadius:10,padding:"8px 10px",color:"#93C5FD",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:10,pointerEvents:"auto",boxShadow:"0 5px 20px rgba(0,0,0,.45)"}}><span style={{flex:1}}>A new app version is ready.</span><button onClick={applyUpdate} style={{background:"#3B82F6",border:"none",borderRadius:7,padding:"5px 10px",color:"#fff",fontSize:10,fontWeight:800,cursor:"pointer"}}>Update safely</button><button onClick={()=>setApplyUpdate(null)} aria-label="Dismiss update" style={{background:"none",border:"none",color:"#7187A8",fontSize:16,cursor:"pointer"}}>×</button></div>}
    {installPrompt&&<div style={{background:"#13251B",border:"1px solid #245C37",borderRadius:10,padding:"8px 10px",color:"#86EFAC",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:10,pointerEvents:"auto",boxShadow:"0 5px 20px rgba(0,0,0,.45)"}}><span style={{flex:1}}>Install Pocket Gym Log for quicker offline access.</span><button onClick={install} style={{background:"#22C55E",border:"none",borderRadius:7,padding:"5px 10px",color:"#07120A",fontSize:10,fontWeight:800,cursor:"pointer"}}>Install</button><button onClick={()=>setInstallPrompt(null)} aria-label="Dismiss install" style={{background:"none",border:"none",color:"#63856F",fontSize:16,cursor:"pointer"}}>×</button></div>}
  </div>;
}
