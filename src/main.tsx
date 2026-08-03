import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "../app/globals.css";
import "./home-navigation.css";
import "./new-recipe.css";
import "./kitchen-tools.css";
import "./taxonomy.css";
import "./settings.css";
import "./branding.css";

registerSW({
  immediate:true,
  onNeedRefresh:()=>window.location.reload(),
  onOfflineReady:()=>console.info("PWA 已可离线运行"),
  onRegisterError:error=>console.error("Service Worker 注册失败",error)
});
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
