const $=selector=>document.querySelector(selector);
const OPTION_IDS={
  autoReconnect:"#opt-reconnect",
  autoRespawn:"#opt-respawn",
  autoEat:"#opt-eat",
  autoEquipArmor:"#opt-armor",
  autoEquipShield:"#opt-shield"
};
const heldControls=new Set();
let controlHeartbeat=null;
let runtimeMode="render";
let localApiSequence=0;
const pendingLocalApi=new Map();

window.__resolveLocalApi=(id,statusCode,raw)=>{
  const pending=pendingLocalApi.get(id);
  if(!pending) return;
  pendingLocalApi.delete(id);
  clearTimeout(pending.timeout);
  let data={};
  try { data=JSON.parse(raw||"{}"); }
  catch { data={error:"Resposta inválida do motor local."}; }
  if(statusCode>=200&&statusCode<300) pending.resolve(data);
  else pending.reject(Error(data.error||"HTTP "+statusCode));
};

function tab(name) {
  document.querySelectorAll(".page").forEach(page=>page.classList.toggle("active",page.id==="page-"+name));
  document.querySelectorAll("[data-tab]").forEach(button=>button.classList.toggle("selected",button.dataset.tab===name));
  if(name!=="bots") releaseAllControls();
}
document.querySelectorAll("[data-tab]").forEach(button=>button.addEventListener("click",()=>tab(button.dataset.tab)));
document.querySelectorAll("[data-go]").forEach(button=>button.addEventListener("click",()=>tab(button.dataset.go)));

function nativeApiRequest(methodName,url,options={}) {
  if(!window.AndroidBotBridge?.[methodName]) throw Error("Ponte Android indisponível.");
  const method=options.method||"GET";
  const body=typeof options.body==="string"?options.body:"";
  return new Promise((resolve,reject)=>{
    const id="native-"+(++localApiSequence);
    const timeout=setTimeout(()=>{
      pendingLocalApi.delete(id);
      reject(Error("O serviço não respondeu. Verifique a conexão e tente novamente."));
    },20000);
    pendingLocalApi.set(id,{resolve,reject,timeout});
    try { window.AndroidBotBridge[methodName](url,method,body,id); }
    catch(error) {
      clearTimeout(timeout);
      pendingLocalApi.delete(id);
      reject(Error(error?.message||"Falha ao chamar o serviço Android."));
    }
  });
}

async function api(url,options={}) {
  if(runtimeMode==="device") return nativeApiRequest("requestLocalApi",url,options);
  if(window.AndroidBotBridge?.requestRenderApi) return nativeApiRequest("requestRenderApi",url,options);
  const response=await fetch(url,{...options,credentials:"same-origin",headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw Error(data.error||"HTTP "+response.status);
  return data;
}

async function loadVersions() {
  const select=$("#version-select"),note=$("#version-support-note");
  if(!select||!note) return;
  try {
    const catalog=await api("/api/versions");
    const render=()=>{
      const edition=$("#edition").value,entry=catalog[edition],previous=select.value;
      select.replaceChildren(new Option("Detectar automaticamente (recomendado)",""));
      const group=document.createElement("optgroup");
      group.label=edition==="java"?"Java Edition":"Bedrock Edition";
      for(const version of entry?.versions||[]) group.append(new Option(version,version));
      select.append(group);
      if((entry?.versions||[]).includes(previous)) select.value=previous;
      note.textContent=(edition==="java"?"Java":"Bedrock")+" · "+(entry?.versions?.length||0)+" versões/protocolos listados. Mais recente nesta biblioteca: "+(entry?.latest||"indisponível")+". A detecção automática tenta identificar o servidor.";
    };
    $("#edition").addEventListener("change",render);
    render();
  } catch(error) {
    note.textContent="Não foi possível carregar a lista de versões: "+error.message+". Tente recarregar o painel.";
  }
}
function readOptions() {
  return Object.fromEntries(Object.entries(OPTION_IDS).map(([key,selector])=>[key,$(selector).checked]));
}
function applyOptions(options) {
  if(!options) return;
  Object.entries(OPTION_IDS).forEach(([key,selector])=>{
    if(typeof options[key]==="boolean") $(selector).checked=options[key];
  });
}
function applyCapabilities(edition) {
  const java=edition==="java";
  document.querySelectorAll("[data-java-only] input").forEach(input=>{
    input.disabled=!java;
    input.closest(".option-row")?.classList.toggle("unsupported",!java);
  });
  document.querySelectorAll("[data-java-control]").forEach(button=>{
    button.disabled=!java;
    button.classList.toggle("unsupported",!java);
  });
  ["#follow-player","#follow-start","#follow-stop"].forEach(selector=>{
    $(selector).disabled=!java;
    $(selector).classList.toggle("unsupported",!java);
  });
  if(!java) {
    ["#opt-respawn","#opt-eat","#opt-armor","#opt-shield"].forEach(selector=>$(selector).checked=false);
    $("#feature-support").textContent="No Bedrock, estão disponíveis o envio de mensagens e a reconexão automática. Movimento, seguir jogador, renascer, comer e equipar itens exigem o motor Java.";
    $("#follow-state").textContent="Disponível apenas no Java";
  } else {
    $("#feature-support").textContent="Recursos Java: movimentação, navegação, chat, renascer, comer automaticamente e equipar armaduras e escudo.";
    if($("#follow-state").textContent==="Disponível apenas no Java") $("#follow-state").textContent="Parado";
  }
}
async function waitForLocalRuntime() {
  const statusBox=$("#runtime-mode-status");
  statusBox.textContent="Iniciando o Node.js ARM64 e verificando a API local…";
  let lastError=null;
  for(let attempt=0;attempt<40;attempt++) {
    try {
      await api("/health");
      statusBox.textContent="Motor local pronto. Os bots serão executados neste Android.";
      return true;
    } catch(error) {
      lastError=error;
      await new Promise(resolve=>setTimeout(resolve,750));
    }
  }
  throw Error(lastError?.message||"O motor local não iniciou dentro do tempo esperado.");
}

async function changeRuntimeMode(nextMode) {
  const selector=$("#runtime-mode"),statusBox=$("#runtime-mode-status");
  const previous=runtimeMode;
  if(nextMode===previous) return;
  const bridge=window.AndroidBotBridge;
  if(!bridge?.setRuntimeMode) {
    selector.value="render";
    throw Error("A execução no dispositivo está disponível somente dentro do APK Android.");
  }

  try {
    const current=await api("/api/status");
    const botActive=current.state==="online"||current.state==="connecting";
    if(botActive) {
      const origin=previous==="render"?"Render":"dispositivo";
      const destination=nextMode==="device"?"dispositivo":"Render";
      const accepted=confirm("Há um bot ativo no motor "+origin+". Para mudar para "+destination+", será necessário desconectar esse bot. Continuar?");
      if(!accepted) { selector.value=previous; return; }
      await api("/api/disconnect",{method:"POST",body:"{}"});
    }

    const result=bridge.setRuntimeMode(nextMode);
    if(result!=="ok") throw Error(String(result||"Não foi possível alterar o modo."));
    runtimeMode=nextMode;
    selector.value=nextMode;

    if(nextMode==="device") {
      await waitForLocalRuntime();
    } else {
      statusBox.textContent="Modo Render selecionado. O bot será executado no servidor remoto.";
    }
    await refreshStatus();
    await loadVersions();
    if($("#page-logs").classList.contains("active")) await logs();
  } catch(error) {
    try { bridge.setRuntimeMode(previous); } catch {}
    runtimeMode=previous;
    selector.value=previous;
    statusBox.textContent="Não foi possível mudar o modo: "+error.message;
    throw error;
  }
}

async function initializeRuntimeMode() {
  const selector=$("#runtime-mode"),statusBox=$("#runtime-mode-status");
  const bridge=window.AndroidBotBridge;
  if(!selector) return;
  if(!bridge?.getRuntimeMode) {
    selector.value="render";
    selector.querySelector('option[value="device"]').disabled=true;
    statusBox.textContent="Render disponível. Para usar o motor no celular, abra o aplicativo Android.";
    return;
  }
  try {
    runtimeMode=bridge.getRuntimeMode()==="device"?"device":"render";
  } catch { runtimeMode="render"; }
  selector.value=runtimeMode;
  selector.addEventListener("change",async()=>{
    const requested=selector.value;
    try { await changeRuntimeMode(requested); }
    catch { /* Error detail is shown in the status line. */ }
  });
  if(runtimeMode==="device") {
    try { await waitForLocalRuntime(); }
    catch(error) {
      try { bridge.setRuntimeMode("render"); } catch {}
      runtimeMode="render";
      selector.value="render";
      statusBox.textContent="O motor local não iniciou: "+error.message+". O painel voltou ao modo Render.";
    }
  } else {
    statusBox.textContent="Modo Render selecionado. O bot será executado no servidor remoto.";
  }
}

function status(data) {
  const online=data.state==="online",connecting=data.state==="connecting";
  if (online || connecting) {
    if(runtimeMode==="render") {
      try { window.AndroidBotBridge?.setBotActive(true,"render"); } catch {}
    }
  }
  $("#status").textContent=online?"Conectado":connecting?"Conectando":data.state==="error"?"Erro":"Desconectado";
  $("#status").classList.toggle("online",online);
  $("#state").textContent=online?"Conectado":connecting?"Conectando...":data.state==="error"?"Erro":"Desconectado";
  $("#pulse").classList.toggle("online",online);
  $("#server-label").textContent=data.config?data.config.edition.toUpperCase()+" · "+data.config.host+":"+data.config.port:"Nenhum servidor configurado";
  applyCapabilities(data.config?.edition||$("#edition").value);
  if(data.options) applyOptions(data.options);
}
async function refreshStatus() {
  try { status(await api("/api/status")); }
  catch(error) { $("#status").textContent="API indisponível"; }
}
$("#edition").addEventListener("change",()=>applyCapabilities($("#edition").value));

$("#connect-form").onsubmit=async event=>{
  event.preventDefault();
  const payload=Object.fromEntries(new FormData(event.currentTarget));
  payload.port=Number(payload.port||(payload.edition==="bedrock"?19132:25565));
  payload.options=readOptions();
  $("#message").textContent="Conectando...";
  try {
    const data=await api("/api/connect",{method:"POST",body:JSON.stringify(payload)});
    status(data);
    $("#message").textContent="Solicitação enviada. Acompanhe o estado na tela inicial.";
    tab("home");
  } catch(error) { $("#message").textContent=error.message; }
};

$("#options-form").onsubmit=async event=>{
  event.preventDefault();
  try {
    const data=await api("/api/options",{method:"POST",body:JSON.stringify(readOptions())});
    applyOptions(data.options);
    $("#options-message").textContent="Opções salvas e aplicadas ao bot.";
  } catch(error) { $("#options-message").textContent=error.message; }
};

async function sendControl(direction,active) {
  try {
    await api("/api/control",{method:"POST",body:JSON.stringify({direction,active})});
    $("#control-feedback").textContent=active?"Movimento ativo: "+direction:"";
  } catch(error) { $("#control-feedback").textContent=error.message; }
}
function pressControl(button,event) {
  const direction=button.dataset.control;
  if(heldControls.has(direction)) return;
  heldControls.add(direction);
  button.classList.add("pressed");
  try { button.setPointerCapture?.(event.pointerId); } catch {}
  void sendControl(direction,true);
  if(!controlHeartbeat) controlHeartbeat=setInterval(()=>heldControls.forEach(name=>void sendControl(name,true)),1200);
}
function releaseControl(button) {
  const direction=button.dataset.control;
  if(!heldControls.has(direction)) return;
  heldControls.delete(direction);
  button.classList.remove("pressed");
  void sendControl(direction,false);
  if(heldControls.size===0&&controlHeartbeat){clearInterval(controlHeartbeat);controlHeartbeat=null;}
}
function releaseAllControls() {
  document.querySelectorAll("[data-control]").forEach(button=>releaseControl(button));
}
document.querySelectorAll("[data-control]").forEach(button=>{
  button.addEventListener("pointerdown",event=>{event.preventDefault();pressControl(button,event);});
  button.addEventListener("pointerup",()=>releaseControl(button));
  button.addEventListener("pointercancel",()=>releaseControl(button));
  button.addEventListener("lostpointercapture",()=>releaseControl(button));
});
window.addEventListener("blur",releaseAllControls);
document.addEventListener("visibilitychange",()=>{if(document.hidden)releaseAllControls();});

$("#chat-form").onsubmit=async event=>{
  event.preventDefault();
  const input=$("#chat-message"),message=input.value.trim();
  if(!message) return;
  $("#chat-status").textContent="Enviando...";
  try {
    await api("/api/chat",{method:"POST",body:JSON.stringify({message})});
    $("#chat-status").textContent="Mensagem enviada.";
    input.value="";
    if($("#page-logs").classList.contains("active")) await logs();
  } catch(error) { $("#chat-status").textContent=error.message; }
};
$("#follow-start").onclick=async()=>{
  const player=$("#follow-player").value.trim();
  $("#follow-state").textContent="Procurando jogador...";
  try {
    await api("/api/follow",{method:"POST",body:JSON.stringify({player,active:true})});
    $("#follow-state").textContent="Seguindo "+player;
  } catch(error) { $("#follow-state").textContent=error.message; }
};
$("#follow-stop").onclick=async()=>{
  try {
    await api("/api/follow",{method:"POST",body:JSON.stringify({active:false})});
    $("#follow-state").textContent="Parado";
  } catch(error) { $("#follow-state").textContent=error.message; }
};

$("#disconnect").onclick=async()=>{
  releaseAllControls();
  try { await api("/api/disconnect",{method:"POST"});await refreshStatus(); }
  catch(error) { $("#message").textContent=error.message; }
};
async function logs() {
  try {
    const data=await api("/api/logs");
    $("#logs").replaceChildren(...data.logs.map(entry=>{
      const element=document.createElement("div");
      element.className="log "+entry.level;
      element.textContent="["+new Date(entry.at).toLocaleTimeString("pt-BR")+"] ["+entry.level+"] "+entry.message;
      return element;
    }));
  } catch(error) { $("#logs").textContent=error.message; }
}
$("#refresh").onclick=logs;
setInterval(()=>{
  refreshStatus();
  if($("#page-logs").classList.contains("active")) logs();
},5000);
applyCapabilities($("#edition").value);
initializeRuntimeMode().then(()=>{
  refreshStatus();
  loadVersions();
});
