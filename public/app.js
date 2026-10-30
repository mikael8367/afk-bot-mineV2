const $=selector=>document.querySelector(selector);
const OPTION_IDS={
  autoReconnect:"#opt-reconnect",
  autoRespawn:"#opt-respawn",
  autoEat:"#opt-eat",
  autoEquipArmor:"#opt-armor",
  autoEquipShield:"#opt-shield"
};
const heldControls=new Set();

function tab(name) {
  document.querySelectorAll(".page").forEach(page=>page.classList.toggle("active",page.id==="page-"+name));
  document.querySelectorAll("[data-tab]").forEach(button=>button.classList.toggle("selected",button.dataset.tab===name));
  if(name!=="bots") releaseAllControls();
}
document.querySelectorAll("[data-tab]").forEach(button=>button.addEventListener("click",()=>tab(button.dataset.tab)));
document.querySelectorAll("[data-go]").forEach(button=>button.addEventListener("click",()=>tab(button.dataset.go)));

async function api(url,options={}) {
  const response=await fetch(url,{...options,credentials:"same-origin",headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw Error(data.error||"HTTP "+response.status);
  return data;
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
function status(data) {
  const online=data.state==="online",connecting=data.state==="connecting";
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
  catch(error) { $("#status").textContent=error.message.includes("401")?"Abra o link privado":"API indisponível"; }
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
}
function releaseControl(button) {
  const direction=button.dataset.control;
  if(!heldControls.has(direction)) return;
  heldControls.delete(direction);
  button.classList.remove("pressed");
  void sendControl(direction,false);
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
refreshStatus();
