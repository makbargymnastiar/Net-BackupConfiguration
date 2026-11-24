// Dashboard JavaScript - English-only UI (no translation layer).

// ============ Global State ============
let oxidizedStatus = {};
let allNodes = [];
let allCredentials = [];
let allModels = [];
let selectedVersions = [];

// ============ Utility Functions ============
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// NOTE: The old top-of-page showAlert() banner has been removed. All
// notifications now use showInfoToast() (bottom pop-up) so feedback is
// consistent and never shifts the page layout.

// Non-blocking inline confirmation toast. Replaces the native browser
// confirm() popup for lightweight actions (triggering a backup, restarting
// Oxidized, deleting groups): a small bar slides up at the bottom with
// Confirm / Cancel and auto-dismisses.
// True while a blocking confirmation (e.g. delete device/group) is on screen,
// so lightweight info toasts never clobber the shared #confirm-toast host and
// orphan the click-blocking backdrop.
let blockingConfirmOpen = false;

function confirmAction(message, onConfirm, opts) {
  opts = opts || {};
  let host = document.getElementById("confirm-toast");
  if (!host) {
    host = document.createElement("div");
    host.id = "confirm-toast";
    host.className = "confirm-toast";
    document.body.appendChild(host);
  }
  // Cancel any pending info-toast auto-hide so it can't dismiss this dialog.
  clearTimeout(host._infoTimer);
  // A blocking confirmation (e.g. deleting a device/group) dims the page with a
  // backdrop and stays until the user explicitly picks Confirm or Cancel —
  // nothing else on screen is clickable meanwhile.
  let backdrop = null;
  if (opts.blocking) {
    backdrop = document.getElementById("confirm-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "confirm-backdrop";
      backdrop.className = "confirm-backdrop";
      document.body.appendChild(backdrop);
    }
    backdrop.classList.add("show");
    blockingConfirmOpen = true;
  }
  host.innerHTML =
    `<span class="confirm-toast-msg">${escapeHtml(message)}</span>` +
    `<span class="confirm-toast-actions">` +
    `<button type="button" class="btn ${
      opts.danger ? "btn-danger" : "btn-success"
    } btn-xs" id="confirm-toast-yes">${
      opts.confirmLabel || "Confirm" }</button>` +
    `<button type="button" class="btn btn-xs" id="confirm-toast-no">Cancel</button>` +
    `</span>`;
  host.classList.add("show");
  const hide = () => {
    host.classList.remove("show");
    if (backdrop) backdrop.classList.remove("show");
    blockingConfirmOpen = false;
  };
  const timer = opts.blocking ? null : setTimeout(hide, 8000);
  document.getElementById("confirm-toast-yes").onclick = () => {
    clearTimeout(timer);
    hide();
    onConfirm();
  };
  document.getElementById("confirm-toast-no").onclick = () => {
    clearTimeout(timer);
    hide();
  };
}

// Informational bottom toast: same visual style as the restart confirmation
// popup, but message-only (no buttons) and auto-dismisses. Used for
// lightweight feedback such as "Config copied to clipboard".
function showInfoToast(message, isError) {
  // Never overwrite a blocking confirmation: the shared #confirm-toast host
  // would lose its Confirm/Cancel buttons while the click-blocking backdrop
  // stays up, leaving the page frozen. Skip the toast until it's resolved.
  if (blockingConfirmOpen) return;
  let host = document.getElementById("confirm-toast");
  if (!host) {
    host = document.createElement("div");
    host.id = "confirm-toast";
    host.className = "confirm-toast";
    document.body.appendChild(host);
  }
  const icon = isError
    ? '<svg class="icon confirm-toast-icon confirm-toast-icon-err" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    : '<svg class="icon confirm-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  host.innerHTML =
    icon + `<span class="confirm-toast-msg">${escapeHtml(message)}</span>`;
  host.classList.add("show");
  clearTimeout(host._infoTimer);
  host._infoTimer = setTimeout(() => host.classList.remove("show"), 3000);
}

// ============ UI Update ============
function updateUI() {
  // Global UI texts
  if (document.getElementById("page-title"))
    document.getElementById("page-title").textContent = "Oxidized";
  if (document.getElementById("title"))
    document.getElementById("title").textContent = "Oxidized";
  if (document.getElementById("subtitle"))
    document.getElementById("subtitle").textContent = "Manage and monitor network device backup configurations in real-time";
  // Logout now lives in the sidebar user block; only touch its text span
  // so the icon markup inside the button is never destroyed.
  const logoutLabel = document.querySelector("#logout-btn span");
  if (logoutLabel) logoutLabel.textContent = "Logout";

  // Tabs
  if (document.getElementById("tab-nodes-label"))
    document.getElementById("tab-nodes-label").textContent = "Device";
  if (document.getElementById("tab-add-node-label"))
    document.getElementById("tab-add-node-label").textContent =
      "Add Device";
  if (document.getElementById("tab-import-label"))
    document.getElementById("tab-import-label").textContent = "Import";
  if (document.getElementById("tab-users-label"))
    document.getElementById("tab-users-label").textContent = "Users";
  if (document.getElementById("tab-credentials-label"))
    document.getElementById("tab-credentials-label").textContent =
      "Credentials";
  if (document.getElementById("tab-models-label"))
    document.getElementById("tab-models-label").textContent = "Models";
  if (document.getElementById("tab-config-label"))
    document.getElementById("tab-config-label").textContent = "Settings";

  // Nodes table headers
  if (document.getElementById("th-name"))
    document.getElementById("th-name").textContent = "Device";
  if (document.getElementById("th-model"))
    document.getElementById("th-model").textContent =
      "Device Model";
  if (document.getElementById("th-connection"))
    document.getElementById("th-connection").textContent =
      "Connection";
  if (document.getElementById("th-oxidized-status"))
    document.getElementById("th-oxidized-status").textContent = "Status";
  if (document.getElementById("th-oxidized-last"))
    document.getElementById("th-oxidized-last").textContent =
      "Latest Backup";
  if (document.getElementById("th-action"))
    document.getElementById("th-action").textContent = "Action";

  // Groups table headers
  if (document.getElementById("th-grp-id"))
    document.getElementById("th-grp-id").textContent = "ID";
  if (document.getElementById("th-grp-name"))
    document.getElementById("th-grp-name").textContent = "Name";
  if (document.getElementById("th-grp-desc"))
    document.getElementById("th-grp-desc").textContent = "Description";
  if (document.getElementById("th-grp-created"))
    document.getElementById("th-grp-created").textContent = "Created";
  if (document.getElementById("th-grp-action"))
    document.getElementById("th-grp-action").textContent = "Action";

  // Credentials headers
  if (document.getElementById("th-cred-enable"))
    document.getElementById("th-cred-enable").textContent = "Enable";
  if (document.getElementById("th-cred-label"))
    document.getElementById("th-cred-label").textContent = "Label";
  if (document.getElementById("th-cred-username"))
    document.getElementById("th-cred-username").textContent =
      "Username";
  if (document.getElementById("th-cred-description"))
    document.getElementById("th-cred-description").textContent =
      "Description";

  // Version History headers
  if (document.getElementById("th-version-number"))
    document.getElementById("th-version-number").textContent =
      "Version";
  if (document.getElementById("th-version-time"))
    document.getElementById("th-version-time").textContent =
      "Time";
  if (document.getElementById("th-version-action"))
    document.getElementById("th-version-action").textContent =
      "Action";

  // Users headers
  if (document.getElementById("th-user-username"))
    document.getElementById("th-user-username").textContent =
      "Username";
  if (document.getElementById("th-user-created"))
    document.getElementById("th-user-created").textContent = "Created";
  if (document.getElementById("th-user-action"))
    document.getElementById("th-user-action").textContent = "Action";

  // Modals titles and labels (dynamic via JS)
  const groupModalTitle = document.getElementById("group-modal-title");
  if (groupModalTitle) groupModalTitle.textContent = "Add Group";
  const editTitle = document.getElementById("edit-title");
  if (editTitle)
    editTitle.textContent = "Edit Node" || editTitle.textContent;
  const addUserTitle = document.getElementById("add-user-title");
  if (addUserTitle) addUserTitle.textContent = "Add User";
  const addCredTitle = document.getElementById("add-cred-title");
  if (addCredTitle) addCredTitle.textContent = "Add Credential";
  const editCredTitle = document.getElementById("edit-cred-title");
  if (editCredTitle) editCredTitle.textContent = "Edit Credential";
  const viewConfigTitle = document.getElementById("view-config-title");
  if (viewConfigTitle) viewConfigTitle.textContent = "View Configuration";
  const versionHistoryTitle = document.getElementById("version-history-title");
  if (versionHistoryTitle)
    versionHistoryTitle.textContent = "Version History";
  const diffTitle = document.getElementById("diff-title");
  if (diffTitle) diffTitle.textContent = "Compare Versions";

  // Diff legend labels
  if (document.getElementById("diff-old-version-label"))
    document.getElementById("diff-old-version-label").textContent =
      "Old Version";
  if (document.getElementById("diff-new-version-label"))
    document.getElementById("diff-new-version-label").textContent =
      "New Version";

  // Placeholders and form labels (nodes, credentials, models, etc.)
  const nodeSearch = document.getElementById("nodeSearch");
  if (nodeSearch) nodeSearch.placeholder = "Search device, group, or IP...";
  const nodeGroupFilter = document.getElementById("nodeGroupFilter");
  if (nodeGroupFilter && nodeGroupFilter.firstElementChild)
    nodeGroupFilter.firstElementChild.textContent = "All Groups";
  const modelSearch = document.getElementById("modelSearch");
  if (modelSearch) modelSearch.placeholder = "Search models...";
  const credSearch = document.getElementById("credSearch");
  if (credSearch) credSearch.placeholder = "Search credentials...";
  const csvContent = document.getElementById("csvContent");
  if (csvContent) csvContent.placeholder = "Paste CSV Content";
  const labelCsv = document.getElementById("label-csv");
  if (labelCsv) labelCsv.textContent = "Paste CSV Content";
  const csvFormatLabel = document.getElementById("csv-format-label");
  if (csvFormatLabel) csvFormatLabel.textContent = "CSV Format:";
  const csvExampleLabel = document.getElementById("csv-example-label");
  if (csvExampleLabel) csvExampleLabel.textContent = "Example:";

  // Node add form labels
  if (document.getElementById("label-name"))
    document.getElementById("label-name").textContent = "Hostname";
  if (document.getElementById("label-ip"))
    document.getElementById("label-ip").textContent = "IP Address";
  if (document.getElementById("label-model"))
    document.getElementById("label-model").textContent = "Device Model";
  if (document.getElementById("label-protocol"))
    document.getElementById("label-protocol").textContent = "Protocol";
  if (document.getElementById("label-group"))
    document.getElementById("label-group").textContent = "Group";
  if (document.getElementById("label-port"))
    document.getElementById("label-port").textContent = "Port";
  if (document.getElementById("label-credential"))
    document.getElementById("label-credential").textContent = "Credential";
  if (document.getElementById("label-username"))
    document.getElementById("label-username").textContent = "Username";
  if (document.getElementById("label-password"))
    document.getElementById("label-password").textContent = "Password";

  // Group modal labels
  if (document.getElementById("grp-name-label"))
    document.getElementById("grp-name-label").textContent = "Group Name";
  if (document.getElementById("grp-desc-label"))
    document.getElementById("grp-desc-label").textContent = "Description";
  if (document.getElementById("grp-save"))
    document.getElementById("grp-save").textContent = "Save";
  if (document.getElementById("grp-cancel"))
    document.getElementById("grp-cancel").textContent = "Cancel";

  // Re-apply role-based visibility after language change
  if (window.currentUserRole !== undefined) {
    applyRoleBasedVisibility();
  }
}

// ============ Tab Navigation ============
// Re-open the last visited sidebar tab after a full page reload.
function restoreActiveTab() {
  let saved = null;
  try {
    saved = localStorage.getItem("activeTabButton");
  } catch (e) {}
  if (!saved || saved === "tab-nodes") return;
  const btn = document.getElementById(saved);
  if (btn) btn.click();
}

function switchTab(tabName, ev) {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  // Clear nav tabs (inside .sidebar); keep .tab usages elsewhere intact.
  // Dropdown toggles are included too: the Config toggle carries .sidebar-subitem
  // without .tab, so the previous loop never dropped its blue .active when the
  // user moved to a tab outside it. Blue now means "contains the selected tab"
  // exactly, matching the Settings dropdown behavior.
  document
    .querySelectorAll(".sidebar .tab, .sidebar .sidebar-dropdown-toggle")
    .forEach((el) => el.classList.remove("active"));

  const content = document.getElementById(tabName);
  if (content) content.classList.add("active");

  const evt = ev || window.event;
  const clicked = evt && evt.currentTarget ? evt.currentTarget : null;
  if (clicked) clicked.classList.add("active");

  // Remember which sidebar button opened this tab so a page refresh returns
  // to the same tab (restoreActiveTab runs at load).
  if (clicked && clicked.id) {
    try {
      localStorage.setItem("activeTabButton", clicked.id);
    } catch (e) {}
  }

  // Top-nav UX: when a page lives inside a dropdown (Settings > ...), keep the
  // owning dropdown toggle highlighted so you always know where you are.
  let group = clicked ? clicked.closest(".sidebar-item-group") : null;
  while (group) {
    const toggle = group.querySelector(":scope > .sidebar-dropdown-toggle");
    if (toggle) toggle.classList.add("active");
    group = group.parentElement
      ? group.parentElement.closest(".sidebar-item-group")
      : null;
  }

  // Vertical rail: keep dropdown groups open after navigating so the active
  // section stays visible (accordion behavior) instead of collapsing.

  if (tabName === "users") {
    loadUsers();
  }
  if (tabName === "models") {
    loadModels();
  }
  if (tabName === "credentials") {
    loadCredentials();
  }
  if (tabName === "add-node") {
    loadModelsToSelect("nodeModel");
    loadCredentialsToSelect("nodeCredential");
    loadGroupsToSelect("nodeGroup");
  }
}

// ============ Top-nav dropdowns (Settings > Scheduler / Models / Config / Users) ============
function closeAllDropdowns() {
  document
    .querySelectorAll(".sidebar-submenu.open")
    .forEach((el) => el.classList.remove("open"));
  document
    .querySelectorAll(".sidebar-dropdown-toggle.open")
    .forEach((el) => {
      el.classList.remove("open");
      // A closed group returns to the normal color; the blue "active" look
      // only belongs to an open dropdown.
      el.classList.remove("active");
    });
}

function toggleSidebarDropdown(key, ev) {
  if (ev) {
    ev.stopPropagation();
    ev.preventDefault();
  }
  const submenu = document.getElementById("submenu-" + key);
  if (!submenu) return;
  const toggleBtn =
    (ev && ev.currentTarget) ||
    document.getElementById("tab-" + key + "-toggle");
  // Close sibling dropdowns at the same level so only one flyout shows.
  const parent = submenu.parentElement;
  if (parent) {
    parent
      .querySelectorAll(":scope > .sidebar-item-group > .sidebar-submenu.open")
      .forEach((sib) => {
        if (sib !== submenu) {
          sib.classList.remove("open");
          const bt = sib.parentElement.querySelector(
            ":scope > .sidebar-dropdown-toggle",
          );
          if (bt) {
            bt.classList.remove("open");
            bt.classList.remove("active");
          }
        }
      });
  }
  const isOpen = submenu.classList.toggle("open");
  if (toggleBtn) {
    toggleBtn.classList.toggle("open", isOpen);
    // Collapsing the dropdown must restore the toggle's normal color — the
    // blue .active highlight (added by switchTab for the current tab's group)
    // is only kept while the dropdown is open.
    if (!isOpen) toggleBtn.classList.remove("active");
  }
}

// Sidebar UX polish, applied once at startup:
// - icon-less leaf items get a small bullet marker via .sidebar-leaf so the
//   nested list stays readable; items with icons already align on their own.
function markSidebarLeafItems() {
  document
    .querySelectorAll(".sidebar-submenu .sidebar-subitem")
    .forEach((item) => {
      if (
        !item.classList.contains("sidebar-dropdown-toggle") &&
        !item.querySelector(".icon")
      ) {
        item.classList.add("sidebar-leaf");
      }
    });
}

// ============ Row action overflow menu (Device table "[ Backup ]  ⋮") ============
// Menus are portaled to <body> with position:fixed while open, so they are
// never clipped by a scrolling/overflow table container. closeAllActionMenus()
// returns any open menu to its original row before a table re-render, so a
// re-render never leaves an orphaned menu floating on screen.
let openActionMenu = null;

function closeAllActionMenus() {
  document.querySelectorAll(".action-menu.open").forEach((menu) => {
    menu.classList.remove("open");
    if (menu._homeParent) {
      menu._homeParent.appendChild(menu);
      menu.style.position = "";
      menu.style.top = "";
      menu.style.left = "";
      menu._homeParent = null;
    }
  });
  openActionMenu = null;
}

function toggleActionMenu(btn, ev) {
  if (ev) ev.stopPropagation();
  const wrap = btn.closest(".action-menu-wrap");
  const menu = wrap ? wrap.querySelector(".action-menu") : null;
  if (!menu) return;
  const wasOpen = menu.classList.contains("open");
  closeAllActionMenus();
  if (wasOpen) return;

  const rect = btn.getBoundingClientRect();
  menu._homeParent = wrap;
  document.body.appendChild(menu);
  menu.style.position = "fixed";
  menu.classList.add("open");

  const menuWidth = menu.offsetWidth || 180;
  const menuHeight = menu.offsetHeight || 0;
  let left = rect.right - menuWidth;
  if (left < 8) left = 8;
  let top = rect.bottom + 4;
  if (top + menuHeight > window.innerHeight - 8) {
    top = Math.max(8, rect.top - menuHeight - 4);
  }
  menu.style.left = left + "px";
  menu.style.top = top + "px";
  openActionMenu = menu;
}

document.addEventListener("click", (e) => {
  if (openActionMenu && !openActionMenu.contains(e.target)) {
    closeAllActionMenus();
  }
  // Close the account dropdown when clicking anywhere outside it.
  const um = document.getElementById("userMenu");
  if (um && um.classList.contains("open") && !e.target.closest(".user-menu-wrap")) {
    um.classList.remove("open");
  }
  // The sidebar is a persistent vertical rail, so nav dropdowns are NOT
  // auto-closed on outside click; users toggle them explicitly.
});
document.addEventListener(
  "scroll",
  () => {
    if (openActionMenu) closeAllActionMenus();
  },
  true,
);
window.addEventListener("resize", () => {
  if (openActionMenu) closeAllActionMenus();
});

// ============ Right Panel: Action / Detail wiring ============
// Connects device actions (Edit, History, Backup Trigger,
// Schedule Backup, Delete) to the permanent Right Panel instead of opening
// them as modal popups. This reuses each action's existing handler/markup
// as-is — only *where* the result is shown changes (Right Panel instead of
// a centered modal). Activity Log (the panel's bottom section) is never
// touched by any of this.
const ACTION_DETAIL_PANEL_DEFAULT_HTML = `
  <div class="right-panel-placeholder">
    <svg class="right-panel-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="7" y1="9" x2="17" y2="9" />
      <line x1="7" y1="13" x2="14" y2="13" />
    </svg>
    <p>No action selected</p>
    <p class="right-panel-placeholder-sub">
      Details for Edit, History, Backup Trigger, Schedule
      Backup, or Delete will appear here.
    </p>
  </div>
`;

// Tracks which modal (if any) currently has its .modal-content living inside
// the Right Panel, so a "Close/Cancel" click can hand it back home.
let actionPanelCurrentModal = null;

// Tracks the device the panel is currently "about" (shown in the small
// context banner at the top of the action section).
let currentPanelDevice = null;
let deviceAccordionActive = false;
let activeDeviceAccordionSection = null;

const DEVICE_ACCORDION_SECTIONS = {
  "Backup History": "backup-history",
  "Schedule Backup": "schedule-backup",
  "Edit Node": "edit-node",
};

function renderDevicePanelHeader(deviceName) {
  const node = (allNodes || []).find((item) => item.name === deviceName);
  const title = document.getElementById("right-panel-action-title");
  if (!title || !node) return;
  const status = oxidizedStatus[deviceName] || {};
  const statusValue = String(status.status || status.last_status || "").toLowerCase();
  const statusText = ["success", "successful", "completed"].includes(statusValue)
    ? "Success"
    : ["failed", "error"].includes(statusValue)
      ? "Failed"
      : "Not Connected";
  const statusClass =
    statusText === "Success"
      ? "status-success"
      : statusText === "Failed"
        ? "status-failed"
        : "status-not-connected";
  title.innerHTML =
    `<span class="device-panel-heading"><strong>${escapeHtml(deviceName)}</strong>` +
    `<span>${escapeHtml(node.ip || "-")}</span>` +
    `<span>${escapeHtml((node.protocol || "ssh").toUpperCase())} · Port ${escapeHtml(node.port || "-")}</span>` +
    `<span class="status-text ${statusClass}"><span class="status-dot"></span>${statusText}</span></span>`;
}

function openDeviceManagerPanel(deviceName) {
  const node = (allNodes || []).find((item) => item.name === deviceName);
  if (!node) return;
  if (actionPanelCurrentModal) {
    const modal = document.getElementById(actionPanelCurrentModal);
    const content = document.getElementById(actionPanelCurrentModal + "Content");
    if (modal && content) modal.appendChild(content);
    actionPanelCurrentModal = null;
  }

  currentPanelDevice = deviceName;
  deviceAccordionActive = true;
  activeDeviceAccordionSection = null;
  const panel = document.querySelector(".right-panel");
  if (panel) {
    panel.classList.add("right-panel-device-active");
    panel.classList.remove("right-panel-compact-action", "right-panel-diff");
  }
  const actionSection = document.querySelector(".right-panel-action");
  if (actionSection) actionSection.classList.remove("right-panel-action-hidden");
  renderDevicePanelHeader(deviceName);
  const body = document.getElementById("action-detail-panel");
  if (!body) return;
  body.classList.remove("panel-split-mode", "panel-config-mode", "panel-diff-mode");
  body.innerHTML = `
    <div class="device-accordion">
      ${[
        ["backup-history", "Backup History"],
        ["schedule-backup", "Schedule Backup"],
        ["edit-node", "Edit Node"],
      ]
        .map(
          ([key, label]) => `
            <section class="device-accordion-item" data-device-section="${key}">
              <button type="button" class="device-accordion-header" onclick="toggleDeviceAccordion('${key}')">
                <span class="device-accordion-label">${getDeviceAccordionIcon(key)}<span>${label}</span></span>
                <svg class="icon chevron" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              <div class="device-accordion-content" id="device-accordion-${key}" hidden></div>
            </section>`,
        )
        .join("")}
      <footer class="device-accordion-footer">
        <button type="button" class="btn btn-danger-outline" onclick="deleteNode('${escapeHtml(deviceName)}')">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6"/></svg>
          <span>Delete Node</span>
        </button>
      </footer>
    </div>
  `;
  renderDevices();
}

function getDeviceAccordionIcon(section) {
  const paths = {
    "backup-history": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "schedule-backup": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    "edit-node": '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
  };
  return `<svg class="icon device-accordion-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[section] || ""}</svg>`;
}

function manageDevicePanel(deviceName) {
  if (deviceAccordionActive && currentPanelDevice === deviceName) {
    renderActionPanelPlaceholder();
    return;
  }
  openDeviceManagerPanel(deviceName);
}

function toggleDeviceAccordion(section) {
  if (!deviceAccordionActive || !currentPanelDevice) return;
  const wasOpen = activeDeviceAccordionSection === section;
  document.querySelectorAll(".device-accordion-item").forEach((item) => {
    const isOpen = !wasOpen && item.dataset.deviceSection === section;
    item.classList.toggle("open", isOpen);
    const content = item.querySelector(".device-accordion-content");
    if (!content) return;
    clearTimeout(content._accordionCloseTimer);
    if (isOpen) {
      content.hidden = false;
      content.classList.remove("closing");
    } else if (!content.hidden) {
      content.classList.add("closing");
      content._accordionCloseTimer = setTimeout(() => {
        if (content.classList.contains("closing")) content.hidden = true;
      }, 160);
    }
  });
  activeDeviceAccordionSection = wasOpen ? null : section;
  if (wasOpen) return;

  if (section === "backup-history") viewVersionHistory(currentPanelDevice);
  else if (section === "schedule-backup")
    openDeviceOrGroupSchedule("node", currentPanelDevice);
  else if (section === "edit-node") openEditModal(currentPanelDevice);
}

// Idle state: the Action section is hidden entirely, so the Right Panel is
// just Activity Log (which then naturally fills the whole panel, since it's
// the only flex child left — see .right-panel-action-hidden in the CSS).
function renderActionPanelPlaceholder() {
  // If a modal's content is currently on loan to the panel, give it back to
  // its own modal so that modal still works normally if opened another way.
  // Found by its own stable id (not modal.querySelector(".modal-content")),
  // because once the content has been moved out of the modal once, it's no
  // longer a descendant of it, so that lookup would silently find nothing
  // on the 2nd+ open — which used to let panelBody.innerHTML below delete
  // the real content node instead of returning it home.
  if (actionPanelCurrentModal) {
    const modal = document.getElementById(actionPanelCurrentModal);
    const content = document.getElementById(actionPanelCurrentModal + "Content");
    if (modal && content) modal.appendChild(content);
    actionPanelCurrentModal = null;
  }
  // Clear any Compare/Diff wide-panel state so the panel returns to idle.
  const panelEl = document.querySelector(".right-panel");
  if (panelEl) {
    panelEl.classList.remove("right-panel-diff");
    panelEl.classList.remove("right-panel-compact-action");
    panelEl.classList.remove("right-panel-device-active");
  }
  const wasDevicePanel = deviceAccordionActive;
  deviceAccordionActive = false;
  activeDeviceAccordionSection = null;
  diffShownInPanel = false;
  const actionSection = document.querySelector(".right-panel-action");
  if (actionSection) actionSection.classList.add("right-panel-action-hidden");
  const panelBody = document.getElementById("action-detail-panel");
  if (panelBody) {
    panelBody.classList.remove("panel-split-mode");
    panelBody.classList.remove("panel-config-mode");
    panelBody.classList.remove("panel-diff-mode");
    panelBody.innerHTML = ACTION_DETAIL_PANEL_DEFAULT_HTML;
  }
  const titleEl = document.getElementById("right-panel-action-title");
  if (titleEl) titleEl.textContent = "Action / Detail";
  if (wasDevicePanel) {
    currentPanelDevice = null;
    renderDevices();
  }
}

// Per-action glyphs that mirror the icons in the device row's pencil menu, so
// the Right Panel title shows the SAME icon as the action it was opened from.
const PENCIL_ICON_SVG =
  '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';

const LOAD_CONFIG_ICON_SVG =
  '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>';

const HISTORY_ICON_SVG =
  '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>';

const SCHEDULE_ICON_SVG =
  '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11zM7 10h5v5H7z"/></svg>';

// Panel title icon keyed by action label (defaults to the pencil/edit glyph).
const ACTION_PANEL_ICONS = {
  "Edit Node": PENCIL_ICON_SVG,
  "Load Config": LOAD_CONFIG_ICON_SVG,
  "Backup History": HISTORY_ICON_SVG,
  "Schedule Backup": SCHEDULE_ICON_SVG,
  "Global Schedule": SCHEDULE_ICON_SVG,
};

// Actions whose panel content is short (a small form/list): the Action section
// sizes to its content and the Activity Log grows to fill, so there's no empty
// gap left under the form.
const COMPACT_ACTION_LABELS = new Set([
  "Schedule Backup",
  "Global Schedule",
  "Add Group",
  "Edit Group",
]);

// Reveals the Action section (panel splits into Action + Activity Log) and
// renames its heading to whatever action was picked (Edit, History,
// History, Backup Trigger, Schedule Backup, Delete) instead of a generic
// "Action / Detail" label. Returns the empty slot element the caller should
// fill in.
function setActionPanelContext(deviceName, actionLabel) {
  if (
    deviceAccordionActive &&
    deviceName === currentPanelDevice &&
    DEVICE_ACCORDION_SECTIONS[actionLabel]
  ) {
    if (actionPanelCurrentModal) {
      const prevModal = document.getElementById(actionPanelCurrentModal);
      const prevContent = document.getElementById(
        actionPanelCurrentModal + "Content",
      );
      if (prevModal && prevContent) prevModal.appendChild(prevContent);
      actionPanelCurrentModal = null;
    }
    activeDeviceAccordionSection = DEVICE_ACCORDION_SECTIONS[actionLabel];
    document.querySelectorAll(".device-accordion-item").forEach((item) => {
      const isOpen = item.dataset.deviceSection === activeDeviceAccordionSection;
      item.classList.toggle("open", isOpen);
      const content = item.querySelector(".device-accordion-content");
      if (content) content.hidden = !isOpen;
    });
    const body = document.getElementById(
      `device-accordion-${activeDeviceAccordionSection}`,
    );
    if (!body) return null;
    body.innerHTML = "";
    const slot = document.createElement("div");
    slot.className = "action-panel-slot";
    body.appendChild(slot);
    return slot;
  }

  const panelBody = document.getElementById("action-detail-panel");
  if (!panelBody) return null;
  currentPanelDevice = deviceName;

  // Hand back any modal content still on loan to the panel BEFORE wiping the
  // slot. Switching straight between pencil actions (Edit -> Load Config ->
  // History -> ...) used to run innerHTML="" on the borrowed node, orphaning
  // it out of the DOM, so reopening that action found nothing left to show and
  // the panel looked blank.
  if (actionPanelCurrentModal) {
    const prevModal = document.getElementById(actionPanelCurrentModal);
    const prevContent = document.getElementById(
      actionPanelCurrentModal + "Content",
    );
    if (prevModal && prevContent) prevModal.appendChild(prevContent);
    actionPanelCurrentModal = null;
  }

  const actionSection = document.querySelector(".right-panel-action");
  if (actionSection)
    actionSection.classList.remove("right-panel-action-hidden");
  const titleEl = document.getElementById("right-panel-action-title");
  // Single header line "(action icon) Title — device". The icon matches the
  // same action in the device row's action menu (Edit=pencil, History=clock).
  if (titleEl) {
    const icon = ACTION_PANEL_ICONS[actionLabel] || PENCIL_ICON_SVG;
    const text = deviceName
      ? `${actionLabel} \u2014 ${escapeHtml(deviceName)}`
      : escapeHtml(actionLabel);
    titleEl.innerHTML = `${icon}<span>${text}</span>`;
  }

  // Short-content actions (schedule, add/edit group) let the Activity Log grow.
  const panel = document.querySelector(".right-panel");
  if (panel)
    panel.classList.toggle(
      "right-panel-compact-action",
      COMPACT_ACTION_LABELS.has(actionLabel),
    );

  panelBody.classList.remove("panel-split-mode");
  panelBody.classList.toggle("panel-config-mode", actionLabel === "Load Config");
  panelBody.innerHTML = "";
  const slot = document.createElement("div");
  slot.className = "action-panel-slot";
  panelBody.appendChild(slot);
  return slot;
}

// Moves an existing modal's .modal-content into the Right Panel instead of
// showing it as a centered popup. The modal keeps its own fields, ids and
// submit/close handlers untouched — nothing here duplicates that logic.
function revealModalInActionPanel(modalId, deviceName, actionLabel) {
  const content = document.getElementById(modalId + "Content");
  const slot = setActionPanelContext(deviceName, actionLabel);
  if (!content || !slot) return;
  slot.appendChild(content);
  // The panel header already shows "Title — device", so drop the modal's own
  // title bar to avoid a duplicate heading inside the panel.
  const mh = content.querySelector(".modal-header");
  if (mh) mh.style.display = "none";
  actionPanelCurrentModal = modalId;
}

// Called from a modal's existing close/cancel handler so that, when that
// modal's content is currently on loan to the panel, closing it goes back
// to idle (Action section hidden, just Activity Log) instead of leaving
// stale content behind.
function resetActionPanelIfShowing(modalId) {
  if (actionPanelCurrentModal === modalId) {
    if (deviceAccordionActive) {
      const modal = document.getElementById(modalId);
      const content = document.getElementById(modalId + "Content");
      if (modal && content) modal.appendChild(content);
      actionPanelCurrentModal = null;
      return;
    }
    // Let renderActionPanelPlaceholder() read actionPanelCurrentModal itself
    // (it needs it to find the content and move it back to its modal before
    // clearing the panel) — nulling it here first was causing that lookup
    // to be skipped, so the form got deleted instead of returned home.
    renderActionPanelPlaceholder();
  }
}

// ============ Activity Log (Right Panel, bottom section) ============
// Records backup outcomes (Success/Failed) plus one-off events that carry a
// custom label (e.g. "Node updated successfully" via logActivityEvent). It does
// NOT log History/View/Schedule opens or menu clicks. The server (a plain-text
// file via POST/GET /api/activity-log) is the source of truth, so the log
// survives a reload and is shared across browsers. The browser keeps only an
// ephemeral list of "pending" triggers that haven't reached a final result yet;
// once a backup finishes we compute its diff, persist it, and drop the pending
// copy.
let activityLogServerEntries = []; // [{timestamp,name,ip,status,added,removed,changed,message}] newest first
let activityLogPending = []; // browser-only optimistic rows, newest first

function getNodeIp(name) {
  const node = (allNodes || []).find((n) => n.name === name);
  return node && node.ip ? node.ip : "";
}

// Pulls the persisted log from the server and renders it. Called on load and
// on a timer; the pending rows already in memory stay pinned on top.
function loadActivityLog() {
  return fetch("/api/activity-log?limit=200")
    .then((r) => (r.ok ? r.json() : { entries: [] }))
    .then((data) => {
      activityLogServerEntries = Array.isArray(data.entries) ? data.entries : [];
      renderActivityLog();
    })
    .catch(() => {
      // Server unreachable — keep whatever we already had on screen.
      renderActivityLog();
    });
}

// Manual Backup reports its status directly in Activity Log instead of opening
// a separate "Backup Trigger" view: one row is created up front as "pending"
// (Waiting) and the SAME row is finalized in place once the result comes back —
// never a second row for the same trigger. Pending rows are browser-only and
// are written to the server file only when they reach SUCCESS/FAILED.
function addPendingActivityLogEntry(hostname) {
  const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  activityLogPending.unshift({
    id,
    status: "pending",
    hostname,
    ip: getNodeIp(hostname),
    timestamp: Date.now(),
  });
  renderActivityLog();
  return id;
}

// Fetches the two most recent backups and their diff stats so a successful
// entry can carry the +X/-Y badge. Degrades to "no badge" (null/null) when
// history or diff isn't available — it never blocks the log write.
function computeBackupDiff(hostname) {
  const empty = { added: null, removed: null, changed: null };
  return fetch(`/api/oxidized/node/${encodeURIComponent(hostname)}/history`)
    .then((r) => (r.ok ? r.json() : null))
    .then((history) => {
      const arr = Array.isArray(history) ? history : [];
      if (arr.length < 2) return empty;
      const newest = arr[0]; // API returns newest first
      const previous = arr[1];
      if (!newest.oid || !previous.oid) return empty;
      const qs = new URLSearchParams({
        oid1: previous.oid,
        oid2: newest.oid,
      });
      return fetch(
        `/api/oxidized/node/${encodeURIComponent(hostname)}/diff?${qs.toString()}`,
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d) =>
          d && d.stats
            ? {
                added: d.stats.added ?? d.stats.insert,
                removed: d.stats.removed ?? d.stats.delete,
                changed: d.stats.changed ?? null,
              }
            : empty,
        )
        .catch(() => empty);
    })
    .catch(() => empty);
}

// Finalizes a pending row: resolves its diff, persists one line to the server,
// then swaps the pending row for the confirmed server row (in place).
function updateActivityLogEntry(id, status, timestampMs, savedEntry) {
  const pend = activityLogPending.find((e) => e.id === id);
  if (!pend) return;
  const hostname = pend.hostname;
  const ip = pend.ip || getNodeIp(hostname);
  const ts = timestampMs || Date.now();
  const finalStatus = status === "success" ? "SUCCESS" : "FAILED";

  if (savedEntry) {
    const idx = activityLogPending.findIndex((e) => e.id === id);
    if (idx !== -1) activityLogPending.splice(idx, 1);
    activityLogServerEntries.unshift(savedEntry);
    renderActivityLog();
    return;
  }

  const persist = (diff) => {
    const isoTs = new Date(ts).toISOString();
    const removePending = () => {
      const idx = activityLogPending.findIndex((e) => e.id === id);
      if (idx !== -1) activityLogPending.splice(idx, 1);
    };
    return fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: hostname,
        ip,
        status: finalStatus,
        added: diff.added,
        removed: diff.removed,
        changed: diff.changed,
        timestamp: isoTs,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        removePending();
        if (res && res.success && res.entry) {
          activityLogServerEntries.unshift(res.entry);
        } else {
          // Server write failed: show the outcome optimistically so the UI
          // never silently loses a completed backup.
          activityLogServerEntries.unshift({
            timestamp: isoTs,
            name: hostname,
            ip,
            status: finalStatus,
            insert: diff.added,
            delete: diff.removed,
            added: diff.added,
            removed: diff.removed,
            changed: diff.changed,
          });
        }
        renderActivityLog();
      })
      .catch(() => {
        removePending();
        activityLogServerEntries.unshift({
          timestamp: isoTs,
          name: hostname,
          ip,
          status: finalStatus,
          insert: diff.added,
          delete: diff.removed,
          added: diff.added,
          removed: diff.removed,
          changed: diff.changed,
        });
        renderActivityLog();
      });
  };

  if (finalStatus === "SUCCESS") {
    computeBackupDiff(hostname).then(persist);
  } else {
    persist({ added: null, removed: null, changed: null });
  }
}

const ACTIVITY_LOG_EMPTY_HTML = `
  <div class="right-panel-placeholder">
    <svg class="right-panel-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
    <p>No activity yet</p>
    <p class="right-panel-placeholder-sub">
      Automatic backups, backup success/failure, and other activity
      will show up here.
    </p>
  </div>
`;

// Builds the change badges in the right column; missing legacy `changed`
// values remain optional while their existing added/removed counts still show.
function activityLogDiffBadge(item) {
  if (!["success", "completed"].includes(item.status)) return "";
  const ins = item.added ?? item.insert;
  const del = item.removed ?? item.delete;
  const changed = item.changed;
  if (ins == null && del == null && changed == null) return "";
  const i = ins || 0;
  const d = del || 0;
  const c = changed || 0;
  if (i === 0 && d === 0 && c === 0) {
    return '<span class="activity-log-diff activity-log-diff-none">no change</span>';
  }
  let html = "";
  if (i > 0) html += `<span class="activity-log-diff activity-log-diff-add">+${i} added</span>`;
  if (d > 0) html += `<span class="activity-log-diff activity-log-diff-del">-${d} removed</span>`;
  if (c > 0) html += `<span class="activity-log-diff activity-log-diff-change">~${c} changed</span>`;
  return html;
}

// Capitalises the first letter of every word so activity-log labels read
// consistently (e.g. "Node updated successfully" -> "Node Updated Successfully").
function toTitleCase(str) {
  return String(str || "").replace(/\S+/g, (w) =>
    w.charAt(0).toUpperCase() + w.slice(1),
  );
}

function renderActivityLog() {
  const container = document.getElementById("activity-log-panel");
  if (!container) return;

  // Pending rows (browser-only, not yet on the server) sit on top, then the
  // persisted server rows (already newest-first).
  const pendingItems = (activityLogPending || []).map((e) => ({
    status: "pending",
    hostname: e.hostname,
    ip: e.ip || "",
    timestamp: e.timestamp,
    insert: null,
    delete: null,
    added: null,
    removed: null,
    changed: null,
  }));
  const serverItems = (activityLogServerEntries || []).map((e) => ({
    status: (e.status || "").toLowerCase(), // SUCCESS/FAILED -> success/failed
    hostname: e.name,
    ip: e.ip || "",
    timestamp: e.timestamp,
    insert: e.insert,
    delete: e.delete,
    added: e.added,
    removed: e.removed,
    changed: e.changed,
    message: e.message || "",
  }));
  const list = pendingItems.concat(serverItems);

  if (list.length === 0) {
    container.innerHTML = ACTIVITY_LOG_EMPTY_HTML;
    return;
  }
  container.innerHTML = list
    .map((entry) => {
      const d = new Date(entry.timestamp);
      const dateLine = isNaN(d.getTime())
        ? ""
        : d.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
      const timeLine = isNaN(d.getTime())
        ? ""
        : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
      let dotClass = "activity-log-dot-failed";
      let titleClass = "activity-log-title-failed";
      let titleText = "Backup Failed";
      if (entry.status === "pending") {
        dotClass = "activity-log-dot-pending";
        titleClass = "activity-log-title-pending";
        titleText = "Waiting For Backup\u2026";
      } else if (entry.status === "success") {
        dotClass = "activity-log-dot-success";
        titleClass = "activity-log-title-success";
        titleText = "Backup Completed";
      }
      // Non-backup events (e.g. "Node updated successfully") carry a custom
      // label that replaces the backup title; they never show a diff badge.
      // Every word is capitalised so labels read consistently in the log.
      if (entry.message) {
        titleText = escapeHtml(toTitleCase(entry.message));
      }
      const badges = entry.message ? "" : activityLogDiffBadge(entry);
      return `
        <div class="activity-log-item">
          <div class="activity-log-title ${titleClass}">
            <span class="activity-log-dot ${dotClass}" aria-hidden="true"></span>
              ${titleText}
          </div>
          <div class="activity-log-details">
            <div class="activity-log-info">
              <div class="activity-log-hostname">${escapeHtml(entry.hostname)}</div>
              <div class="activity-log-date">${escapeHtml(dateLine)}</div>
              <div class="activity-log-time">${escapeHtml(timeLine)}</div>
            </div>
            <div class="activity-log-diff-column">${badges}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

// Records a one-off activity event (e.g. a successful device edit) directly to
// the server log with a custom label, then refreshes the panel. Reuses the
// SUCCESS status so it renders with the green dot; the `message` field drives
// the title line instead of "Backup completed".
function logActivityEvent(hostname, message) {
  const ip = typeof getNodeIp === "function" ? getNodeIp(hostname) : "";
  return fetch("/api/activity-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: hostname,
      ip: ip,
      status: "SUCCESS",
      message: message,
    }),
  })
    .then(() => loadActivityLog())
    .catch(() => {});
}

// ============ Logout ============
function logout() {
  confirmAction("Are you sure you want to logout?", () => {
    clearClientSessionState();
    fetch("/api/logout", { method: "POST" }).finally(() => {
      window.location.replace("/login");
    });
  });
}

const IDLE_SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const SESSION_HEARTBEAT_INTERVAL_MS = 60 * 1000;
let lastSessionActivityAt = Date.now();
let lastSessionHeartbeatAt = 0;
let idleSessionTimer = null;
let sessionLogoutStarted = false;

function clearClientSessionState() {
  sessionStorage.clear();
  for (const key of Object.keys(localStorage)) {
    if (/^(token|auth|session)/i.test(key)) localStorage.removeItem(key);
  }
}

function endIdleSession() {
  if (sessionLogoutStarted) return;
  sessionLogoutStarted = true;
  clearClientSessionState();
  fetch("/api/logout", { method: "POST", keepalive: true }).finally(() => {
    window.location.replace("/login?reason=idle");
  });
}

function returnToLogin() {
  if (sessionLogoutStarted) return;
  sessionLogoutStarted = true;
  clearClientSessionState();
  fetch("/api/logout", { method: "POST", keepalive: true }).finally(() => {
    window.location.replace("/login");
  });
}

function sendSessionHeartbeat() {
  if (Date.now() - lastSessionHeartbeatAt < SESSION_HEARTBEAT_INTERVAL_MS) {
    return;
  }
  lastSessionHeartbeatAt = Date.now();
  fetch("/api/session/heartbeat", {
    method: "POST",
    keepalive: true,
  }).then((response) => {
    if (response.status === 401) {
      response.json().then((data) => {
        if (data.session_expired) endIdleSession();
        else returnToLogin();
      }).catch(returnToLogin);
    }
  }).catch(() => {});
}

function noteSessionActivity() {
  if (Date.now() - lastSessionActivityAt >= IDLE_SESSION_TIMEOUT_MS) {
    endIdleSession();
    return;
  }
  lastSessionActivityAt = Date.now();
  clearTimeout(idleSessionTimer);
  idleSessionTimer = setTimeout(endIdleSession, IDLE_SESSION_TIMEOUT_MS);
  sendSessionHeartbeat();
}

function initializeIdleSessionTimeout() {
  const activityEvents = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
  activityEvents.forEach((eventName) => {
    document.addEventListener(eventName, noteSessionActivity, { passive: true });
  });
  window.addEventListener("pageshow", () => {
    if (Date.now() - lastSessionActivityAt >= IDLE_SESSION_TIMEOUT_MS) {
      endIdleSession();
      return;
    }
    sendSessionHeartbeat();
  });
  idleSessionTimer = setTimeout(endIdleSession, IDLE_SESSION_TIMEOUT_MS);
}

// Account dropdown: Logout / Change Password are hidden until the admin
// button is clicked, then a small menu opens above it.
function toggleUserMenu(ev) {
  if (ev) ev.stopPropagation();
  const m = document.getElementById("userMenu");
  if (m) m.classList.toggle("open");
}

function closeUserMenu() {
  const m = document.getElementById("userMenu");
  if (m) m.classList.remove("open");
}

// ============ Password Toggle ============
// Eye / eye-off SVG icons that match the rest of the UI (replaces the emoji,
// which looked inconsistent). Toggle swaps the inline SVG inside the button.
const PASSWORD_EYE_OPEN =
  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const PASSWORD_EYE_OFF =
  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10 10 0 0 1 12 20C5 20 1 12 1 12a18 18 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  const evt = window.event;
  const button =
    evt && evt.target ? evt.target.closest(".password-toggle") : null;
  if (!input || !button) return;
  if (input.type === "password") {
    input.type = "text";
    button.innerHTML = PASSWORD_EYE_OFF;
  } else {
    input.type = "password";
    button.innerHTML = PASSWORD_EYE_OPEN;
  }
}

function initPasswordToggleIcons() {
  document.querySelectorAll(".password-toggle").forEach((b) => {
    b.innerHTML = PASSWORD_EYE_OPEN;
  });
}

// ============ Node Port Auto-Update ============
function updateNodePort() {
  const protocol = document.getElementById("nodeProtocol").value;
  const portInput = document.getElementById("nodePort");
  portInput.value = protocol === "ssh" ? "32410" : "23";
}

function updateEditNodePort() {
  const protocol = document.getElementById("editNodeProtocol").value;
  const portInput = document.getElementById("editNodePort");
  portInput.value = protocol === "ssh" ? "32410" : "23";
}

// ============ Credential Auto-Fill ============
function onCredentialChange() {
  const sel = document.getElementById("nodeCredential");
  const credId = sel.value;
  // "＋ Create new credential…" pseudo-option: reveal the inline form.
  if (credId === "__new__") {
    openInlineCredForm();
    sel.value = "";
    return;
  }
  closeInlineCredForm();
  if (!credId) return;
  const cred = allCredentials.find((c) => c.id == credId);
  if (cred) {
    document.getElementById("nodeUsername").value = cred.username || "";
    document.getElementById("nodePassword").value = cred.password || "";
  }
}

function onEditCredentialChange() {
  const credId = document.getElementById("editNodeCredential").value;
  if (!credId) return;
  const cred = allCredentials.find((c) => c.id == credId);
  if (cred) {
    document.getElementById("editNodeUsername").value = cred.username || "";
    document.getElementById("editNodePassword").value = cred.password || "";
  }
}

// ============ Oxidized Status ============
function refreshOxidizedStatus(silent) {
  // Background (interval) refreshes are silent; only a manual refresh from
  // the button shows the "refreshed" popup.
  const finish = () => {
    if (!silent) showInfoToast("Device list and Oxidized status refreshed");
  };
  fetch("/api/oxidized/status")
    .then((r) => r.json())
    .then((data) => {
      oxidizedStatus = {};
      const nodes = Array.isArray(data)
        ? data
        : Object.entries(data || {}).map(([name, node]) =>
            Object.assign({ name }, node),
          );
      nodes.forEach((node) => {
        if (node && node.name) oxidizedStatus[node.name] = node;
      });
      refreshNodes();
      finish();
    })
    .catch((err) => {
      console.error("Failed to fetch Oxidized status:", err);
      refreshNodes();
      finish();
    });
}

function showRestartStatus(message, ok) {
  // The restart RESULT shows as a bottom popup (info toast), matching the
  // other device/Oxidized notifications. The Restart confirmation itself still
  // uses its own popup above.
  showInfoToast(message, !ok);
}

function restartOxidizedContainer() {
  confirmAction(
    "Restart Oxidized? This will interrupt running backups.",
    performOxidizedRestart,
    { danger: true, confirmLabel: "Restart" },
  );
}

function performOxidizedRestart() {
  showRestartStatus("Restarting Oxidized container...", true);
  fetch("/api/oxidized/restart", { method: "POST" })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        showRestartStatus("Oxidized restarted successfully", true);
        setTimeout(refreshOxidizedStatus, 3000);
      } else {
        showRestartStatus(
          "Failed to restart Oxidized: " + (data.error || "Unknown error"),
          false,
        );
      }
    })
    .catch((err) => {
      showRestartStatus("Error restarting Oxidized: " + err.message, false);
    });
}

function getOxidizedLastSync(status) {
  if (!status || !status.last || !status.last.end) return "Never";
  try {
    return new Date(status.last.end).toLocaleString();
  } catch (e) {
    return status.last.end;
  }
}

const MONTH_ABBR_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// "Latest Backup" column: "24 Sep 2026, 09:23" — no seconds, no timezone noise.
function formatLatestBackupDate(status) {
  if (!status || !status.last || !status.last.end) return "Never";
  const d = new Date(status.last.end);
  if (isNaN(d.getTime())) return "Never";
  const day = d.getDate();
  const month = MONTH_ABBR_EN[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hh}:${mm}`;
}

// Transient client-side status shown while a manually triggered backup is
// in flight ("Triggered" / "Waiting"). Cleared as soon as the trigger
// request resolves, at which point the real Success/Failed result (below)
// takes over again.
let triggerStatusOverrides = {};

// "Status" column: just the backup result, no timestamp (that now lives only
// in the separate "Latest Backup" column).
function getOxidizedStatusOnly(nodeName) {
  const override = triggerStatusOverrides[nodeName];
  if (override === "triggered") {
    return '<span class="status-text status-triggered"><span class="status-dot"></span>Triggered</span>';
  }
  if (override === "waiting") {
    return '<span class="status-text status-waiting"><span class="status-dot"></span>Waiting</span>';
  }
  const status = oxidizedStatus[nodeName];
  if (!status) {
    return '<span class="status-text status-not-connected"><span class="status-dot"></span>Not Connected</span>';
  }
  const statusValue = String(status.status || status.last_status || "").toLowerCase();
  if (statusValue === "success" || statusValue === "successful") {
    return '<span class="status-text status-success"><span class="status-dot"></span>Success</span>';
  }
  if (statusValue === "failed" || statusValue === "error") {
    return '<span class="status-text status-failed"><span class="status-dot"></span>Failed</span>';
  }
  if (statusValue === "no_connection" || statusValue === "pending" || !statusValue) {
    return '<span class="status-text status-not-connected"><span class="status-dot"></span>Not Connected</span>';
  }
  return `<span class="status-text status-pending"><span class="status-dot"></span>${escapeHtml(status.status)}</span>`;
}

function getOxidizedStatusBadge(nodeName) {
  const status = oxidizedStatus[nodeName];
  if (!status) {
    return '<span class="status-text status-not-connected">Not Connected</span>';
  }
  const lastSync = getOxidizedLastSync(status);
  const statusText =
    status.status === "success"
      ? '<span style="color: #28a745;">✓ Success</span>'
      : status.status === "failed" || status.status === "error"
        ? '<span style="color: #dc3545;">✗ Failed</span>'
        : '<span class="status-text status-not-connected">Not Connected</span>';
  return `<div>${statusText}</div><div style="font-size: 11px; color: #666;">${lastSync}</div>`;
}

// ============ Node Filtering & Rendering ============
function filterNodes() {
  renderDevices();
}

function formatModelDisplay(name) {
  // Consistent "Brand - Model" label (e.g. "Cisco - Cisco IOS"), used in the
  // Add/Edit dropdowns and the device table so both match after submit.
  if (!name) return "-";
  const n = String(name).trim();
  const parts = n.split(/\s+/);
  if (parts.length < 2) return n;
  return `${parts[0]} - ${n}`;
}

function getModelDisplayName(modelId) {
  if (!modelId) return "-";
  const found = (allModels || []).find((m) => String(m.id) === String(modelId));
  return found ? formatModelDisplay(found.name) : modelId;
}

function renderNodeRowLegacy(node) {
  return `
        <tr>
            <td>
                <div class="device-cell">
                    <div class="device-name">${escapeHtml(node.name)}</div>
                    <div class="device-model">${escapeHtml(getModelDisplayName(node.model))}</div>
                    <div class="device-ip">${escapeHtml(node.ip)}</div>
                </div>
            </td>
            <td class="connection-cell"><div class="conn-proto">${escapeHtml((node.protocol || "-").toUpperCase())}</div><div class="conn-port">${node.port || "-"}</div></td>
            <td class="status-cell">${getOxidizedStatusOnly(node.name)}</td>
            <td>${formatLatestBackupDate(oxidizedStatus[node.name])}</td>
            <td>
                <div class="row-actions">
                    <button class="btn btn-row-primary" onclick="triggerBackup('${escapeHtml(node.name)}')" title="Trigger Backup">Backup</button>
                    <div class="action-menu-wrap">
                        <button class="action-menu-toggle" onclick="toggleActionMenu(this, event)" title="Actions" aria-label="Actions"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                        <div class="action-menu">
                            <button onclick="closeAllActionMenus(); openEditModal('${escapeHtml(node.name)}')">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                                <span>Edit</span>
                            </button>
                            <button onclick="closeAllActionMenus(); viewConfig('${escapeHtml(node.name)}')">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                                <span>Load Config</span>
                            </button>
                            <button onclick="closeAllActionMenus(); viewVersionHistory('${escapeHtml(node.name)}')">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
                                <span>History</span>
                            </button>
                            <button onclick="closeAllActionMenus(); openDeviceOrGroupSchedule('node', '${escapeHtml(node.name)}')">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11zM7 10h5v5H7z"/></svg>
                                <span>Schedule Backup</span>
                            </button>
                            <div class="action-menu-separator"></div>
                            <button class="action-menu-danger" onclick="closeAllActionMenus(); deleteNode('${escapeHtml(node.name)}')">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                                <span>Delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

function renderNodeRow(node) {
  const active = deviceAccordionActive && currentPanelDevice === node.name;
  return `
    <tr class="${active ? "device-row-active" : ""}" data-device-name="${escapeHtml(node.name)}">
      <td>
        <div class="device-cell">
          <div class="device-name">${escapeHtml(node.name)}</div>
          <div class="device-model">${escapeHtml(getModelDisplayName(node.model))}</div>
          <div class="device-ip">${escapeHtml(node.ip)}</div>
        </div>
      </td>
      <td class="connection-cell"><div class="conn-proto">${escapeHtml((node.protocol || "-").toUpperCase())}</div><div class="conn-port">${node.port || "-"}</div></td>
      <td class="status-cell">${getOxidizedStatusOnly(node.name)}</td>
      <td>${formatLatestBackupDate(oxidizedStatus[node.name])}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-row-primary" onclick="triggerBackup('${escapeHtml(node.name)}')" title="Trigger Backup">Backup</button>
          <button class="action-menu-toggle" onclick="manageDevicePanel('${escapeHtml(node.name)}')" title="Manage Device" aria-label="Manage Device">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `;
}

// Unified Devices view: every device shown grouped by its group (group
// sections always visible, no dropdown/accordion). The redundant "Group"
// column is gone because the group is now the section header. The search box
// and the group filter narrow this single view.
function renderDevices() {
  closeAllActionMenus();
  if (deviceAccordionActive && currentPanelDevice) {
    renderDevicePanelHeader(currentPanelDevice);
  }
  const container = document.getElementById("groups-sections");
  if (!container) return;

  const searchEl = document.getElementById("nodeSearch");
  const filterEl = document.getElementById("nodeGroupFilter");
  const searchText = (searchEl ? searchEl.value : "").toLowerCase();
  const groupFilter = filterEl ? filterEl.value : "";

  // Search matches on device name, IP and the device's GROUP name.
  const groupNameById = {};
  (allGroups || []).forEach((g) => {
    groupNameById[String(g.id)] = (g.name || "").toLowerCase();
  });

  const nodes = (allNodes || []).filter(
    (node) =>
      !searchText ||
      (node.name && node.name.toLowerCase().includes(searchText)) ||
      (node.ip && node.ip.toLowerCase().includes(searchText)) ||
      (groupNameById[String(node.group_id)] || "").includes(searchText) ||
      (node.model && node.model.toLowerCase().includes(searchText)),
  );

  const groups = (allGroups || []).filter(
    (g) => !groupFilter || String(g.id) === String(groupFilter),
  );

  const sections = groups.map((g) => ({
    key: "group-" + g.id,
    name: g.name,
    description: g.description,
    id: g.id,
    nodes: nodes.filter((n) => String(n.group_id) === String(g.id)),
  }));

  // Every device belongs to a group, so there is no "Ungrouped" section.
  // (Group is required when adding/editing a device.)

  if (sections.length === 0) {
    container.innerHTML =
      '<div class="group-section-empty">No groups yet. Click "Add Group" to create one.</div>';
    return;
  }

  container.innerHTML = sections
    .map(
      (sec) => `
      <div class="group-section">
        <div class="group-section-header">
          <div class="group-section-heading">
            <div class="group-section-title">
              <svg class="icon" viewBox="0 0 24 24"><path d="M3 21V10l9-7 9 7v11h-6v-7H9v7H3z"/></svg>
              <span>${escapeHtml(sec.name)}</span>
            </div>
            ${
              sec.id != null
                ? `<div class="btn-group">
                    <button class="btn" style="padding:5px 10px;font-size:12px;" onclick="openDeviceOrGroupSchedule('group', '${sec.id}')">Schedule</button>
                    <button class="btn" style="padding:5px 10px;font-size:12px;" onclick="openEditGroupModal(${sec.id}, '${escapeHtml(sec.name)}', '${escapeHtml(sec.description || "")}')">Edit</button>
                    <button class="btn btn-danger" style="padding:5px 10px;font-size:12px;" onclick="deleteGroup(${sec.id})">Delete</button>
                  </div>`
                : ""
            }
          </div>
          ${sec.description ? `<div class="group-section-desc">${escapeHtml(sec.description)}</div>` : ""}
          <div class="group-section-count">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><line x1="7" y1="7.5" x2="7.01" y2="7.5"/><line x1="7" y1="16.5" x2="7.01" y2="16.5"/></svg>
            <span>${sec.nodes.length} ${sec.nodes.length === 1 ? "Device" : "Devices"}</span>
          </div>
        </div>
        ${
          sec.nodes.length === 0
            ? `<div class="group-section-empty">No devices in this group yet</div>`
            : `<table class="group-devices-table">
                <colgroup>
                  <col class="col-device" />
                  <col class="col-connection" />
                  <col class="col-status" />
                  <col class="col-latest" />
                  <col class="col-action" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Connection</th>
                    <th>Status</th>
                    <th>Latest Backup</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>${sec.nodes.map(renderNodeRow).join("")}</tbody>
              </table>`
        }
      </div>`,
    )
    .join("");
}

function refreshNodes() {
  closeAllActionMenus();
  fetch("/api/nodes")
    .then((r) => r.json())
    .then((nodes) => {
      allNodes = nodes;
      // Keep the group filter dropdown in sync with the known groups.
      const groupFilter = document.getElementById("nodeGroupFilter");
      if (groupFilter) {
        const currentFilter = groupFilter.value;
        groupFilter.innerHTML =
          '<option value="">All Groups</option>' +
          (allGroups || [])
            .map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`)
            .join("");
        groupFilter.value = currentFilter;
      }
      renderDevices();
    });
}

// ============ Oxidized Config Functions ============
function viewConfig(nodeName) {
  revealModalInActionPanel("viewConfigModal", nodeName, "Load Config");
  // Keep the inner "View Configuration" heading visible — it labels the config
  // viewer itself and is distinct from the "Load Config" panel title above it.
  const vh = document.querySelector("#viewConfigModalContent .modal-header");
  if (vh) vh.style.display = "";
  const st = document.getElementById("view-config-status");
  st.innerHTML =
    '<span class="skeleton skeleton-inline" style="width: 120px;"></span>';
  document.getElementById("viewConfigContent").value = "";
  // Status renders on the title line as "View Configuration - <status>", using
  // the same colored-dot pill as the device/group backup status column.
  const setPill = (label, ok) => {
    st.innerHTML =
      '<span class="vc-status-sep">-</span>' +
      `<span class="status-text ${ok ? "status-success" : "status-failed"}">` +
      `<span class="status-dot"></span>${escapeHtml(label)}</span>`;
  };

  fetch(`/api/oxidized/node/${nodeName}/config`)
    .then((r) => r.json())
    .then((data) => {
      if (data.config) {
        document.getElementById("viewConfigContent").value = data.config;
        setPill("Backup Completed", true);
      } else {
        document.getElementById("viewConfigContent").value =
          data.error || "Configuration is unavailable because no valid backup has been saved.";
        setPill("Backup Failed", false);
      }
    })
    .catch(() => {
      document.getElementById("viewConfigContent").value =
        "Configuration could not be loaded. Check the backup status and try again.";
      setPill("Backup Failed", false);
    });
}

function closeViewConfigModal() {
  document.getElementById("viewConfigModal").classList.remove("show");
  resetActionPanelIfShowing("viewConfigModal");
}

// navigator.clipboard.writeText() only exists in a "secure context" (HTTPS
// or localhost). When the dashboard is reached over plain HTTP on a LAN IP
// (e.g. http://192.168.x.x:5000), navigator.clipboard is undefined and the
// old code threw before it ever reached showAlert — so the button looked
// like it did nothing. This falls back to the classic hidden-textarea +
// execCommand('copy') approach, which still works over HTTP.
function copyTextToClipboard(text) {
  if (
    window.isSecureContext &&
    navigator.clipboard &&
    navigator.clipboard.writeText
  ) {
    return navigator.clipboard
      .writeText(text)
      .catch(() => legacyCopyText(text));
  }
  return legacyCopyText(text);
}

function legacyCopyText(text) {
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) resolve();
      else reject(new Error("execCommand copy failed"));
    } catch (err) {
      reject(err);
    }
  });
}

function copyConfig() {
  const config = document.getElementById("viewConfigContent").value;
  copyTextToClipboard(config)
    .then(() => {
      showInfoToast("Config copied to clipboard");
    })
    .catch(() => {
      showInfoToast("Failed to copy config", true);
    });
}

// ============ Oxidized Version History ============
// ============ Backup History (Right Panel): grouped by date, View, Compare ============
// Uses the per-node Git history endpoint and exact config versions:
//   GET /api/oxidized/node/{name}/versions  (list)
//   GET /api/oxidized/node/{name}/version   (single backup config, used by View)
//   GET /api/oxidized/node/{name}/diff      (used by Compare, via the existing showDiff())
let historyState = null; // { nodeName, data, selected: [{oid, epoch, num}] }
const historyCache = Object.create(null);
let historyLoadSequence = 0;

// ===== TEMP MOCK HISTORY (UI review only) =====
// Sample versions used ONLY while developing the History layout against the
// preview (which has no live Oxidized). MUST stay false for real use: when
// true and the real history is empty, the UI shows FAKE backups, which hides
// the genuine "no new backup" condition. Set false (or delete this block + the
// two getMockHistory() calls below) to show real data only.
const HISTORY_MOCK_ENABLED = false;
function getMockHistory() {
  const now = Date.now();
  const iso = (minsAgo) => new Date(now - minsAgo * 60000).toISOString();
  return [
    { oid: iso(6), time: iso(6) },
    { oid: iso(38), time: iso(38) },
    { oid: iso(60 * 20), time: iso(60 * 20) },
    { oid: iso(60 * 44), time: iso(60 * 44) },
  ];
}

function viewVersionHistory(nodeName) {
  const slot = setActionPanelContext(nodeName, "Backup History");
  actionPanelCurrentModal = null; // History now renders directly in the panel, no modal borrowed
  if (!slot) return;
  const cached = historyCache[nodeName];
  historyState = {
    nodeName,
    data: cached ? cached.data.slice() : [],
    selected: cached ? cached.selected.slice() : [],
    loading: true,
    error: "",
  };
  const state = historyState;
  const requestId = ++historyLoadSequence;
  renderHistoryListScreen();

  fetch(`/api/oxidized/node/${encodeURIComponent(nodeName)}/versions`)
    .then((r) => {
      if (!r.ok) throw new Error(`Request failed (${r.status})`);
      return r.json();
    })
    .then((data) => {
      if (
        requestId !== historyLoadSequence ||
        historyState !== state ||
        !slot.isConnected
      ) {
        return;
      }
      let arr = Array.isArray(data) ? data : [];
      if (HISTORY_MOCK_ENABLED && arr.length === 0) arr = getMockHistory();
      state.data = arr;
      state.selected = state.selected.filter((selected) =>
        arr.some((entry) => entry.oid === selected.oid),
      );
      state.loading = false;
      historyCache[nodeName] = {
        data: arr.slice(),
        selected: state.selected.slice(),
      };
      renderHistoryListScreen();
    })
    .catch((err) => {
      if (
        requestId !== historyLoadSequence ||
        historyState !== state ||
        !slot.isConnected
      ) {
        return;
      }
      state.loading = false;
      state.error = err.message || "Unable to load backup history";
      if (HISTORY_MOCK_ENABLED && state.data.length === 0) {
        state.data = getMockHistory();
      }
      renderHistoryListScreen();
    });
}

// Formats a raw history timestamp into a date-group key ("23 September
// 2026") and a separate time line ("19:04"), same style used elsewhere.
function formatHistoryDateParts(rawDateStr) {
  const parsed = rawDateStr ? new Date(rawDateStr) : null;
  const valid = parsed && !isNaN(parsed.getTime());
  return {
    valid,
    epochSecs: valid ? Math.round(parsed.getTime() / 1000) : 0,
    dateKey: valid
      ? parsed.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "Unknown date",
    timeLine: valid
      ? `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`
      : "",
  };
}

// Renders the grouped-by-date list (the default History screen). Backups
// stay in the order the API returns them (newest first), so both the
// newest date group and the newest backup within a group land on top
// without re-sorting anything. A date can hold any number of backups —
// grouping only adds a heading, it never merges entries.
function renderHistoryListScreen() {
  const slot = document.querySelector(
    "#action-detail-panel .action-panel-slot",
  );
  if (!slot || !historyState) return;
  const data = historyState.data || [];
  const selected = historyState.selected || [];

  const refreshIndicator = historyState.loading
    ? '<div class="history-refresh-status" role="status">Refreshing backup history…</div>'
    : historyState.error
      ? `<div class="history-refresh-status history-refresh-error" role="status">${escapeHtml(historyState.error)}</div>`
      : "";

  if (data.length === 0) {
    slot.innerHTML = historyState.loading
      ? `<div class="history-panel">${refreshIndicator}<div class="history-list">
          <div class="skeleton-row"><span class="skeleton skeleton-inline" style="width: 220px;"></span></div>
          <div class="skeleton-row"><span class="skeleton skeleton-inline" style="width: 220px;"></span></div>
          <div class="skeleton-row"><span class="skeleton skeleton-inline" style="width: 220px;"></span></div>
        </div></div>`
      : `<div class="history-panel">${refreshIndicator}<div class="history-empty">No backup history found</div></div>`;
    return;
  }

  const total = data.length;
  let itemsHtml = "";
  let lastDateKey = null;
  let groupOpen = false;

  data.forEach((v, idx) => {
    const { dateKey, timeLine, epochSecs } = formatHistoryDateParts(
      v.time || v.date || "",
    );
    const num = total - idx;

    if (dateKey !== lastDateKey) {
      if (groupOpen) itemsHtml += `</div></div>`;
      itemsHtml += `
        <div class="history-date-group">
          <div class="history-date-heading">${escapeHtml(dateKey)}</div>
          <div class="history-date-items">
      `;
      lastDateKey = dateKey;
      groupOpen = true;
    }

    const isSelected = selected.some((s) => s.oid === v.oid);
    const disableCheckbox = !isSelected && selected.length >= 2;

    itemsHtml += `
      <div class="history-item">
        <input
          type="checkbox"
          class="history-checkbox"
          data-oid="${escapeHtml(v.oid)}"
          data-epoch="${epochSecs}"
          data-num="${num}"
          ${isSelected ? "checked" : ""}
          ${disableCheckbox ? "disabled" : ""}
          onchange="onHistoryCheckboxChange(this)"
        />
        <div class="history-item-text">
          <div class="history-item-title">Data Backup #${num}</div>
          <div class="history-item-time">${escapeHtml(timeLine)}</div>
        </div>
        <div class="history-row-actions">
          <button type="button" class="btn history-full-view-btn" onclick="openHistoryFullView('${escapeHtml(v.oid)}', ${num})">View</button>
        </div>
      </div>
    `;
  });
  if (groupOpen) itemsHtml += `</div></div>`;

  const count = selected.length;
  slot.innerHTML = `
    <div class="history-panel">
      ${refreshIndicator}
      <div class="history-list">${itemsHtml}</div>
      <div class="history-compare-bar">
        <span class="history-compare-count">${count} backup${count === 1 ? "" : "s"} selected</span>
        <button
          type="button"
          class="btn btn-success"
          ${count === 2 ? "" : "disabled"}
          onclick="compareSelectedHistory()"
        >
          Compare Selected
        </button>
      </div>
    </div>
  `;
}

// Checkbox is pure selection for Compare — never a status indicator. Once 2
// are selected, the rest are disabled so a 3rd can't be picked.
function onHistoryCheckboxChange(checkbox) {
  if (!historyState) return;
  const oid = checkbox.dataset.oid;
  if (checkbox.checked) {
    if (historyState.selected.length >= 2) {
      checkbox.checked = false;
      return;
    }
    historyState.selected.push({
      oid,
      epoch: checkbox.dataset.epoch,
      num: checkbox.dataset.num,
    });
  } else {
    historyState.selected = historyState.selected.filter((s) => s.oid !== oid);
  }
  historyCache[historyState.nodeName] = {
    data: historyState.data.slice(),
    selected: historyState.selected.slice(),
  };
  renderHistoryListScreen();
}

function openHistoryFullView(oid, backupNumber) {
  if (!historyState) return;
  const container = document.getElementById("compareViewContainer");
  if (!container) return;
  if (container.querySelector("#diffModalContent")) closeDiffModal();

  const entry = historyState.data.find((item) => item.oid === oid);
  if (!entry) return;
  const { dateKey, timeLine, epochSecs } = formatHistoryDateParts(
    entry.time || entry.date || "",
  );
  const nodeName = historyState.nodeName;
  const encodedName = encodeURIComponent(nodeName);
  const encodedOid = encodeURIComponent(oid);
  window.currentVersionConfig = "";

  container.innerHTML = `
    <section class="full-view-shell" aria-label="Full backup configuration">
      <header class="full-view-header">
        <div>
          <p class="full-view-eyebrow">Backup History</p>
          <h2>${escapeHtml(nodeName)} <span>· Backup #${backupNumber}</span></h2>
          <div class="full-view-meta">
            <span>${escapeHtml(dateKey)}</span>
            <span>${escapeHtml(timeLine)}</span>
          </div>
        </div>
        <div class="full-view-status" id="full-view-status">
          <span class="status-text status-pending"><span class="status-dot"></span>Loading</span>
        </div>
      </header>
      <textarea class="full-view-config" id="full-view-config" readonly aria-label="Backup configuration">Loading configuration…</textarea>
      <footer class="full-view-actions">
        <button type="button" class="btn" id="full-view-copy-btn" disabled onclick="copyFullViewConfig()">Copy Config</button>
        <button type="button" class="btn" onclick="closeHistoryFullView()">Close</button>
      </footer>
    </section>
  `;
  container.classList.add("show");
  const contentArea = document.querySelector(".content");
  if (contentArea) {
    contentArea.scrollTop = 0;
    contentArea.classList.add("compare-open");
  }

  fetch(
    `/api/oxidized/node/${encodedName}/version?oid=${encodedOid}&epoch=${encodeURIComponent(epochSecs)}`,
  )
    .then((response) => response.json())
    .then((data) => {
      const configBox = document.getElementById("full-view-config");
      const status = document.getElementById("full-view-status");
      const copyButton = document.getElementById("full-view-copy-btn");
      if (!configBox || !status || !copyButton) return;
      if (typeof data.config === "string" && data.config.length > 0) {
        configBox.value = data.config;
        window.currentVersionConfig = data.config;
        status.innerHTML = '<span class="status-text status-success"><span class="status-dot"></span>Success</span>';
        copyButton.disabled = false;
      } else {
        configBox.value = "";
        status.innerHTML = '<span class="status-text status-failed"><span class="status-dot"></span>Failed</span>';
      }
    })
    .catch(() => {
      const configBox = document.getElementById("full-view-config");
      const status = document.getElementById("full-view-status");
      if (configBox) configBox.value = "";
      if (status) {
        status.innerHTML = '<span class="status-text status-failed"><span class="status-dot"></span>Failed</span>';
      }
    });
}

function copyFullViewConfig() {
  if (!window.currentVersionConfig) return;
  copyTextToClipboard(window.currentVersionConfig)
    .then(() => {
      const button = document.getElementById("full-view-copy-btn");
      if (button) {
        button.textContent = "Copied!";
        setTimeout(() => {
          if (button.isConnected) button.textContent = "Copy Config";
        }, 1600);
      }
      showInfoToast("Version config copied to clipboard");
    })
    .catch(() => showInfoToast("Failed to copy config", true));
}

function closeHistoryFullView() {
  const container = document.getElementById("compareViewContainer");
  if (container) {
    container.classList.remove("show");
    container.innerHTML = "";
  }
  const contentArea = document.querySelector(".content");
  if (contentArea) contentArea.classList.remove("compare-open");
}

// Compare reuses the existing diff logic untouched — showDiff()/renderSplitDiff()/
// diffModal stay as they are; only where the result renders moved (Right Panel).
// This just feeds it the 2 selected backups.
function compareSelectedHistory() {
  if (!historyState || historyState.selected.length !== 2) {
    showInfoToast("Select exactly 2 versions to compare", true);
    return;
  }
  const [a, b] = historyState.selected;
  const ep1 = parseInt(a.epoch) || 0;
  const ep2 = parseInt(b.epoch) || 0;
  let oldEntry, newEntry;
  if (ep1 < ep2) {
    oldEntry = a;
    newEntry = b;
  } else {
    oldEntry = b;
    newEntry = a;
  }
  const oldParts = formatHistoryDateParts(
    (historyState.data.find((v) => v.oid === oldEntry.oid) || {}).time || "",
  );
  const newParts = formatHistoryDateParts(
    (historyState.data.find((v) => v.oid === newEntry.oid) || {}).time || "",
  );
  showDiff(
    historyState.nodeName,
    oldEntry.oid,
    newEntry.oid,
    oldEntry.epoch,
    newEntry.epoch,
    `Backup #${oldEntry.num} · ${oldParts.dateKey}`,
    `Backup #${newEntry.num} · ${newParts.dateKey}`,
  );
}

function showDiff(nodeName, oid1, oid2, epoch1, epoch2, oldLabel, newLabel) {
  // Set the target node before revealing, so revealDiffInContent() can label
  // the Right Panel context with the correct device name.
  window.diffNodeName = nodeName;
  window.diffOid1 = oid1;
  window.diffOid2 = oid2;
  document.getElementById("diff-title").textContent = `Compare Versions \u2014 ${nodeName}`;
  document.getElementById("diff-old-version-label").textContent =
    oldLabel || "Old Version";
  document.getElementById("diff-new-version-label").textContent =
    newLabel || "New Version";
  document.getElementById("diff-old-content").innerHTML =
    '<div style="padding: 40px; text-align: center;"><span class="skeleton skeleton-inline" style="width: 150px;"></span></div>';
  document.getElementById("diff-new-content").innerHTML =
    '<div style="padding: 40px; text-align: center;"><span class="skeleton skeleton-inline" style="width: 150px;"></span></div>';
  revealDiffInContent();
  // Always show every line; the Show All / Show Diff toggle button was removed.
  window.diffMode = "all";

  fetch(
    `/api/oxidized/node/${nodeName}/diff?oid1=${encodeURIComponent(oid1)}&oid2=${encodeURIComponent(oid2)}&epoch1=${encodeURIComponent(epoch1 || "")}&epoch2=${encodeURIComponent(epoch2 || "")}`,
  )
    .then((r) => r.json())
    .then((data) => {
      if (Array.isArray(data.aligned_lines)) {
        window.diffData = data.aligned_lines;
        window.diffStats = data.stats;
        renderSplitDiff(data.aligned_lines, data.stats);
      } else {
        document.getElementById("diff-old-content").innerHTML =
          '<div style="padding: 20px; color: #666;">No differences found.</div>';
        document.getElementById("diff-new-content").innerHTML =
          '<div style="padding: 20px; color: #666;">No differences found.</div>';
      }
    })
    .catch((err) => {
      document.getElementById("diff-old-content").innerHTML =
        '<div style="padding: 20px; color: #dc3545;">Error: ' +
        err.message +
        "</div>";
      document.getElementById("diff-new-content").innerHTML =
        '<div style="padding: 20px; color: #dc3545;">Error: ' +
        err.message +
        "</div>";
    });
}

let diffScrollSyncing = false;

function syncScroll(source, targetId) {
  if (diffScrollSyncing) return;
  diffScrollSyncing = true;
  const target = document.getElementById(targetId);
  if (target) {
    target.scrollTop = source.scrollTop;
    target.scrollLeft = source.scrollLeft;
  }
  requestAnimationFrame(() => {
    diffScrollSyncing = false;
  });
}

const diffJumpIndexes = { added: 0, removed: 0, modified: 0 };
const diffJumpTargets = { added: [], removed: [], modified: [] };

function renderDiffLine(lineNumber, content, kind, isSpacer, index) {
  const cellClass = isSpacer ? "diff-line-cell diff-spacer" : `diff-line-cell diff-cell-${kind}`;
  return `<div class="diff-line-row" data-diff-kind="${kind}" data-diff-index="${index}">
    <span class="diff-line-number">${lineNumber || ""}</span>
    <span class="${cellClass}">${isSpacer ? "" : escapeHtml(content || "")}</span>
  </div>`;
}

function renderDiffStats(stats) {
  const same = stats.same ?? stats.equal ?? 0;
  const added = stats.added ?? stats.insert ?? 0;
  const removed = stats.removed ?? stats.delete ?? 0;
  const changed = stats.changed ?? 0;
  const html =
    `<span class="diff-stat diff-stat-same">${same} same</span>` +
    (added > 0
      ? `<button type="button" class="diff-stat diff-stat-added" data-diff-jump="added">+${added}</button>`
      : "") +
    (removed > 0
      ? `<button type="button" class="diff-stat diff-stat-removed" data-diff-jump="removed">-${removed}</button>`
      : "") +
    (changed > 0
      ? `<button type="button" class="diff-stat diff-stat-modified" data-diff-jump="modified">~${changed}</button>`
      : "");
  document.getElementById("diff-old-count").innerHTML = html;
  document.getElementById("diff-new-count").innerHTML = html;
}

document.addEventListener("click", (event) => {
  const target = event.target;
  const badge = target && target.closest
    ? target.closest("[data-diff-jump]")
    : null;
  if (badge) jumpToDiffChange(badge.dataset.diffJump);
});

function renderSplitDiff(lines, stats) {
  let oldHtml = "";
  let newHtml = "";
  Object.keys(diffJumpIndexes).forEach((key) => {
    diffJumpIndexes[key] = 0;
    diffJumpTargets[key] = [];
  });

  let previousKind = "same";
  (lines || []).forEach((line, index) => {
    let kind = "same";
    if (line.type === "insert") kind = "added";
    else if (line.type === "delete") kind = "removed";
    else if (line.type === "modified") kind = "modified";
    if (kind !== "same" && kind !== previousKind) {
      diffJumpTargets[kind].push(index);
    }
    previousKind = kind;

    oldHtml += renderDiffLine(
      line.old_line,
      line.old_content,
      kind,
      line.old_line == null,
      index,
    );
    newHtml += renderDiffLine(
      line.new_line,
      line.new_content,
      kind,
      line.new_line == null,
      index,
    );
  });

  document.getElementById("diff-old-content").innerHTML =
    oldHtml || '<div class="diff-empty">No content</div>';
  document.getElementById("diff-new-content").innerHTML =
    newHtml || '<div class="diff-empty">No content</div>';
  if (stats) renderDiffStats(stats);
}

function jumpToDiffChange(kind) {
  const oldPane = document.getElementById("diff-old-content");
  const newPane = document.getElementById("diff-new-content");
  const targets = diffJumpTargets[kind];
  if (!oldPane || !newPane || !targets || targets.length === 0) return;

  const targetIndex = targets[diffJumpIndexes[kind] % targets.length];
  diffJumpIndexes[kind] += 1;
  [oldPane, newPane].forEach((pane) => {
    const row = pane.querySelector(
      `.diff-line-row[data-diff-index="${targetIndex}"]`,
    );
    if (!row) return;
    pane.scrollTo({
      top: Math.max(0, row.offsetTop - pane.clientHeight / 3),
      behavior: "smooth",
    });
    row.classList.add("diff-jump-highlight");
    clearTimeout(row._diffHighlightTimer);
    row._diffHighlightTimer = setTimeout(
      () => row.classList.remove("diff-jump-highlight"),
      1400,
    );
  });
}

function closeVersionHistoryModal() {
  document.getElementById("versionHistoryModal").classList.remove("show");
  resetActionPanelIfShowing("versionHistoryModal");
}

// Tracks whether the diff was rendered into the Right Panel (normal) or fell
// back to the center overlay (only when the panel is hidden at narrow widths).
let diffShownInPanel = false;

// Compare/Diff always renders as a full overlay in the center content area
// (#compareViewContainer), covering the device list; closing it brings the
// devices back. The Right Panel keeps the Backup History list + checkbox
// selection (held in historyState) so another pair can be compared right
// away. The exact same #diffModalContent and renderSplitDiff() logic are
// reused — only the DOM target is the center overlay.
function revealDiffInContent() {
  const content = document.getElementById("diffModalContent");
  if (!content) return;
  const container = document.getElementById("compareViewContainer");
  if (!container) return;
  container.innerHTML = "";
  container.appendChild(content);
  container.classList.add("show");
  diffShownInPanel = false;

  // The overlay lives inside the scrollable .content, so .content's own
  // scrollbar would still show at the right edge (right next to the Close
  // button). Lock the page scroll (and reset it to the top) while comparing.
  const contentArea = document.querySelector(".content");
  if (contentArea) {
    contentArea.scrollTop = 0;
    contentArea.classList.add("compare-open");
  }
}

function closeDiffModal() {
  const modal = document.getElementById("diffModal");
  const content = document.getElementById("diffModalContent");
  const container = document.getElementById("compareViewContainer");

  // Hand the diff content back to its own modal and hide the center overlay so
  // the device list underneath reappears.
  if (modal && content) modal.appendChild(content);
  if (container) {
    container.classList.remove("show");
    container.innerHTML = "";
  }

  // Restore the page-content scroll now that the overlay is gone.
  const contentArea = document.querySelector(".content");
  if (contentArea) contentArea.classList.remove("compare-open");

  // Defensive: clear any legacy right-panel diff state.
  const panel = document.querySelector(".right-panel");
  if (panel) panel.classList.remove("right-panel-diff");
  const body = document.getElementById("action-detail-panel");
  if (body) body.classList.remove("panel-diff-mode");
  diffShownInPanel = false;

  // Bring the Backup History list back in the Right Panel (same pair still
  // selected) so another comparison can start without re-opening history.
  if (historyState && historyState.nodeName) {
    const slot = setActionPanelContext(historyState.nodeName, "Backup History");
    if (slot) renderHistoryListScreen();
  }
}

// ============ Scheduler (automatic backup planning: global + per device/group) ============
// Replaces the old single "backup interval (minutes)" setting. Backend endpoints expected:
//   GET/PUT  /api/scheduler/global            -> { interval_days, time, enabled, next_run }
//   GET      /api/scheduler/overrides         -> { overrides: [{ id, target_type, target_id, target_name, interval_days, time, enabled, next_run }] }
//   POST     /api/scheduler/overrides         -> create override
//   PUT      /api/scheduler/overrides/:id     -> update override
//   DELETE   /api/scheduler/overrides/:id     -> delete override
//
// NOTE: these routes don't exist on the server yet (requests 404, and the
// server's 404/error page is HTML — that's why the console showed
// "Unexpected token '<' ... is not valid JSON"). Until the backend implements
// them, everything below transparently falls back to the browser's
// localStorage so the Scheduler tab still works end-to-end. The moment the
// real routes exist and return JSON, they take over automatically — nothing
// else needs to change here.
let schedulerOverrides = [];
let schedulerBackendWarned = false;
let schedulePanelRequestId = 0;

const SCHED_LOCAL_GLOBAL_KEY = "oxi_scheduler_global_v1";
const SCHED_LOCAL_OVERRIDES_KEY = "oxi_scheduler_overrides_v1";

function schedWarnBackendMissingOnce() {
  // Keep the on-page banner visible for as long as the fallback is in use
  // (it's idempotent, safe to call every time a scheduler request 404s),
  // but only spam the console once.
  const banner = document.getElementById("scheduler-backend-warning");
  if (banner) banner.style.display = "block";
  if (schedulerBackendWarned) return;
  schedulerBackendWarned = true;
  console.warn(
    "[Scheduler] /api/scheduler/* not found on the server yet — using local browser storage as a fallback until those routes are implemented.",
  );
}

function schedComputeNextRun(intervalDays, time) {
  try {
    const parts = (time || "02:00").split(":");
    const hh = parseInt(parts[0], 10) || 0;
    const mm = parseInt(parts[1], 10) || 0;
    const next = new Date();
    next.setSeconds(0, 0);
    next.setHours(hh, mm);
    if (next <= new Date()) next.setDate(next.getDate() + 1);
    return next.toISOString();
  } catch (e) {
    return null;
  }
}

function schedGetLocalGlobal() {
  try {
    const raw = localStorage.getItem(SCHED_LOCAL_GLOBAL_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { interval_days: 7, time: "02:00", enabled: true, next_run: null };
}

function schedSetLocalGlobal(data) {
  const toStore = Object.assign({}, data, {
    next_run: schedComputeNextRun(data.interval_days, data.time),
  });
  try {
    localStorage.setItem(SCHED_LOCAL_GLOBAL_KEY, JSON.stringify(toStore));
  } catch (e) {}
  return toStore;
}

function schedGetLocalOverrides() {
  try {
    const raw = localStorage.getItem(SCHED_LOCAL_OVERRIDES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

function schedSetLocalOverrides(list) {
  try {
    localStorage.setItem(SCHED_LOCAL_OVERRIDES_KEY, JSON.stringify(list));
  } catch (e) {}
}

// Wraps fetch() for the scheduler API: resolves with parsed JSON on a real
// success, or rejects with a lightweight marker whenever the route 404s,
// errors, or returns something that isn't JSON — so callers can fall back
// to the local store instead of throwing a parse error to the console.
function schedApiRequest(url, options) {
  return fetch(url, options)
    .catch(() => Promise.reject({ backendMissing: true }))
    .then((res) => {
      if (!res.ok) return Promise.reject({ backendMissing: true });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        return Promise.reject({ backendMissing: true });
      }
      return res.json();
    });
}

function frequencyDaysFromSelect(prefix) {
  const sel = document.getElementById(prefix + "Frequency").value;
  if (sel === "custom") {
    const customInput = document.getElementById(prefix + "CustomDays");
    return parseInt(customInput.value) || 1;
  }
  return parseInt(sel);
}

function toggleCustomFrequencyInput(prefix) {
  const sel = document.getElementById(prefix + "Frequency").value;
  const wrap = document.getElementById(prefix + "CustomWrap");
  if (wrap) wrap.style.display = sel === "custom" ? "block" : "none";
}

function formatFrequencyLabel(days) {
  days = parseInt(days);
  if (days === 1) return "Every day";
  if (days === 3) return "Every 3 days";
  if (days === 7) return "Every week";
  if (days === 30) return "Every month";
  return `Every ${days} day(s)`;
}

function applyFrequencyToSelect(prefix, days) {
  const knownValues = ["1", "3", "7", "30"];
  const daysStr = String(days);
  const select = document.getElementById(prefix + "Frequency");
  const customWrap = document.getElementById(prefix + "CustomWrap");
  if (knownValues.includes(daysStr)) {
    select.value = daysStr;
    if (customWrap) customWrap.style.display = "none";
  } else {
    select.value = "custom";
    const customInput = document.getElementById(prefix + "CustomDays");
    if (customInput) customInput.value = daysStr;
    if (customWrap) customWrap.style.display = "block";
  }
}

function updateSchedulerSummaryBadge(data) {
  const el = document.getElementById("scheduler-summary-display");
  if (!el) return;
  if (!data || data.enabled === false) {
    el.textContent = "Disabled";
    return;
  }
  el.textContent = `${formatFrequencyLabel(data.interval_days || 1)}${data.time ? " @ " + data.time : ""}`;
}

function applySchedulerGlobalData(data) {
  applyFrequencyToSelect("schedulerGlobal", data.interval_days || 7);
  document.getElementById("schedulerGlobalTime").value = data.time || "02:00";
  document.getElementById("schedulerGlobalEnabled").checked =
    data.enabled !== false;
  const nextEl = document.getElementById("scheduler-global-next");
  if (nextEl) {
    const statusText =
      data.enabled === false
        ? "Disabled"
        : `${formatFrequencyLabel(data.interval_days || 1)}${data.time ? " @ " + data.time : ""}`;
    const nextRunText = data.next_run
      ? ` · ${"Next run"}: ${new Date(data.next_run).toLocaleString()}`
      : "";
    nextEl.textContent = statusText + nextRunText;
  }
  updateSchedulerSummaryBadge(data);
}

function loadSchedulerSettings() {
  schedApiRequest("/api/scheduler/global")
    .then((data) => {
      applySchedulerGlobalData(data);
    })
    .catch(() => {
      schedWarnBackendMissingOnce();
      applySchedulerGlobalData(schedGetLocalGlobal());
    });

  loadSchedulerOverrides();
}

function openGlobalSchedule() {
  // Show in the Right Panel (like the other schedule actions), not a centered,
  // blurred modal.
  revealModalInActionPanel("globalScheduleModal", "", "Global Schedule");
}

function closeGlobalScheduleModal() {
  document.getElementById("globalScheduleModal").classList.remove("show");
  resetActionPanelIfShowing("globalScheduleModal");
}

function saveGlobalSchedule(e) {
  e.preventDefault();
  const payload = {
    interval_days: frequencyDaysFromSelect("schedulerGlobal"),
    time: document.getElementById("schedulerGlobalTime").value,
    enabled: document.getElementById("schedulerGlobalEnabled").checked,
  };

  // The global schedule is all-or-nothing: saving it replaces every per-device
  // and per-group override, so warn first when exceptions exist (destructive).
  const overrideCount = (schedulerOverrides || []).length;
  if (overrideCount > 0) {
    const label = `${formatFrequencyLabel(payload.interval_days)} @ ${payload.time}`;
    confirmAction(
      `Saving the Global Schedule (${label}) will delete all ${overrideCount} per-device/group schedule(s) and apply this schedule to ALL groups and devices. Continue?`,
      () => performGlobalScheduleSave(payload),
    );
    return;
  }
  performGlobalScheduleSave(payload);
}

function performGlobalScheduleSave(payload) {
  const clearServerOverrides = () =>
    Promise.all(
      (schedulerOverrides || []).map((o) =>
        schedApiRequest(`/api/scheduler/overrides/${o.id}`, {
          method: "DELETE",
        }).catch(() => {}),
      ),
    );

  schedApiRequest("/api/scheduler/global", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((data) => {
      if (data.success === false) {
        showInfoToast(data.error || "Failed to save global schedule", true);
        return;
      }
      // Global wins over everything: drop all per-item overrides server-side.
      clearServerOverrides().then(() => {
        schedulerOverrides = [];
        showInfoToast(
          "Global Schedule Saved — all groups and devices now follow it",
        );
        closeGlobalScheduleModal();
        loadSchedulerSettings();
      });
    })
    .catch(() => {
      schedWarnBackendMissingOnce();
      schedSetLocalGlobal(payload);
      // Mirror the wipe in the local store so the Scheduler table reflects it.
      schedSetLocalOverrides([]);
      schedulerOverrides = [];
      showInfoToast(
        "Global Schedule Saved locally — all per-device/group schedules were cleared so everything follows the global one (server scheduler API isn't set up yet)",
      );
      closeGlobalScheduleModal();
      loadSchedulerSettings();
    });
}

function loadSchedulerOverrides() {
  return schedApiRequest("/api/scheduler/overrides")
    .then((data) => {
      schedulerOverrides = data.overrides || [];
      renderSchedulerOverrides(schedulerOverrides);
      return schedulerOverrides;
    })
    .catch(() => {
      schedWarnBackendMissingOnce();
      schedulerOverrides = schedGetLocalOverrides();
      renderSchedulerOverrides(schedulerOverrides);
      return schedulerOverrides;
    });
}

function renderSchedulerOverrides(list) {
  const tbody = document.getElementById("schedulerOverridesList");
  if (!tbody) return;
  list = list || [];
  // This table now lists ONLY the individual exceptions (per-device / per-group
  // schedules). Everything else follows the Global Schedule and is shown in the
  // Global card's member list. Saving a Global Schedule empties this table.
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">${"No individual schedules — every group and device follows the Global Schedule"}</td></tr>`;
    renderGlobalMembersList();
    return;
  }
  tbody.innerHTML = list
    .map(
      (o) => `
        <tr>
            <td>${
              o.target_type === "group"
                ? '<span style="background:#e3f2fd;padding:2px 8px;border-radius:12px;font-size:12px;">' +
                  escapeHtml(o.target_name) +
                  "</span>"
                : escapeHtml(o.target_name)
            }</td>
            <td>${formatFrequencyLabel(o.interval_days)}</td>
            <td>${escapeHtml(o.time || "-")}</td>
            <td>${
              o.enabled === false
                ? `<span style="color:var(--danger);">${"Disabled"}</span>`
                : `<span style="color:var(--success);">${"Enabled"}</span>`
            }</td>
            <td>${o.next_run ? new Date(o.next_run).toLocaleString() : "-"}</td>
        </tr>
    `,
    )
    .join("");
  renderGlobalMembersList();
}

// Groups & devices currently covered by the Global Schedule = everything that
// has no individual override of its own (and, for a device, whose group isn't
// overridden either). Kept in sync with the overrides table.
function renderGlobalMembersList() {
  const el = document.getElementById("schedulerGlobalMembers");
  if (!el) return;
  const ov = schedulerOverrides || [];
  // Nothing carved out yet: the entire inventory follows the global schedule,
  // so collapse it into one tidy summary instead of a chip per group/device.
  // As soon as any group or device gets its own (non-global) schedule, this
  // switches to enumerating exactly which groups/devices still follow global.
  if (ov.length === 0) {
    el.innerHTML = `<span class="global-member-chip all">All groups and devices are in the global schedule</span>`;
    return;
  }
  const overriddenGroupIds = new Set(
    ov.filter((o) => o.target_type === "group").map((o) => String(o.target_id)),
  );
  const overriddenNodeNames = new Set(
    ov.filter((o) => o.target_type === "node").map((o) => String(o.target_name)),
  );
  const chips = [];
  (allGroups || []).forEach((g) => {
    if (!overriddenGroupIds.has(String(g.id))) {
      chips.push(
        `<span class="global-member-chip group">${escapeHtml(g.name)}</span>`,
      );
    }
  });
  (allNodes || []).forEach((n) => {
    if (
      overriddenGroupIds.has(String(n.group_id)) ||
      overriddenNodeNames.has(String(n.name))
    )
      return;
    chips.push(`<span class="global-member-chip">${escapeHtml(n.name)}</span>`);
  });
  el.innerHTML = chips.length
    ? chips.join("")
    : `<span class="caption">No groups or devices are on the global schedule.</span>`;
}

function onScheduleOverrideTypeChange() {
  const type = document.getElementById("scheduleOverrideType").value;
  const targetSelect = document.getElementById("scheduleOverrideTarget");
  const label = document.getElementById("scheduleOverrideTargetLabel");
  if (type === "group") {
    if (label) label.textContent = "Group";
    targetSelect.innerHTML = (allGroups || [])
      .map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`)
      .join("");
  } else {
    if (label) label.textContent = "Hostname";
    targetSelect.innerHTML = (allNodes || [])
      .map(
        (n) =>
          `<option value="${escapeHtml(n.name)}">${escapeHtml(n.name)}</option>`,
      )
      .join("");
  }
  updateSchedInheritNote();
}

// Clarifies, inside the Schedule popup, whether the picked device/group already
// has its own schedule or is just inheriting the Global one. Without this the
// default prefill ("Every week @ 02:00") looked identical to the global
// schedule, so saving a global schedule appeared to have overwritten every
// group — in reality group/device overrides are stored separately and are
// never touched by a global save.
function updateSchedInheritNote() {
  const note = document.getElementById("schedInheritNote");
  if (!note) return;
  const type = document.getElementById("scheduleOverrideType").value;
  const targetVal = document.getElementById("scheduleOverrideTarget").value;
  const kind = type === "group" ? "group" : "device";
  const existing = targetVal
    ? findScheduleOverrideForTarget(type, targetVal)
    : null;
  // Reflect the live Global form fields so the note matches what the user set.
  const gDays = frequencyDaysFromSelect("schedulerGlobal");
  const gTime = document.getElementById("schedulerGlobalTime").value || "02:00";
  const gLabel = `${formatFrequencyLabel(gDays)} @ ${gTime}`;
  if (existing) {
    note.className = "sched-inherit-note has-own";
    note.innerHTML =
      `This ${kind} has its <strong>own schedule</strong> ` +
      `(${formatFrequencyLabel(existing.interval_days)} @ ${existing.time || "02:00"}) that currently overrides the Global Schedule. ` +
      `Heads up: <strong>saving a new Global Schedule will remove this exception</strong> and make this ${kind} follow the global one.`;
  } else {
    note.className = "sched-inherit-note follows";
    note.innerHTML =
      `No individual schedule yet — this ${kind} follows the <strong>Global Schedule</strong> ` +
      `(<strong>${escapeHtml(gLabel)}</strong>). Saving here creates a separate schedule for this ${kind} only; ` +
      `the Global Schedule and other groups/devices stay unchanged.`;
  }
}

function findScheduleOverrideForTarget(type, target) {
  return (schedulerOverrides || []).find((o) => {
    if (o.target_type !== type) return false;
    return type === "group"
      ? String(o.target_id) === String(target)
      : String(o.target_name) === String(target);
  });
}

// Opens the schedule popup for a specific device or group (from the row's
// "Schedule" button). Re-uses an existing override for that target instead
// of creating a duplicate, if one is already configured.
function openDeviceOrGroupSchedule(type, target) {
  if (type !== "node" && deviceAccordionActive) renderActionPanelPlaceholder();
  const isCurrentPanelNode =
    type === "node" &&
    deviceAccordionActive &&
    currentPanelDevice === target &&
    activeDeviceAccordionSection === "schedule-backup";
  const schedulePanel = isCurrentPanelNode
    ? document.getElementById("device-accordion-schedule-backup")
    : null;
  const requestId = ++schedulePanelRequestId;
  if (schedulePanel) {
    schedulePanel.innerHTML =
      '<div class="history-refresh-status" role="status">Loading schedule…</div>';
  }
  return loadSchedulerOverrides().then(() => {
    if (
      requestId !== schedulePanelRequestId ||
      (isCurrentPanelNode &&
        (!deviceAccordionActive ||
          currentPanelDevice !== target ||
          activeDeviceAccordionSection !== "schedule-backup"))
    ) {
      return;
    }
    const existing = findScheduleOverrideForTarget(type, target);
    openScheduleOverrideModal(existing ? existing.id : null, type, target);
  });
}

function openScheduleOverrideModal(id, presetType, presetTarget) {
  let contextName = presetTarget || "";
  if (presetType === "group" && presetTarget) {
    const g = (allGroups || []).find(
      (grp) => String(grp.id) === String(presetTarget),
    );
    contextName = g ? g.name : presetTarget;
  } else if (id) {
    const existing = schedulerOverrides.find(
      (o) => String(o.id) === String(id),
    );
    if (existing) {
      contextName =
        existing.target_type === "group"
          ? existing.target_name
          : existing.target_name;
    }
  }
  revealModalInActionPanel(
    "scheduleOverrideModal",
    contextName,
    "Schedule Backup",
  );
  document.getElementById("editScheduleOverrideId").value = id || "";
  document.getElementById("schedule-override-title").textContent = id
    ? "Edit Schedule Override"
    : "Add Schedule Override";

  document.getElementById("scheduleOverrideType").value = presetType || "node";
  onScheduleOverrideTypeChange();
  applyFrequencyToSelect("scheduleOverride", 7);
  document.getElementById("scheduleOverrideTime").value = "02:00";

  if (id) {
    const existing = schedulerOverrides.find(
      (o) => String(o.id) === String(id),
    );
    if (existing) {
      document.getElementById("scheduleOverrideType").value =
        existing.target_type;
      onScheduleOverrideTypeChange();
      document.getElementById("scheduleOverrideTarget").value =
        existing.target_type === "group"
          ? existing.target_id
          : existing.target_name;
      applyFrequencyToSelect("scheduleOverride", existing.interval_days || 7);
      document.getElementById("scheduleOverrideTime").value =
        existing.time || "02:00";
    }
  } else if (presetTarget) {
    // Opened from a specific device/group row: pre-select that target.
    document.getElementById("scheduleOverrideTarget").value = presetTarget;
  }

  updateSchedInheritNote();

  // Only an existing schedule can be removed; add/remove that action here so
  // the whole lifecycle (create/edit/delete) stays on the device/group popup.
  const cancelBtn = document.getElementById("sched-override-cancel");
  const actionsRow = cancelBtn ? cancelBtn.parentElement : null;
  let removeBtn = document.getElementById("sched-override-remove");
  if (id) {
    if (!removeBtn && actionsRow) {
      removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.id = "sched-override-remove";
      removeBtn.className = "btn btn-danger flex-1";
      removeBtn.textContent = "Delete";
      actionsRow.appendChild(removeBtn);
    }
    if (removeBtn) {
      removeBtn.style.display = "";
      removeBtn.onclick = function () {
        deleteScheduleOverride(id);
        closeScheduleOverrideModal();
      };
    }
  } else if (removeBtn) {
    removeBtn.style.display = "none";
  }
}

function closeScheduleOverrideModal() {
  document.getElementById("scheduleOverrideModal").classList.remove("show");
  resetActionPanelIfShowing("scheduleOverrideModal");
}

// When a GROUP schedule is saved, devices in that group whose individual
// schedule is identical to the group's become redundant: they are removed so
// those devices simply follow the group schedule. Device schedules that
// differ (e.g. group weekly vs device every-3-days) are kept — the device
// override still wins over the group.
function findRedundantNodeOverrides(list, groupName, sched) {
  // Nodes carry their group as group_name (+ group_id when loaded from the
  // API), so membership is matched on the id first and the name as fallback.
  const inGroup = (n) =>
    (sched.target_id != null &&
      String(n.group_id) === String(sched.target_id)) ||
    (n.group_name || n.group) === groupName;
  const members = new Set(
    (allNodes || []).filter(inGroup).map((n) => n.name),
  );
  return (list || []).filter(
    (o) =>
      o.target_type === "node" &&
      members.has(o.target_name) &&
      String(o.interval_days) === String(sched.interval_days) &&
      (o.time || "") === (sched.time || ""),
  );
}

function saveScheduleOverride(e) {
  e.preventDefault();
  const id = document.getElementById("editScheduleOverrideId").value;
  const targetType = document.getElementById("scheduleOverrideType").value;
  const targetValue = document.getElementById("scheduleOverrideTarget").value;

  if (!targetValue) {
    showInfoToast("Please select a device or group", true);
    return;
  }

  const resolvedTargetName =
    targetType === "group"
      ? (
          (allGroups || []).find((g) => String(g.id) === String(targetValue)) ||
          {}
        ).name || targetValue
      : targetValue;

  const payload = {
    target_type: targetType,
    target_id: targetType === "group" ? targetValue : null,
    target_name: resolvedTargetName,
    interval_days: frequencyDaysFromSelect("scheduleOverride"),
    time: document.getElementById("scheduleOverrideTime").value,
    enabled: true,
  };

  const method = id ? "PUT" : "POST";
  const url = id
    ? `/api/scheduler/overrides/${id}`
    : "/api/scheduler/overrides";
  let mergedCount = 0;

  schedApiRequest(url, {
    method: method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((data) => {
      if (data.success === false) {
        showInfoToast(data.error || "Failed to save schedule", true);
        return;
      }
      const done = () => {
        showInfoToast(
          (id ? "Schedule Override Updated" : "Schedule Override Added") +
            ` (${resolvedTargetName})` +
            (mergedCount
              ? ` — ${mergedCount} identical device schedule(s) now follow the group`
              : ""),
        );
        closeScheduleOverrideModal();
        loadSchedulerOverrides();
      };
      if (targetType === "group") {
        const redundants = findRedundantNodeOverrides(
          schedulerOverrides,
          resolvedTargetName,
          payload,
        );
        if (redundants.length) {
          mergedCount = redundants.length;
          Promise.all(
            redundants.map((o) =>
              schedApiRequest(`/api/scheduler/overrides/${o.id}`, {
                method: "DELETE",
              }).catch(() => {}),
            ),
          ).then(done);
          return;
        }
      }
      done();
    })
    .catch(() => {
      schedWarnBackendMissingOnce();
      const list = schedGetLocalOverrides();
      if (id) {
        const idx = list.findIndex((o) => String(o.id) === String(id));
        if (idx !== -1) list[idx] = Object.assign({}, list[idx], payload);
      } else {
        payload.id = "local-" + Date.now();
        payload.next_run = schedComputeNextRun(
          payload.interval_days,
          payload.time,
        );
        list.push(payload);
      }
      // Local mirror of the group-inheritance rule (see above).
      if (targetType === "group") {
        const redundantIds = new Set(
          findRedundantNodeOverrides(list, resolvedTargetName, payload).map(
            (o) => String(o.id),
          ),
        );
        if (redundantIds.size) {
          mergedCount = redundantIds.size;
          for (let i = list.length - 1; i >= 0; i--) {
            if (redundantIds.has(String(list[i].id))) list.splice(i, 1);
          }
        }
      }
      schedSetLocalOverrides(list);
      showInfoToast(
        (id ? "Schedule Override Updated" : "Schedule Override Added") +
          ` (${resolvedTargetName})` +
          " locally (server scheduler API isn't set up yet)" +
          (mergedCount
            ? ` — ${mergedCount} identical device schedule(s) now follow the group`
            : ""),
      );
      closeScheduleOverrideModal();
      loadSchedulerOverrides();
    });
}

function deleteScheduleOverride(id) {
  // Name the target (device or group) in the popup so it's clear which
  // schedule is being removed. Blocking: Delete/Cancel must be picked first.
  const ov = (schedulerOverrides || []).find(
    (o) => String(o.id) === String(id),
  );
  const label = ov && ov.target_name ? ` (${ov.target_name})` : "";
  confirmAction(
    `Delete this backup schedule${label}? This cannot be undone.`,
    () => {
      schedApiRequest(`/api/scheduler/overrides/${id}`, { method: "DELETE" })
        .then((data) => {
          if (data.success === false) {
            showInfoToast(data.error || "Failed to delete schedule", true);
            return;
          }
          showInfoToast(`Schedule Override Deleted${label}`);
          loadSchedulerOverrides();
        })
        .catch(() => {
          schedWarnBackendMissingOnce();
          const list = schedGetLocalOverrides().filter(
            (o) => String(o.id) !== String(id),
          );
          schedSetLocalOverrides(list);
          showInfoToast(`Schedule Override Deleted${label}`);
          loadSchedulerOverrides();
        });
    },
    { danger: true, confirmLabel: "Delete", blocking: true },
  );
}

// ============ Trigger Backup ============
// Status flows Triggered -> Waiting -> Success/Failed and is shown directly
// in the Dashboard table's Status column, plus a bottom pop-up toast naming the
// device for the final result (the pop-up is a fixed overlay, so the table never
// shifts). Latest Backup only changes once a backup actually succeeds. Exactly
// one Activity Log entry is written per trigger, for the final result only —
// never one for each intermediate state.
function setTriggerStatus(nodeName, state) {
  if (state) {
    triggerStatusOverrides[nodeName] = state;
  } else {
    delete triggerStatusOverrides[nodeName];
  }
  refreshNodeDisplays();
}

// Re-renders the unified Devices view from data already in memory (no re-fetch).
function refreshNodeDisplays() {
  renderDevices();
}

function triggerBackup(nodeName) {
  confirmAction(`Trigger backup for ${nodeName}?`, () =>
    doTriggerBackup(nodeName),
  );
}

function doTriggerBackup(nodeName) {
  setTriggerStatus(nodeName, "triggered");
  // One Activity Log entry for this whole trigger: starts as "pending"
  // (Waiting) and gets updated in place below — never a second entry, and
  // the Action/Detail section above Activity Log is never opened for this.
  const logId = addPendingActivityLogEntry(nodeName);

  // Brief "Triggered" flash before "Waiting", matching the required flow.
  // Guarded so it can't clobber a result that already arrived by then.
  setTimeout(() => {
    if (triggerStatusOverrides[nodeName] === "triggered") {
      setTriggerStatus(nodeName, "waiting");
    }
  }, 400);

  fetch(`/api/oxidized/node/${nodeName}/backup`, { method: "POST" })
    .then(async (r) => {
      const data = await r.json();
      return { response: r, data };
    })
    .then(({ response, data }) => {
      const now = Date.now();
      if (response.ok && data.success && data.status !== "failed") {
        // Only a successful backup updates Latest Backup.
        oxidizedStatus[nodeName] = Object.assign(
          {},
          oxidizedStatus[nodeName],
          {
            status: data.status || "success",
            last: {
              end: data.last_backup || new Date(now).toISOString(),
              status: data.status || "success",
            },
          },
        );
        setTriggerStatus(nodeName, null);
        updateActivityLogEntry(
          logId,
          "success",
          Date.parse(data.last_backup) || now,
          data.activity_entry,
        );
        showInfoToast(`Backup completed (${nodeName})`);
      } else {
        oxidizedStatus[nodeName] = Object.assign(
          {},
          oxidizedStatus[nodeName],
          {
            status: data.status || "failed",
            last: data.last_backup
              ? { end: data.last_backup, status: data.status || "failed" }
              : (oxidizedStatus[nodeName] || {}).last,
          },
        );
        setTriggerStatus(nodeName, null);
        updateActivityLogEntry(
          logId,
          "failed",
          Date.parse(data.last_backup) || now,
          data.activity_entry,
        );
        showInfoToast(
          data.error || `Backup failed (${nodeName})`,
          true,
        );
      }
      refreshNodeDisplays();
    })
    .catch((error) => {
      oxidizedStatus[nodeName] = Object.assign(
        {},
        oxidizedStatus[nodeName],
        { status: "failed" },
      );
      setTriggerStatus(nodeName, null);
      updateActivityLogEntry(logId, "failed", Date.now());
      refreshNodeDisplays();
      showInfoToast(
        error && error.message
          ? `Backup failed (${nodeName}): ${error.message}`
          : `Backup failed (${nodeName})`,
        true,
      );
    });
}

// ============ Node CRUD ============
let editNodeLoadSequence = 0;

function openEditModal(name) {
  const requestId = ++editNodeLoadSequence;
  Promise.all([
    fetch("/api/credentials").then((r) => readApiResponse(r)),
    fetch("/api/models").then((r) => readApiResponse(r)),
    fetch("/api/groups").then((r) => readApiResponse(r)),
  ])
    .then(([creds, models, groupsData]) => {
      allCredentials = creds;

      const credSelect = document.getElementById("editNodeCredential");
      credSelect.innerHTML = '<option value="">Select credential</option>';
      creds.forEach((c) => {
        // Only enabled credentials are selectable when editing a device,
        // matching the Add Device dropdown.
        if (c.enabled === false) return;
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.label} (${c.username})`;
        credSelect.appendChild(opt);
      });

      const modelSelect = document.getElementById("editNodeModel");
      modelSelect.innerHTML = '<option value="">Select device model</option>';
      models
        .filter((m) => m.enabled)
        .forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m.id;
          opt.textContent = formatModelDisplay(m.name);
          modelSelect.appendChild(opt);
        });

      const groupSelect = document.getElementById("editNodeGroup");
      groupSelect.innerHTML = '<option value="">Select a group…</option>';
      groupsData.groups.forEach((g) => {
        const opt = document.createElement("option");
        opt.value = g.id;
        opt.textContent = g.name;
        groupSelect.appendChild(opt);
      });

      return fetch(`/api/nodes/${encodeURIComponent(name)}`).then((r) =>
        readApiResponse(r),
      );
    })
    .then((node) => {
      if (
        requestId !== editNodeLoadSequence ||
        (deviceAccordionActive &&
          (currentPanelDevice !== name ||
            activeDeviceAccordionSection !== "edit-node"))
      ) {
        return;
      }
      document.getElementById("editNodeName").value = node.name;
      document.getElementById("editNodeIp").value = node.ip;
      document.getElementById("editNodeModel").value = node.model;
      document.getElementById("editNodeProtocol").value =
        node.protocol || "ssh";
      document.getElementById("editNodePort").value = node.port || "32410";
      document.getElementById("editNodeUsername").value = node.username || "";
      document.getElementById("editNodePassword").value = node.password || "";
      document.getElementById("editNodeGroup").value = node.group_id || "";
      revealModalInActionPanel("editModal", name, "Edit Node");
    })
    .catch((error) => {
      showInfoToast(
        error && error.message
          ? `Unable to open Edit Node: ${error.message}`
          : "Unable to open Edit Node",
        true,
      );
    });
}

function readApiResponse(response) {
  return response
    .json()
    .catch(() => ({}))
    .then((data) => {
      if (!response.ok || data.success === false) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      return data;
    });
}

function closeEditModal() {
  document.getElementById("editModal").classList.remove("show");
  resetActionPanelIfShowing("editModal");
}

function updateNode(e) {
  e.preventDefault();
  const form = e.currentTarget || e.target;
  if (form && typeof form.reportValidity === "function" && !form.reportValidity()) {
    return;
  }
  const nodeName = document.getElementById("editNodeName").value;
  const groupId = document.getElementById("editNodeGroup").value;
  if (!groupId) {
    showInfoToast(
      "A device must be assigned to a group. Select a group (or add one).",
      true,
    );
    return;
  }
  const node = {
    name: nodeName,
    ip: document.getElementById("editNodeIp").value,
    model: document.getElementById("editNodeModel").value,
    protocol: document.getElementById("editNodeProtocol").value,
    port: parseInt(document.getElementById("editNodePort").value, 10),
    username: document.getElementById("editNodeUsername").value,
    password: document.getElementById("editNodePassword").value,
    group_id: groupId ? parseInt(groupId, 10) : null,
  };
  if (!Number.isInteger(node.port) || node.port < 1 || node.port > 65535) {
    showInfoToast("Port must be a number between 1 and 65535", true);
    return;
  }
  fetch(`/api/nodes/${encodeURIComponent(nodeName)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(node),
  })
    .then((r) => readApiResponse(r))
    .then((data) => {
      const savedNode = data.node || node;
      const group = (allGroups || []).find(
        (item) => String(item.id) === String(savedNode.group_id),
      );
      const localNode = Object.assign(
        {},
        (allNodes || []).find((item) => item.name === nodeName) || {},
        savedNode,
        { group_name: savedNode.group_name || (group && group.name) || "" },
      );
      const index = (allNodes || []).findIndex((item) => item.name === nodeName);
      if (index >= 0) allNodes[index] = localNode;
      else allNodes.push(localNode);
      renderDevices();
      if (deviceAccordionActive && currentPanelDevice === nodeName) {
        renderDevicePanelHeader(nodeName);
      }
      closeEditModal();
      showInfoToast(
        data.oxidized_reloaded === false
          ? "Device changes saved, but Oxidized could not be reloaded."
          : "Perubahan perangkat berhasil disimpan",
        data.oxidized_reloaded === false,
      );
      refreshNodes();
      logActivityEvent(nodeName, "Node Updated Successfully");
    })
    .catch((error) => {
      showInfoToast(
        error && error.message
          ? `Gagal menyimpan perubahan perangkat: ${error.message}`
          : "Gagal menyimpan perubahan perangkat",
        true,
      );
    });
}

function addNode(e) {
  e.preventDefault();
  const form = e.target;
  const creatingGroup = isCreatingNewGroup();
  const creatingCred = isCreatingNewCredential();
  let groupId = document.getElementById("nodeGroup").value;
  let newCred = null;

  // A group must exist before the device is saved, so it is created first when
  // the user chose "＋ Create new group…". Same for a new credential.
  let chain = Promise.resolve();
  if (creatingGroup) {
    chain = chain
      .then(() => createGroupInline())
      .then((id) => {
        groupId = id != null ? String(id) : "";
      });
  }
  if (creatingCred) {
    chain = chain
      .then(() => createCredentialInline())
      .then((c) => {
        newCred = c;
      });
  }

  chain
    .then(() => {
      if (!groupId) {
        showInfoToast(
          "A device must be assigned to a group. Select a group or create a new one.",
          true,
        );
        return;
      }
      const node = {
        name: document.getElementById("nodeName").value,
        ip: document.getElementById("nodeIp").value,
        model: document.getElementById("nodeModel").value,
        protocol: document.getElementById("nodeProtocol").value,
        port: document.getElementById("nodePort").value,
        username: newCred
          ? newCred.username
          : document.getElementById("nodeUsername").value,
        password: newCred
          ? newCred.password
          : document.getElementById("nodePassword").value,
        group_id: parseInt(groupId),
      };
      return fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(node),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            showInfoToast(`Device Added (${node.name})`);
            form.reset();
            closeInlineGroupForm(true);
            closeInlineCredForm(true);
            if (creatingGroup) loadGroups();
            if (creatingCred) loadCredentials();
            loadGroupsToSelect("nodeGroup");
            loadCredentialsToSelect("nodeCredential");
            refreshNodes();
          } else {
            showInfoToast(data.error || "Failed to add device", true);
          }
        });
    })
    .catch((err) => {
      showInfoToast(
        err && err.message ? err.message : "Failed to save device",
        true,
      );
    });
}

function deleteNode(name) {
  // Blocking confirmation popup (same bottom-toast style as Restart, but with a
  // backdrop): the user must pick Delete or Cancel before doing anything else.
  confirmAction(
    `Delete this device (${name})? This cannot be undone.`,
    () => performNodeDelete(name),
    { danger: true, confirmLabel: "Delete", blocking: true },
  );
}

function performNodeDelete(name) {
  fetch(`/api/nodes/${name}`, { method: "DELETE" })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        showInfoToast(`Device deleted (${name})`);
        refreshNodes();
        if (currentPanelDevice === name) currentPanelDevice = null;
        renderActionPanelPlaceholder();
      }
    });
}

function importNodes(e) {
  e.preventDefault();
  const csv = document.getElementById("csvContent").value;
  fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csv: csv }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        showInfoToast("Successfully imported " + data.count + " nodes");
        document.getElementById("csvContent").value = "";
        refreshNodes();
      }
    });
}

// ============ Users ============
// "2026-11-04 08:12:37" -> "Wed, 04 Nov 2026": weekday, day, month, year
// only — the users table Created column never shows clock time.
function formatCreatedDate(value) {
  if (!value) return "-";
  const d = new Date(String(value).replace(" ", "T"));
  if (isNaN(d.getTime())) return value;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dd = String(d.getDate()).padStart(2, "0");
  return `${days[d.getDay()]}, ${dd} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function loadUsers() {
  fetch("/api/users")
    .then((r) => r.json())
    .then((users) => {
      const tbody = document.getElementById("usersList");
      if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3">${"-"}</td></tr>`;
        return;
      }
      tbody.innerHTML = users
        .map(
          (user) => `
            <tr>
                <td>${escapeHtml(user.username)}</td>
                <td>${formatCreatedDate(user.created_at)}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn" style="padding:5px 10px;font-size:12px;" onclick="openUserChangePasswordForm('${user.username}')">${"Change Password"}</button>
                        <button class="btn btn-danger" style="padding:5px 10px;font-size:12px;" onclick="deleteUser('${user.username}')">${"Delete"}</button>
                    </div>
                </td>
            </tr>
        `,
        )
        .join("");
    });
}

// Add User is an inline form under the users table (no modal/blur, no
// right panel) — opening just reveals it, closing also clears the fields.
function openAddUserForm() {
  document.getElementById("addUserForm").classList.add("show");
  const u = document.getElementById("addUserUsername");
  if (u) u.focus();
}

function closeAddUserForm() {
  document.getElementById("addUserForm").classList.remove("show");
  document.getElementById("addUserUsername").value = "";
  document.getElementById("addUserPassword").value = "";
}

function handleAddUser(e) {
  e.preventDefault();
  const username = document.getElementById("addUserUsername").value;
  const password = document.getElementById("addUserPassword").value;

  if (password.length < 6) {
    showInfoToast("Password must be at least 6 characters", true);
    return;
  }

  fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        // Popup notification that names the added user (Users tab convention).
        showInfoToast(`User added successfully (${username})`);
        closeAddUserForm();
        loadUsers();
      } else {
        showInfoToast(data.error || "Failed to add user", true);
      }
    });
}

function deleteUser(username) {
  // Blocking confirm popup that names the user, then a success popup.
  confirmAction(
    `Delete this user (${username})? This cannot be undone.`,
    () => {
      fetch(`/api/users/${encodeURIComponent(username)}`, { method: "DELETE" })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            closeUserChangePasswordForm();
            showInfoToast(`User deleted (${username})`);
            loadUsers();
          } else {
            showInfoToast(data.error || "Failed to delete user", true);
          }
        });
    },
    { danger: true, confirmLabel: "Delete", blocking: true },
  );
}

// Change Password opens as an inline form directly UNDER the clicked user's
// row (no modal/blur): Username | New Password | Confirm Password across one
// row, then Save | Cancel. Only one form row is open at a time.
let userCpFormRow = null;

function closeUserChangePasswordForm() {
  if (userCpFormRow) {
    userCpFormRow.remove();
    userCpFormRow = null;
  }
}

function openUserChangePasswordForm(username) {
  closeUserChangePasswordForm();
  let target = null;
  document.querySelectorAll("#usersList tr").forEach((r) => {
    if (r.cells.length && r.cells[0].textContent.trim() === username) {
      target = r;
    }
  });
  if (!target) return;
  const tr = document.createElement("tr");
  tr.className = "user-cp-form-row";
  tr.innerHTML = `
    <td colspan="3">
      <div class="inline-subform show">
        <div id="userChangePasswordAlert" class="alert"></div>
        <form onsubmit="handleUserChangePassword(event)">
          <div class="user-cp-grid">
            <div class="form-group">
              <label>Username</label>
              <input type="text" id="userChangePasswordUsername" value="${escapeHtml(username)}" readonly class="bg-muted" />
            </div>
            <div class="form-group">
              <label>New Password</label>
              <div class="password-input-group">
                <input type="password" id="userChangePasswordNew" required autocomplete="off" />
                <button type="button" class="password-toggle" onclick="togglePasswordVisibility('userChangePasswordNew')">${PASSWORD_EYE_OPEN}</button>
              </div>
            </div>
            <div class="form-group">
              <label>Confirm New Password</label>
              <div class="password-input-group">
                <input type="password" id="userChangePasswordConfirm" required autocomplete="off" />
                <button type="button" class="password-toggle" onclick="togglePasswordVisibility('userChangePasswordConfirm')">${PASSWORD_EYE_OPEN}</button>
              </div>
            </div>
          </div>
          <div class="flex-gap10 mt-10">
            <button type="submit" class="btn btn-success">Save</button>
            <button type="button" class="btn" onclick="closeUserChangePasswordForm()">Cancel</button>
          </div>
        </form>
      </div>
    </td>`;
  target.after(tr);
  userCpFormRow = tr;
  const np = document.getElementById("userChangePasswordNew");
  if (np) np.focus();
}

function handleUserChangePassword(e) {
  e.preventDefault();
  const username = document.getElementById("userChangePasswordUsername").value;
  const newPass = document.getElementById("userChangePasswordNew").value;
  const confirm = document.getElementById("userChangePasswordConfirm").value;
  const alertDiv = document.getElementById("userChangePasswordAlert");

  if (newPass.length < 8) {
    alertDiv.className = "alert error";
    alertDiv.textContent = "Password must be at least 8 characters";
    alertDiv.style.display = "block";
    return;
  }

  if (newPass !== confirm) {
    alertDiv.className = "alert error";
    alertDiv.textContent = "Passwords do not match";
    alertDiv.style.display = "block";
    return;
  }

  fetch("/api/users-admin-change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // The API re-checks the confirmation server-side, so it must be sent
    // along (the old modal omitted it and every change silently failed).
    body: JSON.stringify({
      username: username,
      new_password: newPass,
      confirm_password: confirm,
    }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        // Popup that names the user whose password changed, then the inline
        // form row closes and the table reloads.
        closeUserChangePasswordForm();
        showInfoToast(`Password changed successfully (${username})`);
        loadUsers();
      } else {
        alertDiv.className = "alert error";
        alertDiv.textContent = data.error || "Failed to change password";
        alertDiv.style.display = "block";
      }
    });
}

// ============ Groups ============
let allGroups = [];

function loadGroups() {
  const nodesPromise =
    allNodes && allNodes.length
      ? Promise.resolve(allNodes)
      : fetch("/api/nodes").then((r) => r.json());

  Promise.all([fetch("/api/groups").then((r) => r.json()), nodesPromise])
    .then(([groupsData, nodes]) => {
      allGroups = groupsData.groups || [];
      if (!allNodes || !allNodes.length) allNodes = nodes;
      renderDevices();
    })
    .catch((err) => {
      console.error("Failed to load groups:", err);
      const container = document.getElementById("groups-sections");
      if (container)
        container.innerHTML = `<div class="group-section-empty">Failed to load groups</div>`;
    });
}

// (renderGroupsWithNodes was replaced by renderDevices() — the unified Devices view.)

function openAddGroupModal() {
  document.getElementById("group-modal-title").textContent = "Add Group";
  document.getElementById("grp-name-label").textContent = "Group Name";
  document.getElementById("grp-desc-label").textContent = "Description";
  document.getElementById("groupDescription").placeholder =
    "Optional description";
  document.getElementById("grp-save").textContent = "Save";
  document.getElementById("grp-cancel").textContent = "Cancel";
  document.getElementById("editGroupId").value = "";
  document.getElementById("groupName").value = "";
  document.getElementById("groupDescription").value = "";
  // Show in the Right Panel (like device edit), not a centered, blurred modal.
  revealModalInActionPanel("groupModal", "", "Add Group");
}

function openEditGroupModal(id, name, description) {
  document.getElementById("group-modal-title").textContent =
    "Edit Group";
  document.getElementById("grp-name-label").textContent = "Group Name";
  document.getElementById("grp-desc-label").textContent = "Description";
  document.getElementById("groupDescription").placeholder =
    "Optional description";
  document.getElementById("grp-save").textContent = "Save";
  document.getElementById("grp-cancel").textContent = "Cancel";
  document.getElementById("editGroupId").value = id;
  document.getElementById("groupName").value = name;
  document.getElementById("groupDescription").value = description || "";
  // Edit appears in the Right Panel and names the group in the panel title.
  revealModalInActionPanel("groupModal", name, "Edit Group");
}

function closeGroupModal() {
  document.getElementById("groupModal").classList.remove("show");
  resetActionPanelIfShowing("groupModal");
}

function saveGroup(e) {
  e.preventDefault();
  const id = document.getElementById("editGroupId").value;
  const name = document.getElementById("groupName").value.trim();
  const description = document.getElementById("groupDescription").value.trim();

  if (!name) {
    showInfoToast("Group name is required", true);
    return;
  }

  const payload = { name, description };
  const method = id ? "PUT" : "POST";
  const url = id ? `/api/groups/${id}` : "/api/groups";

  fetch(url, {
    method: method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success || data.id) {
        showInfoToast(id ? `Group Updated (${name})` : `Group Created (${name})`);
        closeGroupModal();
        loadGroups();
        if (id) {
          loadGroupsToSelect("nodeGroup");
        } else {
          // Created from the Add Device form: select the new group right away.
          const newId = data.group && data.group.id ? data.group.id : null;
          loadGroupsToSelect("nodeGroup", newId);
        }
        loadGroupsToSelect("editNodeGroup");
      } else {
        showInfoToast(data.error || "Failed to save group", true);
      }
    });
}

function deleteGroup(id) {
  // The popup names the group so it's obvious which one is being removed.
  const g = (allGroups || []).find((grp) => String(grp.id) === String(id));
  const gName = g ? g.name : id;
  confirmAction(
    `Delete this group (${gName})? Please move its devices to another group first.`,
    () => {
      fetch(`/api/groups/${id}`, { method: "DELETE" })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            showInfoToast(`Group deleted (${gName})`);
            loadGroups();
            loadGroupsToSelect("nodeGroup");
            loadGroupsToSelect("editNodeGroup");
          } else {
            showInfoToast(data.error || "Failed to delete group", true);
          }
        });
    },
    { danger: true, confirmLabel: "Delete", blocking: true },
  );
}

// ============ Models ============
function loadModels() {
  fetch("/api/models")
    .then((r) => r.json())
    .then((models) => {
      // Keep the Models table ordered A-Z by model name (then id) instead of
      // the backend dictionary order.
      models.sort(
        (a, b) =>
          (a.name || "").localeCompare(b.name || "") ||
          (a.id || "").localeCompare(b.id || ""),
      );
      allModels = models;
      const tbody = document.getElementById("modelsList");
      if (tbody) {
        tbody.innerHTML = models
          .map(
            (m) => `
              <tr>
                  <td><input type="checkbox" id="model-${m.id}" value="${m.id}" ${m.enabled ? "checked" : ""}></td>
                  <td>${escapeHtml((m.name || "").split(" ")[0])}</td>
                  <td>${escapeHtml(m.name)}</td>
                  <td><strong>${escapeHtml(m.id)}</strong></td>
              </tr>
          `,
          )
          .join("");
      }
      // Models may finish loading after the Nodes/Groups tables already rendered
      // with raw model IDs — refresh them now that names are available.
      renderDevices();
    });
}

function saveModels() {
  const enabled = [];
  allModels.forEach((m) => {
    const checkbox = document.getElementById("model-" + m.id);
    if (checkbox && checkbox.checked) {
      enabled.push(m.id);
    }
  });
  fetch("/api/models", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ models: enabled }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        showInfoToast(`Device models saved (${enabled.length} enabled)`);
      } else {
        showInfoToast(data.error || "Failed to save models", true);
      }
    });
}

function filterModels() {
  const searchText = document.getElementById("modelSearch").value.toLowerCase();
  const filteredModels = allModels.filter(
    (m) =>
      m.id.toLowerCase().includes(searchText) ||
      m.name.toLowerCase().includes(searchText),
  );
  const tbody = document.getElementById("modelsList");
  tbody.innerHTML = filteredModels
    .map(
      (m) => `
        <tr>
            <td><input type="checkbox" id="model-${m.id}" value="${m.id}" ${m.enabled ? "checked" : ""}></td>
            <td>${escapeHtml((m.name || "").split(" ")[0])}</td>
            <td>${escapeHtml(m.name)}</td>
            <td><strong>${escapeHtml(m.id)}</strong></td>
        </tr>
    `,
    )
    .join("");
}

function selectAllModels() {
  allModels.forEach((m) => {
    const checkbox = document.getElementById("model-" + m.id);
    if (checkbox) checkbox.checked = true;
  });
}

function deselectAllModels() {
  allModels.forEach((m) => {
    const checkbox = document.getElementById("model-" + m.id);
    if (checkbox) checkbox.checked = false;
  });
}

// ============ Credentials ============
function loadCredentials() {
  fetch("/api/credentials")
    .then((r) => r.json())
    .then((creds) => {
      allCredentials = creds;
      renderCredentialsList(creds);
    });
}

function renderCredentialsList(creds) {
  const tbody = document.getElementById("credentialsList");
  tbody.innerHTML = creds
    .map(
      (c) => `
        <tr>
            <td><input type="checkbox" class="cred-enable-toggle" id="cred-${c.id}" value="${c.id}" ${c.enabled === false ? "" : "checked"}></td>
            <td>${escapeHtml(c.label)}</td>
            <td>${escapeHtml(c.username)}</td>
            <td>${escapeHtml(c.description || "")}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-xs" onclick="openEditCredentialModal('${c.id}')">${"Edit"}</button>
                    <button class="btn btn-danger btn-xs" onclick="deleteCredential('${c.id}')">${"Delete"}</button>
                </div>
            </td>
        </tr>
    `,
    )
    .join("");
}

function saveCredentials() {
  // Persist which credentials are enabled. Only touch the visible rows' states;
  // rows hidden by the current search keep their stored value.
  const visible = {};
  document
    .querySelectorAll(".cred-enable-toggle")
    .forEach((cb) => {
      visible[cb.value] = cb.checked;
    });
  const enabled = allCredentials
    .filter((c) => (c.id in visible ? visible[c.id] : c.enabled !== false))
    .map((c) => c.id);
  fetch("/api/credentials-enabled", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        showInfoToast("Credential states saved");
        loadCredentials();
        // Disabled credentials should disappear from the Add Device dropdown.
        loadCredentialsToSelect("nodeCredential");
      } else {
        showInfoToast(data.error || "Failed to save credential states", true);
      }
    });
}

function filterCredentials() {
  const searchText = document.getElementById("credSearch").value.toLowerCase();
  const filtered = allCredentials.filter(
    (c) =>
      c.label.toLowerCase().includes(searchText) ||
      c.username.toLowerCase().includes(searchText) ||
      (c.description && c.description.toLowerCase().includes(searchText)),
  );
  renderCredentialsList(filtered);
}

function openAddCredentialModal() {
  document.getElementById("addCredId").value = "";
  document.getElementById("addCredLabel").value = "";
  document.getElementById("addCredUsername").value = "";
  document.getElementById("addCredPassword").value = "";
  document.getElementById("addCredEnablePassword").value = "";
  document.getElementById("addCredDescription").value = "";
  document.getElementById("addCredentialModal").classList.add("show");
}

function closeAddCredentialModal() {
  document.getElementById("addCredentialModal").classList.remove("show");
}

function handleAddCredential(e) {
  e.preventDefault();
  const cred = {
    id: document.getElementById("addCredId").value || "",
    label: document.getElementById("addCredLabel").value,
    username: document.getElementById("addCredUsername").value,
    password: document.getElementById("addCredPassword").value,
    enable_password: document.getElementById("addCredEnablePassword").value,
    description: document.getElementById("addCredDescription").value,
  };
  fetch("/api/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cred),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        showInfoToast(`Credential added (${cred.label || cred.username})`);
        closeAddCredentialModal();
        loadCredentials();
      } else {
        showInfoToast(data.error || "Failed to add credential", true);
      }
    });
}

function openEditCredentialModal(id) {
  const cred = allCredentials.find((c) => c.id == id);
  if (!cred) return;
  document.getElementById("editCredId").value = cred.id;
  document.getElementById("editCredLabel").value = cred.label;
  document.getElementById("editCredUsername").value = cred.username || "";
  document.getElementById("editCredPassword").value = cred.password || "";
  document.getElementById("editCredEnablePassword").value =
    cred.enable_password || "";
  document.getElementById("editCredDescription").value = cred.description || "";
  document.getElementById("editCredentialModal").classList.add("show");
}

function closeEditCredentialModal() {
  document.getElementById("editCredentialModal").classList.remove("show");
}

function handleUpdateCredential(e) {
  e.preventDefault();
  const cred_id = document.getElementById("editCredId").value;
  const cred = {
    label: document.getElementById("editCredLabel").value,
    username: document.getElementById("editCredUsername").value,
    password: document.getElementById("editCredPassword").value,
    enable_password: document.getElementById("editCredEnablePassword").value,
    description: document.getElementById("editCredDescription").value,
  };
  fetch(`/api/credentials/${cred_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cred),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        showInfoToast(`Credential updated (${cred.label || cred.username})`);
        closeEditCredentialModal();
        loadCredentials();
      } else {
        showInfoToast(data.error || "Failed to update credential", true);
      }
    });
}

function deleteCredential(id) {
  const existing = allCredentials.find((c) => c.id == id);
  const label = existing ? existing.label || existing.username || id : id;
  confirmAction(
    `Delete this credential (${label})? This cannot be undone.`,
    () => {
      fetch(`/api/credentials/${id}`, { method: "DELETE" })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            showInfoToast(`Credential deleted (${label})`);
            loadCredentials();
          } else {
            showInfoToast(data.error || "Failed to delete credential", true);
          }
        });
    },
    { danger: true, confirmLabel: "Delete", blocking: true },
  );
}

function loadCredentialsToSelect(selectId, selectCredId, onDone) {
  fetch("/api/credentials")
    .then((r) => r.json())
    .then((creds) => {
      allCredentials = creds;
      const select = document.getElementById(selectId);
      if (!select) return;
      const currentValue = select.value;
      select.innerHTML = '<option value="">Select credential</option>';
      creds.forEach((c) => {
        // Disabled credentials are not selectable in the dropdown.
        if (c.enabled === false) return;
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.label} (${c.username})`;
        select.appendChild(opt);
      });
      // Admins can create a credential inline from the Add Device form.
      if (selectId === "nodeCredential" && window.currentUserRole === "admin") {
        const co = document.createElement("option");
        co.value = "__new__";
        co.textContent = "＋ Create new credential…";
        select.appendChild(co);
      }
      if (selectCredId) select.value = selectCredId;
      else if (currentValue && currentValue !== "__new__")
        select.value = currentValue;
      if (onDone) onDone();
    });
}

function loadGroupsToSelect(selectId, selectGroupId) {
  fetch("/api/groups")
    .then((r) => r.json())
    .then((data) => {
      const select = document.getElementById(selectId);
      if (!select) return;
      const currentValue = select.value;
      select.innerHTML = '<option value="">Select a group…</option>';
      data.groups.forEach((g) => {
        const opt = document.createElement("option");
        opt.value = g.id;
        opt.textContent = g.name;
        select.appendChild(opt);
      });
      // Admins can create a group inline from the Add Device form.
      if (selectId === "nodeGroup" && window.currentUserRole === "admin") {
        const co = document.createElement("option");
        co.value = "__new__";
        co.textContent = "＋ Create new group…";
        select.appendChild(co);
      }
      if (selectGroupId) select.value = selectGroupId;
      else if (currentValue && currentValue !== "__new__")
        select.value = currentValue;
    });
}

// ============ Add Device: inline group / credential creation ============
// The Group / Credential dropdowns in the Add Device form end with a
// "＋ Create new …" option. Choosing it reveals a compact inline sub-form under
// the field (admin only). There is no separate "Add" button: the new group /
// credential is created automatically as part of clicking "Add Device".
function openInlineGroupForm() {
  const f = document.getElementById("inlineGroupForm");
  if (!f) return;
  f.classList.add("show");
  const n = document.getElementById("inlineGroupName");
  if (n) n.focus();
}

function closeInlineGroupForm(clear) {
  const f = document.getElementById("inlineGroupForm");
  if (!f) return;
  f.classList.remove("show");
  if (clear) {
    const n = document.getElementById("inlineGroupName");
    const d = document.getElementById("inlineGroupDesc");
    if (n) n.value = "";
    if (d) d.value = "";
  }
}

function onNodeGroupChange() {
  const sel = document.getElementById("nodeGroup");
  if (!sel) return;
  if (sel.value === "__new__") {
    openInlineGroupForm();
    sel.value = "";
  } else {
    closeInlineGroupForm(true);
  }
}

// True when the inline group sub-form is open and has a name typed.
function isCreatingNewGroup() {
  const f = document.getElementById("inlineGroupForm");
  const n = document.getElementById("inlineGroupName");
  return !!(f && f.classList.contains("show") && n && n.value.trim() !== "");
}

// Creates a group and resolves with its new id (used by addNode).
function createGroupInline() {
  const name = document.getElementById("inlineGroupName").value.trim();
  const description = document.getElementById("inlineGroupDesc").value.trim();
  return fetch("/api/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (!data.success) throw new Error(data.error || "Failed to create group");
      return data.group && data.group.id ? data.group.id : null;
    });
}

function openInlineCredForm() {
  const f = document.getElementById("inlineCredForm");
  if (!f) return;
  f.classList.add("show");
  const l = document.getElementById("inlineCredLabel");
  if (l) l.focus();
}

function closeInlineCredForm(clear) {
  const f = document.getElementById("inlineCredForm");
  if (!f) return;
  f.classList.remove("show");
  if (clear) {
    [
      "inlineCredLabel",
      "inlineCredUsername",
      "inlineCredPassword",
      "inlineCredEnablePassword",
      "inlineCredDesc",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  }
}

// True when the inline credential sub-form is open and has a label typed.
function isCreatingNewCredential() {
  const f = document.getElementById("inlineCredForm");
  const l = document.getElementById("inlineCredLabel");
  return !!(f && f.classList.contains("show") && l && l.value.trim() !== "");
}

// Creates a credential and resolves with { id, username, password } (addNode).
function createCredentialInline() {
  const label = document.getElementById("inlineCredLabel").value.trim();
  const username = document.getElementById("inlineCredUsername").value;
  const password = document.getElementById("inlineCredPassword").value;
  const enable_password = document.getElementById("inlineCredEnablePassword").value;
  const description = document.getElementById("inlineCredDesc").value;
  return fetch("/api/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "",
      label,
      username,
      password,
      enable_password,
      description,
      enabled: true,
    }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (!data.success)
        throw new Error(data.error || "Failed to create credential");
      return { id: data.id, username, password };
    });
}

function loadModelsToSelect(selectId) {
  fetch("/api/models")
    .then((r) => r.json())
    .then((models) => {
      const select = document.getElementById(selectId);
      if (!select) return;
      const currentValue = select.value;
      select.innerHTML = '<option value="">Select device model</option>';
      models
        .filter((m) => m.enabled)
        .forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m.id;
          opt.textContent = formatModelDisplay(m.name);
          select.appendChild(opt);
        });
      if (currentValue) select.value = currentValue;
    });
}

// ============ Oxidized Info ============
// ============ Config Manager ============
function switchConfigTab(tabName) {
  // Sembunyikan semua content Config
  document.querySelectorAll(".config-tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  // Tampilkan content sesuai pilihan sidebar
  const content = document.getElementById("cfg-" + tabName);

  if (!content) {
    console.error("Config content tidak ditemukan:", "cfg-" + tabName);
    return;
  }

  content.classList.add("active");

  // Load data
  if (tabName === "groups") {
    loadGroups();
  } else if (tabName !== "versions") {
    loadConfig();
  }
}

function loadConfig() {
  fetch("/api/config")
    .then((r) => r.json())
    .then((data) => {
      // Basic settings
      document.getElementById("cfg-username").value =
        data.menu_settings.username || "";
      document.getElementById("cfg-password").value =
        data.menu_settings.password || "";
      document.getElementById("cfg-interval").value =
        data.menu_settings.interval || 7200;
      document.getElementById("cfg-threads").value =
        data.menu_settings.threads || 30;
      document.getElementById("cfg-timeout").value =
        data.menu_settings.timeout || 300;

      const basicStatus = document.getElementById("basic-status-content");
      if (basicStatus) {
        basicStatus.innerHTML = `
                <div><strong>Username:</strong> ${data.menu_settings.username || '<span style="color:#999;">not set</span>'}</div>
                <div><strong>Interval:</strong> ${data.menu_settings.interval || 7200}s | <strong>Threads:</strong> ${data.menu_settings.threads || 30} | <strong>Timeout:</strong> ${data.menu_settings.timeout || 300}s</div>
                <div><strong>Input:</strong> ${data.menu_settings.input_default || "ssh"}</div>
            `;
      }

      // SSH settings
      const sshKex = (data.menu_settings.ssh_kex || "")
        .split(",")
        .filter((v) => v.trim());
      const sshEnc = (data.menu_settings.ssh_encryption || "")
        .split(",")
        .filter((v) => v.trim());
      const sshHmac = (data.menu_settings.ssh_hmac || "")
        .split(",")
        .filter((v) => v.trim());
      document
        .querySelectorAll('input[name="ssh_kex"]')
        .forEach((cb) => (cb.checked = sshKex.includes(cb.value)));
      document
        .querySelectorAll('input[name="ssh_encryption"]')
        .forEach((cb) => (cb.checked = sshEnc.includes(cb.value)));
      document
        .querySelectorAll('input[name="ssh_hmac"]')
        .forEach((cb) => (cb.checked = sshHmac.includes(cb.value)));
      document.getElementById("cfg-ssh-secure").checked =
        data.menu_settings.ssh_secure || false;

      const statusDiv = document.getElementById("ssh-status-content");
      if (statusDiv) {
        if (
          sshKex.length === 0 &&
          sshEnc.length === 0 &&
          sshHmac.length === 0
        ) {
          statusDiv.innerHTML =
            '<span style="color:#999;">No SSH algorithms configured</span>';
        } else {
          statusDiv.innerHTML = `
                    <div><strong>KEX:</strong> ${sshKex.length > 0 ? sshKex.join(", ") : '<span style="color:#999;">none</span>'}</div>
                    <div><strong>Encryption:</strong> ${sshEnc.length > 0 ? sshEnc.join(", ") : '<span style="color:#999;">none</span>'}</div>
                    <div><strong>HMAC:</strong> ${sshHmac.length > 0 ? sshHmac.join(", ") : '<span style="color:#999;">none</span>'}</div>
                `;
        }
      }

      // Output settings
      document.getElementById("cfg-output-default").value =
        data.menu_settings.output_default || "git";
      document.getElementById("cfg-git-user").value =
        data.menu_settings.git_user || "Oxidized";
      document.getElementById("cfg-git-email").value =
        data.menu_settings.git_email || "oxidized@example.com";

      const outputStatus = document.getElementById("output-status-content");
      if (outputStatus) {
        outputStatus.innerHTML = `
                <div><strong>Output:</strong> ${data.menu_settings.output_default || "git"} | <strong>Git User:</strong> ${data.menu_settings.git_user || "Oxidized"}</div>
                <div><strong>Git Email:</strong> ${data.menu_settings.git_email || "oxidized@example.com"}</div>
            `;
      }

      // Vars settings
      document.getElementById("cfg-vars-remove-secret").checked =
        data.menu_settings.vars_remove_secret || false;
      document.getElementById("cfg-vars-ssh-no-keepalive").checked =
        data.menu_settings.vars_ssh_no_keepalive || false;
      document.getElementById("cfg-vars-ssh-no-exec").checked =
        data.menu_settings.vars_ssh_no_exec || false;
      document.getElementById("cfg-vars-metadata").checked =
        data.menu_settings.vars_metadata || false;
      document.getElementById("cfg-vars-enable").value =
        data.menu_settings.vars_enable || "";

      const varsStatus = document.getElementById("vars-status-content");
      if (varsStatus) {
        const varsList = [];
        if (data.menu_settings.vars_remove_secret)
          varsList.push("remove_secret");
        if (data.menu_settings.vars_ssh_no_keepalive)
          varsList.push("ssh_no_keepalive");
        if (data.menu_settings.vars_ssh_no_exec) varsList.push("ssh_no_exec");
        if (data.menu_settings.vars_metadata) varsList.push("metadata");
        const sshKexVar = data.menu_settings.vars_ssh_kex;
        const sshEncVar = data.menu_settings.vars_ssh_encryption;
        varsStatus.innerHTML = `
                <div><strong>Enabled flags:</strong> ${varsList.length > 0 ? varsList.join(", ") : '<span style="color:#999;">none</span>'}</div>
                <div><strong>Vars SSH KEX:</strong> ${sshKexVar || '<span style="color:#999;">default</span>'} | <strong>Encryption:</strong> ${sshEncVar || '<span style="color:#999;">default</span>'}</div>
            `;
      }

      // YAML editor
      document.getElementById("cfg-yaml-editor").value =
        data.yaml_content || "";
    })
    .catch((err) => {
      console.error("Failed to load config:", err);
      showInfoToast("Failed to load config: " + err, true);
    });
}

function saveConfigBasic(e) {
  e.preventDefault();
  const settings = {
    username: document.getElementById("cfg-username").value,
    password: document.getElementById("cfg-password").value,
    interval: parseInt(document.getElementById("cfg-interval").value) || 7200,
    threads: parseInt(document.getElementById("cfg-threads").value) || 30,
    timeout: parseInt(document.getElementById("cfg-timeout").value) || 300,
  };
  fetch("/api/config/menu", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      settings: settings,
      commit_message: "Update basic settings",
    }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        showInfoToast("Basic settings saved successfully");
      } else {
        showInfoToast(
          "Failed to save: " + (data.error || "Unknown error"),
          true,
        );
      }
    });
}

function toggleAll(name, checked) {
  document
    .querySelectorAll('input[name="' + name + '"]')
    .forEach((cb) => (cb.checked = checked));
}

function saveConfigSSH(e) {
  e.preventDefault();
  const sshKex = Array.from(
    document.querySelectorAll('input[name="ssh_kex"]:checked'),
  )
    .map((cb) => cb.value)
    .join(",");
  const sshEnc = Array.from(
    document.querySelectorAll('input[name="ssh_encryption"]:checked'),
  )
    .map((cb) => cb.value)
    .join(",");
  const sshHmac = Array.from(
    document.querySelectorAll('input[name="ssh_hmac"]:checked'),
  )
    .map((cb) => cb.value)
    .join(",");
  const settings = {
    ssh_kex: sshKex,
    ssh_encryption: sshEnc,
    ssh_hmac: sshHmac,
    ssh_secure: document.getElementById("cfg-ssh-secure").checked,
  };
  fetch("/api/config/menu", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      settings: settings,
      commit_message: "Update SSH settings",
    }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        showInfoToast("SSH settings saved successfully");
      } else {
        showInfoToast(
          "Failed to save: " + (data.error || "Unknown error"),
          true,
        );
      }
    });
}

function saveConfigOutput(e) {
  e.preventDefault();
  const settings = {
    output_default: document.getElementById("cfg-output-default").value,
    git_user: document.getElementById("cfg-git-user").value,
    git_email: document.getElementById("cfg-git-email").value,
  };
  fetch("/api/config/menu", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      settings: settings,
      commit_message: "Update output settings",
    }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        showInfoToast("Output settings saved successfully");
      } else {
        showInfoToast(
          "Failed to save: " + (data.error || "Unknown error"),
          true,
        );
      }
    });
}

function saveConfigVars(e) {
  e.preventDefault();
  const settings = {
    vars_remove_secret: document.getElementById("cfg-vars-remove-secret")
      .checked,
    vars_ssh_no_keepalive: document.getElementById("cfg-vars-ssh-no-keepalive")
      .checked,
    vars_ssh_no_exec: document.getElementById("cfg-vars-ssh-no-exec").checked,
    vars_metadata: document.getElementById("cfg-vars-metadata").checked,
    vars_enable: document.getElementById("cfg-vars-enable").value,
  };
  fetch("/api/config/menu", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      settings: settings,
      commit_message: "Update vars settings",
    }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        showInfoToast("Vars settings saved successfully");
      } else {
        showInfoToast(
          "Failed to save: " + (data.error || "Unknown error"),
          true,
        );
      }
    });
}

function formatYaml() {
  try {
    const editor = document.getElementById("cfg-yaml-editor");
    const yaml = jsyaml.load(editor.value);
    editor.value = jsyaml.dump(yaml, { indent: 2, lineWidth: -1 });
  } catch (e) {
    showInfoToast("YAML format error: " + e.message, true);
  }
}

function validateYamlConfig() {
  const yaml = document.getElementById("cfg-yaml-editor").value;
  fetch("/api/config/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yaml_content: yaml }),
  })
    .then((r) => r.json())
    .then((data) => {
      const status = document.getElementById("yaml-validate-status");
      // SVG icons instead of emoji, matching the Config tab button icons.
      if (data.valid) {
        status.innerHTML =
          '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>Valid YAML</span>';
        status.style.color = "var(--success-fg)";
      } else {
        status.innerHTML =
          '<svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><span>Invalid: ' +
          escapeHtml((data.errors || []).join(", ")) +
          "</span>";
        status.style.color = "var(--danger-fg)";
      }
    });
}

function saveYamlConfig() {
  const yaml = document.getElementById("cfg-yaml-editor").value;
  const commit =
    document.getElementById("cfg-yaml-commit").value || "Update YAML config";
  fetch("/api/config/yaml", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yaml_content: yaml, commit_message: commit }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        showInfoToast("YAML config saved successfully");
        loadConfigVersions();
      } else {
        showInfoToast(
          "Failed to save: " + (data.errors || data.error || "Unknown error"),
          true,
        );
      }
    });
}

function loadConfigVersions() {
  fetch("/api/config/versions")
    .then((r) => r.json())
    .then((data) => {
      const tbody = document.getElementById("config-versions-list");
      const diffFrom = document.getElementById("diff-from");
      const diffTo = document.getElementById("diff-to");

      if (data.versions && data.versions.length > 0) {
        const versionOptions = data.versions
          .map(
            (v) =>
              `<option value="${v.version}">v${v.version} - ${v.commit_message || "No message"} (${v.created_at})</option>`,
          )
          .join("");

        tbody.innerHTML = data.versions
          .map(
            (v) => `
                <tr>
                    <td>v${v.version}</td>
                    <td>${v.created_at}</td>
                    <td>${v.commit_message || ""}</td>
                    <td>
                        <button class="btn btn-sm" onclick="rollbackConfig(${v.version})"><svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg><span>Rollback</span></button>
                    </td>
                </tr>
            `,
          )
          .join("");

        if (diffFrom) diffFrom.innerHTML = versionOptions;
        if (diffTo) diffTo.innerHTML = versionOptions;

        if (diffFrom && diffTo && data.versions.length >= 2) {
          diffFrom.value = data.versions[0].version;
          diffTo.value = data.versions[1].version;
        }
      } else {
        tbody.innerHTML =
          '<tr><td colspan="4" style="text-align: center;">No versions found</td></tr>';
      }
    });
}

function rollbackConfig(version) {
  confirmAction(
    `Rollback config to v${version}? This creates a new version.`,
    () => {
      fetch("/api/config/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: version,
          commit_message: "Rollback to v" + version,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            showInfoToast(`Rolled back to v${version}`);
            loadConfig();
            loadConfigVersions();
          } else {
            showInfoToast(
              "Failed to rollback: " + (data.error || "Unknown error"),
              true,
            );
          }
        });
    },
    { danger: true, confirmLabel: "Rollback", blocking: true },
  );
}

function applyConfig() {
  fetch("/api/config/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restart: true }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        showInfoToast("Config applied and Oxidized restarted");
      } else {
        showInfoToast("Failed: " + (data.error || "Unknown error"), true);
      }
    });
}

function showSelectedDiff() {
  const fromVersion = document.getElementById("diff-from").value;
  const toVersion = document.getElementById("diff-to").value;

  if (!fromVersion || !toVersion) {
    showInfoToast("Select both versions to compare", true);
    return;
  }

  const diffContent = document.getElementById("config-diff-content");
  diffContent.innerHTML =
    '<div style="text-align: center; padding: 20px;">Loading diff...</div>';
  document.getElementById("config-diff-container").style.display = "block";

  fetch(`/api/config/diff?from=${fromVersion}&to=${toVersion}`)
    .then((r) => r.json())
    .then((data) => {
      if (data.error) {
        diffContent.innerHTML = `<div style="color: red; padding: 20px;">Error: ${data.error}</div>`;
        return;
      }

      const fromLines = data.diff.filter((d) => d.type !== "insert");
      const toLines = data.diff.filter((d) => d.type !== "delete");

      let html = `<div style="display: flex; font-family: monospace; font-size: 12px; border: 1px solid #ddd;">
            <div style="flex: 1; border-right: 1px solid #ddd; overflow-x: auto;">
                <div style="background: #f5f5f5; padding: 5px; font-weight: bold; position: sticky; top: 0;">
                    Version ${data.from.version} (${data.from.commit_message || "No message"})
                </div>
                <div style="padding: 5px;">`;
      fromLines.forEach((line) => {
        if (line.type === "delete") {
          html += `<div style="background: #ffe6e6; color: #c00; padding: 2px 5px;">- ${escapeHtml(line.content)}</div>`;
        } else if (line.type === "equal") {
          html += `<div style="padding: 2px 5px; color: #666;">  ${escapeHtml(line.content)}</div>`;
        }
      });
      html += `</div></div>`;

      html += `<div style="flex: 1; overflow-x: auto;">
                <div style="background: #f5f5f5; padding: 5px; font-weight: bold; position: sticky; top: 0;">
                    Version ${data.to.version} (${data.to.commit_message || "No message"})
                </div>
                <div style="padding: 5px;">`;
      toLines.forEach((line) => {
        if (line.type === "insert") {
          html += `<div style="background: #e6ffe6; color: #080; padding: 2px 5px;">+ ${escapeHtml(line.content)}</div>`;
        } else if (line.type === "equal") {
          html += `<div style="padding: 2px 5px; color: #666;">  ${escapeHtml(line.content)}</div>`;
        }
      });
      html += `</div></div></div>`;

      const added = data.diff.filter((d) => d.type === "insert").length;
      const removed = data.diff.filter((d) => d.type === "delete").length;
      html =
        `<div style="margin-bottom: 10px; font-size: 12px; color: #666;">
            <span style="color: #080;">+${added} added</span> |
            <span style="color: #c00;">-${removed} removed</span>
        </div>` + html;

      diffContent.innerHTML = html;
    })
    .catch((err) => {
      diffContent.innerHTML = `<div style="color: red; padding: 20px;">Failed to load diff: ${err.message}</div>`;
    });
}

// ============ Role-Based Visibility ============
function applyRoleBasedVisibility() {
  const isAdmin = window.currentUserRole === "admin";

  const usersTab = document.getElementById("tab-users");
  if (usersTab) usersTab.style.display = isAdmin ? "" : "none";

  const configTab = document.getElementById("tab-config");
  if (configTab) configTab.style.display = isAdmin ? "" : "none";

  const schedulerTab = document.getElementById("tab-scheduler");
  if (schedulerTab) schedulerTab.style.display = isAdmin ? "" : "none";

  const credTab = document.getElementById("tab-credentials");
  if (credTab) credTab.style.display = isAdmin ? "" : "none";

  // Groups page "+ Add Group" button (inline group/credential creation in the
  // Add Device form is gated via window.currentUserRole inside the loaders).
  const addGroupBtns = document.querySelectorAll(
    '[onclick="openAddGroupModal()"]',
  );
  addGroupBtns.forEach((btn) => {
    btn.style.display = isAdmin ? "" : "none";
  });

  const groupActionBtns = document.querySelectorAll(
    '[onclick^="openEditGroupModal"]',
  );
  groupActionBtns.forEach((btn) => {
    btn.style.display = isAdmin ? "" : "none";
  });

  const groupDeleteBtns = document.querySelectorAll('[onclick^="deleteGroup"]');
  groupDeleteBtns.forEach((btn) => {
    btn.style.display = isAdmin ? "" : "none";
  });

  const modelSaveBtn = document.querySelector('button[onclick="saveModels()"]');
  if (modelSaveBtn) modelSaveBtn.style.display = isAdmin ? "" : "none";

  const addCredBtn = document.querySelector(
    'button[onclick="openAddCredentialModal()"]',
  );
  if (addCredBtn) addCredBtn.style.display = isAdmin ? "" : "none";

  const deleteUserBtns = document.querySelectorAll('[onclick^="deleteUser"]');
  deleteUserBtns.forEach((btn) => {
    btn.style.display = isAdmin ? "" : "none";
  });
}

// ============ Scheduler: sidebar page becomes a pure data view ============
// - Configuring the global schedule and any device/group schedule now only
//   happens via the popups triggered from the device (Nodes tab) or group
//   (Groups tab) itself — never by navigating away to the Scheduler tab.
// - The Scheduler sidebar tab only *displays* the current schedules.
function setupSchedulerDataView() {
  // The global-schedule popup lives inside the #scheduler tab-content in the
  // markup; move it to <body> so it can still be opened (and is visible)
  // while the Nodes tab is active, since a hidden tab-content (display:none)
  // would otherwise hide the popup along with it.
  const globalModal = document.getElementById("globalScheduleModal");
  if (globalModal && globalModal.parentElement !== document.body) {
    document.body.appendChild(globalModal);
  }

  // Remove the only "configure" control from the Scheduler sidebar page —
  // it now only shows the current global schedule as read-only data.
  const configureBtn = document.getElementById(
    "scheduler-global-configure-btn",
  );
  if (configureBtn) configureBtn.style.display = "none";

  // Hide the Action column in the device/group schedules table on the
  // Scheduler page (also stripped from renderSchedulerOverrides()).
  const actionHeader = document.getElementById("th-sched-action");
  if (actionHeader) actionHeader.style.display = "none";

  // The Nodes tab's "Auto Backup" widget button used to jump to the
  // Scheduler tab; it now opens the Global Schedule popup right there
  // instead, so configuring it never leaves the device view.
  const openSchedulerBtn = document.querySelector(
    'button[title="Open Scheduler"]',
  );
  if (openSchedulerBtn) {
    openSchedulerBtn.removeAttribute("onclick");
    openSchedulerBtn.title = "Configure Global Schedule";
    openSchedulerBtn.onclick = function (e) {
      if (e) e.preventDefault();
      openGlobalSchedule();
    };
  }
}

// ============ Initialization ============
let configLoaded = false;
let schedulerLoaded = false;
const _originalSwitchTab = switchTab;
switchTab = function (tab, ev) {
  _originalSwitchTab(tab, ev);
  if (tab === "config" && !configLoaded) {
    loadConfig();
    loadConfigVersions();
    configLoaded = true;
  }
  if (tab === "scheduler") {
    loadSchedulerSettings();
    schedulerLoaded = true;
  }
};

fetch("/api/user-info")
  .then((r) => r.json())
  .then((data) => {
    document.getElementById("usernameBtn").textContent = data.username;
    window.currentUserRole = data.role || "user";
    applyRoleBasedVisibility();
  });

// Close any open modal when Escape is pressed
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal.show").forEach((modal) => {
      modal.classList.remove("show");
    });
  }
});

updateUI();
initPasswordToggleIcons();
markSidebarLeafItems();
restoreActiveTab();
loadModels();
setupSchedulerDataView();
loadSchedulerSettings();
loadGroups();
refreshOxidizedStatus(true); // silent on load; only the Refresh button pops a toast
loadActivityLog();
initializeIdleSessionTimeout();
setInterval(() => refreshOxidizedStatus(true), 60000);
// Refresh the persisted Activity Log from the server every minute so outcomes
// recorded by other sessions/browsers appear without a manual reload.
setInterval(loadActivityLog, 60000);
