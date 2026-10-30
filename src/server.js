import express from "express";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {BotManager} from "./core/bot-manager.js";
import {parseBoolean} from "./core/validation.js";
const app=express(),dir=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT||3000);
const token=process.env.ADMIN_TOKEN||"";
const manager=new BotManager({autoReconnect:parseBoolean(process.env.AUTO_RECONNECT,true),reconnectDelay:Math.max(3000,Number(process.env.RECONNECT_DELAY_MS)||10000)});
app.disable("x-powered-by");app.use(express.json({limit:"10kb"}));app.use(express.static(path.join(dir,"../public")));
app.get("/health",(_q,r)=>r.json({ok:true,service:"afk-bot-mine-v2"}));
app.use("/api",(q,r,next)=>{if(!token||token==="replace-with-a-long-random-secret")return r.status(503).json({error:"Configure ADMIN_TOKEN nas variáveis de ambiente."});const sent=q.get("authorization")?.replace(/^Bearer\\s+/i,"")||"";if(sent.length!==token.length||!Buffer.from(sent).equals(Buffer.from(token)))return r.status(401).json({error:"Token inválido."});next();});
app.get("/api/status",(_q,r)=>r.json(manager.status()));
app.get("/api/logs",(_q,r)=>r.json({logs:manager.getLogs()}));
app.post("/api/connect",(q,r)=>{try{r.status(202).json(manager.connect(q.body));}catch(e){r.status(400).json({error:e.message});}});
app.post("/api/disconnect",(_q,r)=>{manager.disconnect();r.json({ok:true,status:manager.status()});});
const server=app.listen(port,"0.0.0.0",()=>console.log("AFK Bot Mine V2 ativo na porta "+port));
function shutdown(){manager.disconnect("Servidor encerrando.");server.close(()=>process.exit(0));}
process.on("SIGTERM",shutdown);process.on("SIGINT",shutdown);
