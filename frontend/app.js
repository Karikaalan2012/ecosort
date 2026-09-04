// ==========================================================
// EcoSort frontend logic
// Talks to the Flask API at API_BASE. If the backend isn't
// running (e.g. a judge just opens index.html), everything
// falls back to an equivalent client-side implementation so
// the demo never hard-fails.
// ==========================================================

const API_BASE = "http://127.0.0.1:5000/api";
const CURRENT_USER = "guest_" + Math.floor(Math.random() * 900 + 100);

// ---- local mirror of backend/data.py, used only if the API is unreachable ----
const LOCAL_CATEGORY_KEYWORDS = {
  recyclable: ["bottle","can","carton","newspaper","cardboard","envelope","jar","tin","aluminum","milk_can","beer_glass","wine_bottle","pop_bottle","water_bottle","soda","magazine","book_jacket","packet","paperback"],
  compost: ["banana","orange","lemon","apple","pineapple","strawberry","broccoli","cucumber","mushroom","corn","fig","pomegranate","artichoke","zucchini","bell_pepper","cabbage","squash","eggshell","coffee"],
  hazardous: ["battery","syringe","lighter","spray_can","thermometer","fluorescent","paint","gasoline","cell_phone","remote_control","ipod","laptop","hard_disc","printer","power_drill"],
  landfill: ["diaper","styrofoam","plastic_bag","wrapper","cigarette","rubber_eraser","shower_cap","sponge"],
};
const LOCAL_TIPS = {
  recyclable:{label:"Recyclable",color:"#2E7DD6",tip:"Rinse residue out and drop it in the blue bin. Flatten cartons and boxes to save space."},
  compost:{label:"Compost",color:"#4C9A2A",tip:"Food scraps and yard waste go in the green bin. Skip anything oily or meat-heavy if you're home composting."},
  hazardous:{label:"Hazardous / E-Waste",color:"#D6472E",tip:"Never bin this. Drop it at a designated e-waste or household hazardous waste depot."},
  landfill:{label:"Landfill",color:"#8C8C7E",tip:"Not recyclable or compostable in most municipal programs — goes in the black/grey bin."},
};
const LOCAL_SCHEDULES = {
  A:{recyclable:"Monday",compost:"Wednesday",landfill:"Friday"},
  B:{recyclable:"Tuesday",compost:"Thursday",landfill:"Monday"},
  C:{recyclable:"Wednesday",compost:"Friday",landfill:"Tuesday"},
  D:{recyclable:"Thursday",compost:"Monday",landfill:"Wednesday"},
};
let localScore = 0;
let localLeaderboard = {};
let localScans = [];
let localReports = [];

function localClassify(rawLabel){
  const label = rawLabel.toLowerCase();
  for (const [cat, keywords] of Object.entries(LOCAL_CATEGORY_KEYWORDS)){
    if (keywords.some(k => label.includes(k))) return cat;
  }
  return "landfill";
}

async function apiPost(path, body){
  try{
    const res = await fetch(`${API_BASE}${path}`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body),
    });
    if (!res.ok) throw new Error("bad status");
    return await res.json();
  }catch(e){ return null; }
}
async function apiGet(path){
  try{
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error("bad status");
    return await res.json();
  }catch(e){ return null; }
}

// ---------------- tabs ----------------
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "map") setTimeout(()=>map && map.invalidateSize(), 50);
    if (btn.dataset.tab === "board") refreshLeaderboard();
    if (btn.dataset.tab === "dash") refreshStats();
    if (btn.dataset.tab === "schedule") refreshSchedule();
  });
});

// ---------------- camera + vision model ----------------
let mobilenetModel = null;
const video = document.getElementById("cam");
const canvas = document.getElementById("camCanvas");
const startCamBtn = document.getElementById("startCam");
const captureBtn = document.getElementById("captureBtn");
const fileInput = document.getElementById("fileInput");
const modelStatus = document.getElementById("modelStatus");

async function loadModel(){
  try{
    mobilenetModel = await mobilenet.load();
    modelStatus.textContent = "Vision model ready.";
  }catch(e){
    modelStatus.textContent = "Model failed to load — check your connection. Classification will be disabled.";
  }
}
loadModel();

startCamBtn.addEventListener("click", async ()=>{
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment" } });
    video.srcObject = stream;
    captureBtn.disabled = false;
    startCamBtn.textContent = "Camera Live";
    startCamBtn.disabled = true;
  }catch(e){
    modelStatus.textContent = "Camera unavailable — use Upload Photo instead.";
  }
});

captureBtn.addEventListener("click", async ()=>{
  canvas.width = video.videoWidth || 320;
  canvas.height = video.videoHeight || 240;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  await classifyImageElement(canvas);
});

fileInput.addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = async ()=>{
    canvas.width = img.width; canvas.height = img.height;
    canvas.getContext("2d").drawImage(img,0,0);
    await classifyImageElement(canvas);
  };
  img.src = URL.createObjectURL(file);
});

async function classifyImageElement(imgEl){
  if (!mobilenetModel){
    modelStatus.textContent = "Model still loading, try again in a second…";
    return;
  }
  const predictions = await mobilenetModel.classify(imgEl);
  if (!predictions.length) return;
  const rawLabel = predictions[0].className.split(",")[0].trim().replace(/\s+/g, "_");
  await handleClassification(rawLabel);
}

async function handleClassification(rawLabel){
  let result = await apiPost("/classify", { label: rawLabel });
  let category, display, color, tip;

  if (result){
    ({ category, display, color, tip } = result);
  } else {
    category = localClassify(rawLabel);
    ({ label: display, color, tip } = LOCAL_TIPS[category]);
  }

  animateSort(category);
  showResult(rawLabel, display, color, tip);
  await logScan(rawLabel);
}

function animateSort(category){
  document.querySelectorAll(".lane").forEach(l=>l.classList.remove("hit"));
  const laneEls = Array.from(document.querySelectorAll(".lane"));
  const target = document.querySelector(`.lane[data-cat="${category}"]`);
  const puck = document.getElementById("itemPuck");
  puck.hidden = false;
  puck.textContent = "ITEM";
  puck.style.left = "16px";
  requestAnimationFrame(()=>{
    const idx = laneEls.indexOf(target);
    const laneWidth = target.parentElement.clientWidth / laneEls.length;
    puck.style.left = `${idx * laneWidth + laneWidth/2 - 24}px`;
  });
  setTimeout(()=> target && target.classList.add("hit"), 900);
}

function showResult(rawLabel, display, color, tip){
  document.getElementById("resultCard").hidden = false;
  document.getElementById("resultSwatch").style.background = color;
  document.getElementById("resultLabel").textContent = display;
  document.getElementById("resultRaw").textContent = rawLabel.replace(/_/g," ");
  document.getElementById("resultTip").textContent = tip;
}

async function logScan(rawLabel){
  const result = await apiPost("/scan", { user: CURRENT_USER, label: rawLabel });
  if (result){
    document.getElementById("userScore").textContent = result.total_points;
  } else {
    localScore += 10;
    localScans.push({ user: CURRENT_USER, label: rawLabel, category: localClassify(rawLabel) });
    localLeaderboard[CURRENT_USER] = localScore;
    document.getElementById("userScore").textContent = localScore;
  }
}

// ---------------- map + reports ----------------
let map, pickedLatLng = null;
function initMap(){
  map = L.map("map", { scrollWheelZoom:false }).setView([43.2557, -79.8711], 12); // Hamilton, ON — DeltaHacks' home turf
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);

  map.on("click", (e)=>{
    pickedLatLng = e.latlng;
    document.getElementById("pickedLatLng").textContent = `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
    document.getElementById("submitReport").disabled = false;
    if (window._pickMarker) map.removeLayer(window._pickMarker);
    window._pickMarker = L.marker(e.latlng).addTo(map);
  });

  refreshReportPins();
}
initMap();

const severityColor = { low:"#4C9A2A", medium:"#E8B33D", high:"#D6472E" };

async function refreshReportPins(){
  const reports = (await apiGet("/reports")) || localReports;
  (reports || []).forEach(r=>{
    L.circleMarker([r.lat, r.lng], {
      radius: 8, color: severityColor[r.severity] || "#8C8C7E",
      fillColor: severityColor[r.severity] || "#8C8C7E", fillOpacity:0.8,
    }).addTo(map).bindPopup(`<strong>${r.severity.toUpperCase()}</strong><br>${r.note || "no notes"}`);
  });
}

document.getElementById("reportForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  if (!pickedLatLng) return;
  const body = {
    user: CURRENT_USER,
    lat: pickedLatLng.lat,
    lng: pickedLatLng.lng,
    note: document.getElementById("note").value,
    severity: document.getElementById("severity").value,
  };
  const result = await apiPost("/report", body);
  if (result){
    document.getElementById("userScore").textContent = result.total_points;
  } else {
    localScore += 25;
    localReports.push(body);
    localLeaderboard[CURRENT_USER] = localScore;
    document.getElementById("userScore").textContent = localScore;
  }
  L.circleMarker(pickedLatLng, {
    radius:8, color: severityColor[body.severity], fillColor: severityColor[body.severity], fillOpacity:0.8,
  }).addTo(map).bindPopup(`<strong>${body.severity.toUpperCase()}</strong><br>${body.note || "no notes"}`);
  e.target.reset();
  document.getElementById("submitReport").disabled = true;
  document.getElementById("pickedLatLng").textContent = "click the map";
});

// ---------------- leaderboard ----------------
async function refreshLeaderboard(){
  const rows = (await apiGet("/leaderboard")) || Object.entries(localLeaderboard)
    .sort((a,b)=>b[1]-a[1])
    .map(([user,points],i)=>({rank:i+1,user,points}));

  const body = document.getElementById("boardBody");
  if (!rows || !rows.length){
    body.innerHTML = `<tr><td colspan="3" class="muted">No activity yet — go scan something.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map(r=>`<tr><td>#${r.rank}</td><td>${r.user}</td><td>${r.points}</td></tr>`).join("");
}

// ---------------- schedule ----------------
async function refreshSchedule(){
  const zone = document.getElementById("zoneSelect").value;
  const result = await apiGet(`/schedule?zone=${zone}`);
  const days = result ? result.pickup_days : LOCAL_SCHEDULES[zone];
  const grid = document.getElementById("scheduleGrid");
  grid.innerHTML = Object.entries(days).map(([cat,day])=>`
    <div class="schedule-item">
      <div class="cat">${cat.toUpperCase()}</div>
      <div class="day">${day}</div>
    </div>`).join("");
}
document.getElementById("zoneSelect").addEventListener("change", refreshSchedule);

// ---------------- dashboard ----------------
let statsChart = null;
async function refreshStats(){
  const result = await apiGet("/stats");
  let totalScans, totalReports, activeUsers, breakdown;
  if (result){
    ({ total_scans: totalScans, total_reports: totalReports, active_users: activeUsers, category_breakdown: breakdown } = result);
  } else {
    totalScans = localScans.length;
    totalReports = localReports.length;
    activeUsers = Object.keys(localLeaderboard).length;
    breakdown = {};
    localScans.forEach(s=> breakdown[s.category] = (breakdown[s.category]||0)+1);
  }

  document.getElementById("statScans").textContent = totalScans;
  document.getElementById("statReports").textContent = totalReports;
  document.getElementById("statUsers").textContent = activeUsers;

  const labels = Object.keys(breakdown);
  const values = Object.values(breakdown);
  const colors = labels.map(l => (LOCAL_TIPS[l] || {}).color || "#8C8C7E");

  const ctx = document.getElementById("statsChart");
  if (statsChart) statsChart.destroy();
  statsChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets:[{ data: values, backgroundColor: colors, borderRadius: 6 }] },
    options: {
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ ticks:{ color:"#B9B6A9", font:{ family:"IBM Plex Mono", size:11 } }, grid:{ display:false } },
        y:{ ticks:{ color:"#B9B6A9" }, grid:{ color:"#3A3C32" }, beginAtZero:true, precision:0 }
      }
    }
  });
}

// initial paint
refreshSchedule();
