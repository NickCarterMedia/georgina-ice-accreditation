const STORAGE_KEY = "georgina-ice-jrc-accreditation";
const HOLDER_KEY = "georgina-ice-jrc-selected-holder";
const REQUESTS_KEY = "georgina-ice-jrc-media-requests";
const CLUB_NAME = "Georgina Ice JR C Hockey Club";
const CATEGORY_COLORS = {
  "Arena Staff": "#0b4ea2",
  "Security": "#9f2234",
  "Media": "#6a2ca0",
  "Player": "#0f7b4d",
  "Team Staff": "#8f5b00"
};
const SCANNER_PRESETS = ["Main Entrance", "Concourse", "Restricted Hallway", "Bench", "Dressing Room", "Ice Surface", "Media Box", "Mixed Zone", "Photo Wells", "Custom Zone"];
const MEDIA_CREDENTIAL_TYPES = [
  "Single Game Photo",
  "Single Game Video",
  "Half Season Photo",
  "Half Season Video",
  "Full Season Photo",
  "Full Season Video"
];
const RINK_POSITIONS = [
  "Home Blue Line Photo Well",
  "Visitor Blue Line Photo Well",
  "Home Goal Line Corner",
  "Visitor Goal Line Corner",
  "Penalty Box Side",
  "Scorekeeper Side",
  "Center Ice Press Bridge",
  "Bench Side Walkway",
  "End Glass Left",
  "End Glass Right"
];
const SCAN_INTERVAL_MS = 1000;

const els = Object.fromEntries(
  [
    "name", "roleType", "roleTitle", "accessLevel", "photoUrl", "expiry", "notes", "escortAllowed",
    "issueBtn", "seedBtn", "clearBtn", "credentialList", "holderSelect", "holderView",
    "statTotal", "statIssued", "statInactive", "startScanBtn", "stopScanBtn", "scannerPreset",
    "customScannerZone", "video", "scanCanvas", "manualScan", "manualVerifyBtn", "scanResult",
    "requestName", "requestOutlet", "requestEmail", "requestPhone", "requestType", "requestGameDate",
    "requestNotes", "requestPositions", "submitRequestBtn", "requestList", "requestTotal",
    "requestPending", "requestApproved", "adminRequestList", "adminRequestTotal", "adminRequestPending",
    "adminRequestApproved", "adminRequestRejected"
  ].map((id) => [id, document.getElementById(id)])
);

let credentials = loadJson(STORAGE_KEY);
let mediaRequests = loadJson(REQUESTS_KEY);
let scanStream = null;
let scanFrameId = null;
let lastScanAt = 0;

function uid(prefix = "GIC") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString().slice(-5)}`;
}

function loadJson(key) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveCredentials() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

function saveRequests() {
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(mediaRequests));
}

function getHolderId() {
  return localStorage.getItem(HOLDER_KEY) || "";
}

function setHolderId(id) {
  localStorage.setItem(HOLDER_KEY, id);
}

function statusClass(status) {
  return String(status || "").toLowerCase().replace(/\s+/g, "-");
}

function formatDate(value) {
  if (!value) return "No expiry set";
  return new Date(value + "T00:00:00").toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString();
}

function isExpired(credential) {
  if (!credential.expiry) return false;
  return new Date(credential.expiry + "T23:59:59") < new Date();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function qrPayloadFor(credential) {
  return JSON.stringify({
    club: CLUB_NAME,
    id: credential.id,
    issuedAt: credential.issuedAt,
    type: credential.roleType,
    escortAllowed: !!credential.escortAllowed
  });
}

async function copyPayloadForCredential(id) {
  const credential = credentials.find((item) => item.id === id);
  if (!credential) return;
  const payload = qrPayloadFor(credential);

  try {
    await navigator.clipboard.writeText(payload);
    if (els.scanResult) {
      renderScanResult(credential, "Test payload copied. Paste it into Manual QR Payload on the guard page.", "valid");
    } else {
      window.alert("Test payload copied to clipboard.");
    }
  } catch {
    window.prompt("Copy this test payload:", payload);
  }
}

function getScannerZone() {
  if (!els.scannerPreset) return "";
  return els.scannerPreset.value === "Custom Zone" ? (els.customScannerZone?.value.trim() || "") : els.scannerPreset.value;
}

function parseAccessLevels(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function hasZoneAccess(credential, zone) {
  if (!zone) return true;
  return parseAccessLevels(credential.accessLevel).some((item) => item.toLowerCase() === zone.toLowerCase());
}

function activeStatusLabel(credential) {
  if (credential.status === "Issued" && isExpired(credential)) return "Expired";
  return credential.status;
}

function selectedRequestPositions() {
  if (!els.requestPositions) return [];
  return Array.from(els.requestPositions.selectedOptions).map((option) => option.value);
}

function issueCredential() {
  const name = els.name.value.trim();
  const roleType = els.roleType.value;
  const roleTitle = els.roleTitle.value.trim();
  const accessLevel = els.accessLevel.value.trim();
  const photoUrl = els.photoUrl.value.trim();
  const expiry = els.expiry.value;
  const notes = els.notes.value.trim();
  const escortAllowed = !!els.escortAllowed.checked;

  if (!name || !roleTitle || !accessLevel) {
    window.alert("Full name, role/title, and access level are required.");
    return;
  }

  credentials.unshift({
    id: uid(),
    name,
    roleType,
    roleTitle,
    accessLevel,
    photoUrl,
    expiry,
    notes,
    escortAllowed,
    status: "Issued",
    mediaType: roleType === "Media" ? roleTitle : "",
    requestedPositions: [],
    approvedPositions: [],
    issuedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  saveCredentials();
  setHolderId(credentials[0].id);
  resetForm();
  renderAll();
}

function resetForm() {
  if (!els.name) return;
  els.name.value = "";
  els.roleTitle.value = "";
  els.accessLevel.value = "";
  els.photoUrl.value = "";
  els.expiry.value = "";
  els.notes.value = "";
  els.escortAllowed.checked = false;
  els.roleType.value = "Arena Staff";
}

function mutateCredential(id, patch) {
  credentials = credentials.map((credential) =>
    credential.id === id ? { ...credential, ...patch, updatedAt: new Date().toISOString() } : credential
  );
  saveCredentials();
  renderAll();
}

function deleteAllCredentials() {
  if (!window.confirm("Clear every credential and media request from this device?")) return;
  credentials = [];
  mediaRequests = [];
  saveCredentials();
  saveRequests();
  localStorage.removeItem(HOLDER_KEY);
  stopScanner();
  renderAll();
  renderScanResult(null, "No credential scanned yet.");
}

function seedDemoData() {
  const now = new Date();
  const plusDays = (days) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  const demoCredentials = [
    {
      id: uid(),
      name: "Mia Thompson",
      roleType: "Security",
      roleTitle: "North Gate Security",
      accessLevel: "Main Entrance, Concourse, Restricted Hallway",
      photoUrl: "",
      expiry: plusDays(120),
      notes: "Lead entry screening on game nights.",
      escortAllowed: false,
      status: "Issued",
      mediaType: "",
      requestedPositions: [],
      approvedPositions: [],
      issuedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: uid(),
      name: "Liam Foster",
      roleType: "Player",
      roleTitle: "Forward #17",
      accessLevel: "Bench, Dressing Room, Ice Surface",
      photoUrl: "",
      expiry: plusDays(90),
      notes: "Home roster.",
      escortAllowed: false,
      status: "Issued",
      mediaType: "",
      requestedPositions: [],
      approvedPositions: [],
      issuedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: uid(),
      name: "Emma Collins",
      roleType: "Media",
      roleTitle: "Full Season Photo",
      accessLevel: "Media Box, Photo Wells, Mixed Zone, Home Blue Line Photo Well",
      photoUrl: "",
      expiry: plusDays(180),
      notes: "Approved staff photographer.",
      escortAllowed: true,
      status: "Issued",
      mediaType: "Full Season Photo",
      requestedPositions: ["Home Blue Line Photo Well", "Photo Wells"],
      approvedPositions: ["Home Blue Line Photo Well", "Photo Wells", "Mixed Zone"],
      issuedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const demoRequests = [
    {
      id: uid("REQ"),
      name: "Noah Grant",
      outlet: "York Region Sports Media",
      email: "noah@example.com",
      phone: "905-555-0138",
      type: "Single Game Video",
      gameDate: plusDays(7),
      notes: "Need post-game scrum access for player features.",
      requestedPositions: ["Mixed Zone", "Center Ice Press Bridge"],
      status: "Pending",
      submittedAt: new Date().toISOString(),
      credentialId: ""
    }
  ];

  credentials = [...demoCredentials, ...credentials];
  mediaRequests = [...demoRequests, ...mediaRequests];
  saveCredentials();
  saveRequests();
  setHolderId(demoCredentials[0].id);
  renderAll();
}

function submitMediaRequest() {
  const name = els.requestName?.value.trim();
  const outlet = els.requestOutlet?.value.trim();
  const email = els.requestEmail?.value.trim();
  const phone = els.requestPhone?.value.trim();
  const type = els.requestType?.value;
  const gameDate = els.requestGameDate?.value;
  const notes = els.requestNotes?.value.trim();
  const requestedPositions = selectedRequestPositions();

  if (!name || !outlet || !email || !type) {
    window.alert("Name, outlet, email, and credential type are required.");
    return;
  }

  if (type.startsWith("Single Game") && !gameDate) {
    window.alert("Single-game requests require a game date.");
    return;
  }

  mediaRequests.unshift({
    id: uid("REQ"),
    name,
    outlet,
    email,
    phone,
    type,
    gameDate,
    notes,
    requestedPositions,
    status: "Pending",
    submittedAt: new Date().toISOString(),
    credentialId: ""
  });

  saveRequests();
  resetRequestForm();
  renderAll();
}

function resetRequestForm() {
  if (!els.requestName) return;
  els.requestName.value = "";
  els.requestOutlet.value = "";
  els.requestEmail.value = "";
  if (els.requestPhone) els.requestPhone.value = "";
  els.requestType.value = MEDIA_CREDENTIAL_TYPES[0];
  els.requestGameDate.value = "";
  els.requestNotes.value = "";
  Array.from(els.requestPositions.options).forEach((option) => { option.selected = false; });
}

function requestBadgeText(request) {
  return request.status + (request.credentialId ? " / Credentialed" : "");
}

function renderStats() {
  if (els.statTotal) {
    const issued = credentials.filter((item) => item.status === "Issued" && !isExpired(item)).length;
    els.statTotal.textContent = credentials.length;
    els.statIssued.textContent = issued;
    els.statInactive.textContent = credentials.length - issued;
  }

  if (els.requestTotal) {
    els.requestTotal.textContent = mediaRequests.length;
    els.requestPending.textContent = mediaRequests.filter((item) => item.status === "Pending").length;
    els.requestApproved.textContent = mediaRequests.filter((item) => item.status === "Approved").length;
  }

  if (els.adminRequestTotal) {
    els.adminRequestTotal.textContent = mediaRequests.length;
    els.adminRequestPending.textContent = mediaRequests.filter((item) => item.status === "Pending").length;
    els.adminRequestApproved.textContent = mediaRequests.filter((item) => item.status === "Approved").length;
    els.adminRequestRejected.textContent = mediaRequests.filter((item) => item.status === "Rejected").length;
  }
}

function renderCredentialList() {
  if (!els.credentialList) return;
  if (!credentials.length) {
    els.credentialList.innerHTML = '<div class="empty-state">No credentials issued yet. Use the form above or approve a media request.</div>';
    return;
  }

  els.credentialList.innerHTML = credentials.map((credential) => `
    <article class="credential-row">
      <header>
        <div>
          <h3>${escapeHtml(credential.name)}</h3>
          <div class="meta">${escapeHtml(credential.roleType)} • ${escapeHtml(credential.roleTitle)}</div>
        </div>
        <span class="badge ${statusClass(credential.status)}">${escapeHtml(activeStatusLabel(credential))}</span>
      </header>
      <div class="meta">
        ID: ${escapeHtml(credential.id)}<br>
        Access: ${escapeHtml(credential.accessLevel)}<br>
        Escort Override: ${credential.escortAllowed ? "Allowed" : "Not Allowed"}<br>
        ${credential.approvedPositions?.length ? `Approved Positions: ${escapeHtml(credential.approvedPositions.join(", "))}<br>` : ""}
        Expires: ${escapeHtml(formatDate(credential.expiry))}
      </div>
      <div class="row-actions">
        <button class="mini secondary" data-action="holder" data-id="${credential.id}">Open Manager</button>
        <button class="mini secondary" data-action="copy" data-id="${credential.id}">Copy Test Payload</button>
        <button class="mini secondary" data-action="issue" data-id="${credential.id}">Set Issued</button>
        <button class="mini secondary" data-action="suspend" data-id="${credential.id}">Suspend</button>
        <button class="mini danger" data-action="revoke" data-id="${credential.id}">Revoke</button>
      </div>
    </article>
  `).join("");
}

function renderAdminRequests() {
  if (!els.adminRequestList) return;
  if (!mediaRequests.length) {
    els.adminRequestList.innerHTML = '<div class="empty-state">No media requests yet.</div>';
    return;
  }

  els.adminRequestList.innerHTML = mediaRequests.map((request) => `
    <article class="credential-row">
      <header>
        <div>
          <h3>${escapeHtml(request.name)}</h3>
          <div class="meta">${escapeHtml(request.outlet)} • ${escapeHtml(request.type)}</div>
        </div>
        <span class="badge ${statusClass(request.status)}">${escapeHtml(requestBadgeText(request))}</span>
      </header>
      <div class="meta">
        Email: ${escapeHtml(request.email)}<br>
        Phone: ${escapeHtml(request.phone || "Not provided")}<br>
        Game Date: ${escapeHtml(request.gameDate ? formatDate(request.gameDate) : "Season credential")}<br>
        Requested Positions: ${escapeHtml(request.requestedPositions?.join(", ") || "None")}<br>
        Submitted: ${escapeHtml(formatDateTime(request.submittedAt))}<br>
        Notes: ${escapeHtml(request.notes || "None")}
      </div>
      <div class="row-actions">
        <button class="mini secondary" data-request-action="approve" data-id="${request.id}">Approve + Issue</button>
        <button class="mini secondary" data-request-action="pending" data-id="${request.id}">Set Pending</button>
        <button class="mini danger" data-request-action="reject" data-id="${request.id}">Reject</button>
      </div>
    </article>
  `).join("");
}

function renderRequesterList() {
  if (!els.requestList) return;
  if (!mediaRequests.length) {
    els.requestList.innerHTML = '<div class="empty-state">No requests submitted from this browser yet.</div>';
    return;
  }

  els.requestList.innerHTML = mediaRequests.map((request) => `
    <article class="credential-row">
      <header>
        <div>
          <h3>${escapeHtml(request.name)}</h3>
          <div class="meta">${escapeHtml(request.type)} • ${escapeHtml(request.outlet)}</div>
        </div>
        <span class="badge ${statusClass(request.status)}">${escapeHtml(requestBadgeText(request))}</span>
      </header>
      <div class="meta">
        ${request.gameDate ? `Game Date: ${escapeHtml(formatDate(request.gameDate))}<br>` : ""}
        Positions: ${escapeHtml(request.requestedPositions?.join(", ") || "None")}<br>
        Submitted: ${escapeHtml(formatDateTime(request.submittedAt))}
      </div>
    </article>
  `).join("");
}

function renderHolderSelect() {
  if (!els.holderSelect) return;
  if (!credentials.length) {
    els.holderSelect.innerHTML = '<option value="">No credentials available</option>';
    return;
  }

  const selectedId = credentials.some((item) => item.id === getHolderId()) ? getHolderId() : credentials[0].id;
  setHolderId(selectedId);

  els.holderSelect.innerHTML = credentials.map((credential) => `
    <option value="${credential.id}" ${credential.id === selectedId ? "selected" : ""}>
      ${credential.name} - ${credential.roleType}
    </option>
  `).join("");
}

function renderHolderCard() {
  if (!els.holderView || !els.holderSelect) return;
  const holder = credentials.find((item) => item.id === els.holderSelect.value);
  if (!holder) {
    els.holderView.innerHTML = '<div class="empty-state">Select a credential to display the pass.</div>';
    return;
  }

  const color = CATEGORY_COLORS[holder.roleType] || "#0b4ea2";
  els.holderView.innerHTML = `
    <section class="credential-card" style="background:
      linear-gradient(135deg, ${color}, rgba(8, 47, 102, 0.92)),
      linear-gradient(135deg, rgba(213, 170, 57, 0.18), transparent);">
      <p class="card-topline">${escapeHtml(CLUB_NAME)}</p>
      <h3 class="card-name">${escapeHtml(holder.name)}</h3>
      <p class="card-role">${escapeHtml(holder.roleType)} • ${escapeHtml(holder.roleTitle)}</p>
      <div class="card-detail">
        <div><span>Credential ID</span>${escapeHtml(holder.id)}</div>
        <div><span>Status</span>${escapeHtml(activeStatusLabel(holder))}</div>
        <div><span>Access</span>${escapeHtml(holder.accessLevel)}</div>
        <div><span>Expires</span>${escapeHtml(formatDate(holder.expiry))}</div>
        <div><span>Escort Override</span>${holder.escortAllowed ? "Allowed" : "None"}</div>
        <div><span>Approved Positions</span>${escapeHtml(holder.approvedPositions?.join(", ") || "None")}</div>
      </div>
      <div class="qr-wrap" id="holderQr"></div>
      <div class="actions" style="position:relative; z-index:1; margin-top:16px;">
        <button class="secondary" id="copyHolderPayloadBtn">Copy Test Payload</button>
      </div>
      <p class="fine" style="margin-top:16px;">Present this QR code to arena security for entry verification.</p>
    </section>
  `;

  const qrTarget = document.getElementById("holderQr");
  qrTarget.innerHTML = "";
  if (typeof QRCode !== "undefined") {
    new QRCode(qrTarget, {
      text: qrPayloadFor(holder),
      width: 148,
      height: 148,
      colorDark: "#0f1720",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    qrTarget.innerHTML = '<div class="fine">QR library failed to load.</div>';
  }

  const copyButton = document.getElementById("copyHolderPayloadBtn");
  if (copyButton) {
    copyButton.addEventListener("click", () => copyPayloadForCredential(holder.id));
  }
}

function renderScanResult(credential, message, state) {
  if (!els.scanResult) return;
  if (!credential) {
    els.scanResult.className = "result" + (state ? " " + state : "");
    els.scanResult.innerHTML = escapeHtml(message || "No credential scanned yet.");
    return;
  }

  els.scanResult.className = "result " + state;
  els.scanResult.innerHTML = `
    <strong>${escapeHtml(message)}</strong>
    <div class="meta" style="margin-top:10px;">
      Name: ${escapeHtml(credential.name)}<br>
      Type: ${escapeHtml(credential.roleType)}<br>
      Role: ${escapeHtml(credential.roleTitle)}<br>
      Access: ${escapeHtml(credential.accessLevel)}<br>
      Scanner Zone: ${escapeHtml(getScannerZone() || "General Verification")}<br>
      Approved Positions: ${escapeHtml(credential.approvedPositions?.join(", ") || "None")}<br>
      Escort Override: ${credential.escortAllowed ? "Allowed" : "Not Allowed"}<br>
      Status: ${escapeHtml(activeStatusLabel(credential))}<br>
      Expires: ${escapeHtml(formatDate(credential.expiry))}
    </div>
  `;
}

function approveMediaRequest(requestId) {
  const request = mediaRequests.find((item) => item.id === requestId);
  if (!request) return;

  const accessLevel = ["Media Box", "Mixed Zone", "Photo Wells", ...request.requestedPositions].filter((value, index, all) => all.indexOf(value) === index).join(", ");
  const expiry = request.type.startsWith("Single Game")
    ? request.gameDate
    : request.type.startsWith("Half Season")
      ? addDaysToToday(90)
      : addDaysToToday(180);

  const credential = {
    id: uid(),
    name: request.name,
    roleType: "Media",
    roleTitle: request.type,
    accessLevel,
    photoUrl: "",
    expiry,
    notes: `Issued from media request for ${request.outlet}. ${request.notes || ""}`.trim(),
    escortAllowed: true,
    status: "Issued",
    mediaType: request.type,
    requestedPositions: request.requestedPositions,
    approvedPositions: request.requestedPositions,
    issuedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  credentials.unshift(credential);
  mediaRequests = mediaRequests.map((item) =>
    item.id === requestId ? { ...item, status: "Approved", credentialId: credential.id, updatedAt: new Date().toISOString() } : item
  );
  saveCredentials();
  saveRequests();
  setHolderId(credential.id);
  renderAll();
}

function addDaysToToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function setRequestStatus(requestId, status) {
  mediaRequests = mediaRequests.map((item) =>
    item.id === requestId
      ? { ...item, status, credentialId: status === "Approved" ? item.credentialId : "", updatedAt: new Date().toISOString() }
      : item
  );
  saveRequests();
  renderAll();
}

function verifyPayload(raw) {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    renderScanResult(null, "Invalid QR payload format.", "invalid");
    return;
  }

  const credential = credentials.find((item) => item.id === payload.id);
  if (!credential) return renderScanResult(null, "Credential not found.", "invalid");
  if (payload.club !== CLUB_NAME) return renderScanResult(credential, "Credential rejected: wrong issuing organization.", "invalid");
  if (credential.status === "Revoked") return renderScanResult(credential, "Credential revoked. Deny entry.", "invalid");
  if (credential.status === "Suspended") return renderScanResult(credential, "Credential suspended. Hold and contact admin.", "invalid");
  if (isExpired(credential)) return renderScanResult(credential, "Credential expired. Deny entry.", "invalid");

  const scannerZone = getScannerZone();
  if (!scannerZone) return renderScanResult(null, "Enter a custom scanner zone or pick a checkpoint before verifying.", "invalid");
  if (hasZoneAccess(credential, scannerZone)) return renderScanResult(credential, `Credential valid for ${scannerZone}. Entry approved.`, "valid");
  if (credential.escortAllowed) return renderScanResult(credential, `Access to ${scannerZone} requires a security escort. Entry with escort only.`, "escort");
  renderScanResult(credential, `Credential does not include ${scannerZone}. Deny entry.`, "invalid");
}

async function startScanner() {
  if (!navigator.mediaDevices?.getUserMedia) {
    renderScanResult(null, "Camera scanning is not supported in this browser. Use manual verify.", "invalid");
    return;
  }

  stopScanner();
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    els.video.srcObject = scanStream;
    await els.video.play();
    scanLoop();
  } catch {
    renderScanResult(null, "Camera access failed. Use manual verify instead.", "invalid");
  }
}

function stopScanner() {
  if (scanFrameId) cancelAnimationFrame(scanFrameId);
  scanFrameId = null;
  if (scanStream) scanStream.getTracks().forEach((track) => track.stop());
  scanStream = null;
  if (els.video) els.video.srcObject = null;
}

function scanLoop() {
  if (!scanStream || !els.scanCanvas || !els.video) return;
  const canvas = els.scanCanvas;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (els.video.readyState >= 2) {
    canvas.width = els.video.videoWidth;
    canvas.height = els.video.videoHeight;
    context.drawImage(els.video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(image.data, image.width, image.height);
    if (result?.data) {
      const now = Date.now();
      if (now - lastScanAt >= SCAN_INTERVAL_MS) {
        lastScanAt = now;
        if (els.manualScan) els.manualScan.value = result.data;
        verifyPayload(result.data);
      }
    }
  }

  scanFrameId = requestAnimationFrame(scanLoop);
}

function renderScannerPresets() {
  if (!els.scannerPreset) return;
  const selectedScanner = SCANNER_PRESETS.includes(els.scannerPreset.value) ? els.scannerPreset.value : "Main Entrance";
  els.scannerPreset.innerHTML = SCANNER_PRESETS.map((preset) => `
    <option value="${preset}" ${preset === selectedScanner ? "selected" : ""}>${preset}</option>
  `).join("");
}

function renderRequestTypeOptions() {
  if (els.requestType) {
    const current = MEDIA_CREDENTIAL_TYPES.includes(els.requestType.value) ? els.requestType.value : MEDIA_CREDENTIAL_TYPES[0];
    els.requestType.innerHTML = MEDIA_CREDENTIAL_TYPES.map((type) => `
      <option value="${type}" ${type === current ? "selected" : ""}>${type}</option>
    `).join("");
  }

  if (els.requestPositions) {
    const selected = new Set(selectedRequestPositions());
    els.requestPositions.innerHTML = RINK_POSITIONS.map((position) => `
      <option value="${position}" ${selected.has(position) ? "selected" : ""}>${position}</option>
    `).join("");
  }
}

function renderAll() {
  renderScannerPresets();
  renderRequestTypeOptions();
  renderStats();
  renderCredentialList();
  renderAdminRequests();
  renderRequesterList();
  renderHolderSelect();
  renderHolderCard();
}

if (els.issueBtn) els.issueBtn.addEventListener("click", issueCredential);
if (els.seedBtn) els.seedBtn.addEventListener("click", seedDemoData);
if (els.clearBtn) els.clearBtn.addEventListener("click", deleteAllCredentials);
if (els.submitRequestBtn) els.submitRequestBtn.addEventListener("click", submitMediaRequest);

if (els.credentialList) {
  els.credentialList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.action === "holder") setHolderId(id), renderAll();
    if (button.dataset.action === "copy") copyPayloadForCredential(id);
    if (button.dataset.action === "issue") mutateCredential(id, { status: "Issued" });
    if (button.dataset.action === "suspend") mutateCredential(id, { status: "Suspended" });
    if (button.dataset.action === "revoke") mutateCredential(id, { status: "Revoked" });
  });
}

if (els.adminRequestList) {
  els.adminRequestList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-request-action]");
    if (!button) return;
    const id = button.dataset.id;
    const action = button.dataset.requestAction;
    if (action === "approve") approveMediaRequest(id);
    if (action === "pending") setRequestStatus(id, "Pending");
    if (action === "reject") setRequestStatus(id, "Rejected");
  });
}

if (els.holderSelect) {
  els.holderSelect.addEventListener("change", () => {
    setHolderId(els.holderSelect.value);
    renderHolderCard();
  });
}

if (els.startScanBtn) els.startScanBtn.addEventListener("click", startScanner);
if (els.stopScanBtn) els.stopScanBtn.addEventListener("click", stopScanner);
if (els.manualVerifyBtn) els.manualVerifyBtn.addEventListener("click", () => verifyPayload((els.manualScan?.value || "").trim()));
if (els.scannerPreset) {
  els.scannerPreset.addEventListener("change", () => {
    if (els.scannerPreset.value !== "Custom Zone" && els.customScannerZone) els.customScannerZone.value = "";
  });
}

renderAll();
