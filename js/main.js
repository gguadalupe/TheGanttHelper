let state = loadState();

const projectNameInput = document.querySelector("#projectName");
const appShell = document.querySelector(".app-shell");
const projectBoard = document.querySelector(".project-board");
const boardResizer = document.querySelector("#boardResizer");
const tableWrap = document.querySelector(".table-wrap");
const timelinePane = document.querySelector(".timeline-pane");
const openColumnsBtn = document.querySelector("#openColumnsBtn");
const ganttZoomToggle = document.querySelector("#ganttZoomToggle");
const openDevopsOptionsBtn = document.querySelector("#openDevopsOptionsBtn");
const toggleChecksBtn = document.querySelector("#toggleChecksBtn");
const toggleAllGroupsBtn = document.querySelector("#toggleAllGroupsBtn");
const clearFiltersBtn = document.querySelector("#clearFiltersBtn");
const taskFilterRow = document.querySelector("#taskFilterRow");
const projectSummary = document.querySelector("#projectSummary");
const timelineSummary = document.querySelector("#timelineSummary");
const taskTableBody = document.querySelector("#taskTableBody");
const gantt = document.querySelector("#gantt");
const warningsList = document.querySelector("#warningsList");
const warningCount = document.querySelector("#warningCount");
const defaultCapacityInput = document.querySelector("#defaultCapacityInput");
const ownerCapacityList = document.querySelector("#ownerCapacityList");
const capacityHeatmap = document.querySelector("#capacityHeatmap");
const emptyStateTemplate = document.querySelector("#emptyStateTemplate");
const columnsDialog = document.querySelector("#columnsDialog");
const closeColumnsBtn = document.querySelector("#closeColumnsBtn");
const columnsList = document.querySelector("#columnsList");
const resetColumnsBtn = document.querySelector("#resetColumnsBtn");
const devopsDialog = document.querySelector("#devopsDialog");
const closeDevopsBtn = document.querySelector("#closeDevopsBtn");
const devopsOrgInput = document.querySelector("#devopsOrg");
const devopsProjectInput = document.querySelector("#devopsProject");
const devopsProjectStartInput = document.querySelector("#devopsProjectStart");
const devopsTokenInput = document.querySelector("#devopsToken");
const devopsWiqlInput = document.querySelector("#devopsWiql");
const syncDevopsBtn = document.querySelector("#syncDevopsBtn");
const syncSelectedDevopsBtn = document.querySelector("#syncSelectedDevopsBtn");
const syncAllDevopsBtn = document.querySelector("#syncAllDevopsBtn");
const clearDevopsInboxBtn = document.querySelector("#clearDevopsInboxBtn");
const devopsStatus = document.querySelector("#devopsStatus");
const devopsInboxSummary = document.querySelector("#devopsInboxSummary");
const devopsInboxList = document.querySelector("#devopsInboxList");
const devopsTypeFilter = document.querySelector("#devopsTypeFilter");
const devopsStatusFilter = document.querySelector("#devopsStatusFilter");
let checksVisible = localStorage.getItem(CHECKS_VISIBLE_KEY) === "true";
let currentZoom = loadGanttZoom();
let draggedTaskId = "";
let draggedGroupName = "";
let draggedGroupParentPath = "";
let boardResizeActive = false;
let ganttBarDrag = null;
let collapsedGroups = loadCollapsedGroups();
let columnSettings = loadColumnSettings();
let collapsedDevopsGroups = loadCollapsedDevopsGroups();
let taskFilters = loadTaskFilters();

// The expensive render scopes - gantt especially, which can build tens of thousands of
// day-cell elements for a large synced backlog. Everything else (view toggles, summary
// text, checks) is cheap enough to just always refresh.
const RENDER_SCOPES = ["table", "gantt", "warnings", "capacity"];
const RENDER_SCOPES_WITHOUT_GANTT = RENDER_SCOPES.filter((scope) => scope !== "gantt");

// Fields whose value never shows up anywhere in the Gantt (bar position/span/color/
// label, the axis range, or a bar's warning highlight) and can't move a task between
// groups either - editing them only needs table/warnings/capacity to refresh, so it's
// safe to skip rebuilding the Gantt's (potentially huge) day-cell grid.
const FIELDS_WITHOUT_GANTT_IMPACT = new Set(["owner", "effortLevel", "notes"]);

let pendingRenderScopes = null;
let renderFrameScheduled = false;

// Coalesces renders into one per animation frame, and lets a caller that knows exactly
// what it touched (see handleTaskTableFieldCommit) skip scopes that can't have changed,
// instead of rebuilding the whole UI on every single field edit.
function scheduleRender(scopes = RENDER_SCOPES) {
  if (!pendingRenderScopes) pendingRenderScopes = new Set();
  scopes.forEach((scope) => pendingRenderScopes.add(scope));
  if (renderFrameScheduled) return;
  renderFrameScheduled = true;
  requestAnimationFrame(() => {
    renderFrameScheduled = false;
    const scopes = pendingRenderScopes;
    pendingRenderScopes = null;
    render(scopes);
  });
}

function saveAndRender(scopes = RENDER_SCOPES) {
  saveState();
  scheduleRender(scopes);
}

function render(scopes = RENDER_SCOPES) {
  const scopeSet = scopes instanceof Set ? scopes : new Set(scopes);
  const analysis = analyzeTasks();
  projectNameInput.value = state.projectName;
  renderZoomToggle();
  renderChecksToggle(analysis);
  renderGroupsToggle();
  clearFiltersBtn.hidden = !isAnyTaskFilterActive(taskFilters);
  renderSummary(analysis);
  if (scopeSet.has("table")) renderTable(analysis);
  if (scopeSet.has("gantt")) renderGantt(analysis);
  if (scopeSet.has("warnings")) renderWarnings(analysis);
  if (scopeSet.has("capacity")) renderCapacity(analysis);
  syncPlannerHeights();
}

function renderZoomToggle() {
  ganttZoomToggle.querySelectorAll("[data-zoom]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.zoom === currentZoom));
  });
}

function applySavedBoardSplit() {
  const saved = Number.parseFloat(localStorage.getItem(BOARD_SPLIT_KEY));
  setBoardSplit(Number.isFinite(saved) ? saved : 44, false);
}

function resizeProjectBoard(clientX) {
  const rect = projectBoard.getBoundingClientRect();
  if (!rect.width) return;
  const percent = ((clientX - rect.left) / rect.width) * 100;
  setBoardSplit(percent);
}

function setBoardSplit(percent, persist = true) {
  const clamped = Math.min(70, Math.max(30, percent));
  projectBoard.style.setProperty("--task-pane-width", `${clamped}%`);
  boardResizer.setAttribute("aria-valuemin", "30");
  boardResizer.setAttribute("aria-valuemax", "70");
  boardResizer.setAttribute("aria-valuenow", String(Math.round(clamped)));
  if (persist) localStorage.setItem(BOARD_SPLIT_KEY, String(clamped));
}

function getCurrentBoardSplit() {
  const value = Number.parseFloat(projectBoard.style.getPropertyValue("--task-pane-width"));
  return Number.isFinite(value) ? value : 44;
}

function finishBoardResize(pointerId) {
  if (!boardResizeActive) return;
  boardResizeActive = false;
  if (boardResizer.hasPointerCapture(pointerId)) {
    boardResizer.releasePointerCapture(pointerId);
  }
  projectBoard.classList.remove("resizing");
  document.body.classList.remove("resizing-board");
}

function renderChecksToggle(analysis = analyzeTasks()) {
  appShell.classList.toggle("checks-hidden", !checksVisible);
  toggleChecksBtn.setAttribute("aria-expanded", String(checksVisible));
  toggleChecksBtn.textContent = checksVisible
    ? "Hide checks"
    : analysis.warnings.length
      ? `Show checks (${analysis.warnings.length})`
      : "Show checks";
}

function renderGroupsToggle() {
  const rootGroupPaths = getRootGroupPaths();
  toggleAllGroupsBtn.hidden = !rootGroupPaths.length;
  const allCollapsed = rootGroupPaths.length > 0 && rootGroupPaths.every((path) => isGroupCollapsed(path));
  toggleAllGroupsBtn.textContent = allCollapsed ? "Expand all" : "Collapse all";
  toggleAllGroupsBtn.setAttribute("aria-expanded", String(!allCollapsed));
}

function renderSummary(analysis) {
  const taskCount = state.tasks.length;
  const finish = analysis.projectFinish ? formatShortDate(analysis.projectFinish) : "No finish date";
  const progress = taskCount ? ` | ${getGroupRollup(state.tasks).progressPercent}% complete` : "";
  projectSummary.textContent = `${taskCount} task${taskCount === 1 ? "" : "s"}${progress} | Finish ${finish}`;
  timelineSummary.textContent = analysis.range
    ? `${formatShortDate(analysis.range.start)} to ${formatShortDate(analysis.range.end)}`
    : "No timeline yet";
}

function renderWarnings(analysis) {
  warningsList.textContent = "";
  warningCount.textContent = analysis.warnings.length
    ? `${analysis.warnings.length} issue${analysis.warnings.length === 1 ? "" : "s"}`
    : "Ready";

  if (!analysis.warnings.length) {
    const item = document.createElement("li");
    item.innerHTML = `<span class="ok">No schedule issues found.</span>`;
    warningsList.append(item);
    return;
  }

  analysis.warnings.forEach((warning) => {
    const item = document.createElement("li");
    const type = document.createElement("span");
    type.className = "warning-type";
    type.textContent = warning.type;
    item.append(type, document.createTextNode(warning.message));
    warningsList.append(item);
  });
}

applySavedBoardSplit();
applyTableColumnSettings();

document.querySelector("#addTaskBtn").addEventListener("click", () => {
  const lastTask = state.tasks[state.tasks.length - 1];
  const startDate = lastTask ? addBusinessDays(getFinishDate(lastTask), 1) : toIsoDate(new Date());
  state.tasks.push({
    id: makeId(),
    taskId: getNextTaskId(),
    name: "New task",
    group: "New Tasks",
    type: "task",
    owner: "",
    startDate,
    duration: 1,
    dependsOn: lastTask ? lastTask.taskId : "",
    dueDate: "",
    status: "not-started",
    notes: ""
  });
  saveAndRender();
});

ganttZoomToggle.addEventListener("click", (event) => {
  const button = event.target.closest("[data-zoom]");
  if (!button) return;
  const zoom = button.dataset.zoom;
  if (!GANTT_ZOOM_LEVELS[zoom] || zoom === currentZoom) return;
  currentZoom = zoom;
  localStorage.setItem(GANTT_ZOOM_KEY, zoom);
  scheduleRender();
});

gantt.addEventListener("pointerdown", (event) => {
  const groupBar = event.target.closest(".group-summary-bar");
  const taskBar = groupBar ? null : event.target.closest(".bar, .milestone");
  const bar = groupBar || taskBar;
  if (!bar) return;
  event.preventDefault();
  bar.setPointerCapture(event.pointerId);
  ganttBarDrag = {
    pointerId: event.pointerId,
    kind: groupBar ? "group" : "task",
    groupName: groupBar ? groupBar.dataset.groupName : "",
    taskId: taskBar ? taskBar.dataset.taskId : "",
    startX: event.clientX,
    dayWidth: GANTT_ZOOM_LEVELS[currentZoom] || GANTT_ZOOM_LEVELS.day,
    dayDelta: 0,
    bar
  };
  bar.classList.add("dragging");
});

gantt.addEventListener("pointermove", (event) => {
  if (!ganttBarDrag || event.pointerId !== ganttBarDrag.pointerId) return;
  const deltaX = event.clientX - ganttBarDrag.startX;
  const dayDelta = Math.round(deltaX / ganttBarDrag.dayWidth);
  ganttBarDrag.dayDelta = dayDelta;
  const offset = dayDelta ? `translateX(${dayDelta * ganttBarDrag.dayWidth}px)` : "";
  // Milestones are diamonds via `rotate(45deg)` in their base CSS; translating first (in
  // the untouched screen coordinate space) and rotating after keeps the drag moving
  // horizontally instead of along the rotated axis.
  ganttBarDrag.bar.style.transform = ganttBarDrag.bar.classList.contains("milestone")
    ? `${offset} rotate(45deg)`
    : offset;
});

gantt.addEventListener("pointerup", (event) => {
  if (!ganttBarDrag || event.pointerId !== ganttBarDrag.pointerId) return;
  const { kind, groupName, taskId, dayDelta, bar, pointerId } = ganttBarDrag;
  if (bar.hasPointerCapture(pointerId)) bar.releasePointerCapture(pointerId);
  bar.classList.remove("dragging");
  bar.style.transform = "";
  ganttBarDrag = null;
  if (dayDelta) {
    if (kind === "group") shiftGroupDates(groupName, dayDelta);
    else shiftTaskDate(taskId, dayDelta);
    saveAndRender();
  }
});

gantt.addEventListener("pointercancel", (event) => {
  if (!ganttBarDrag || event.pointerId !== ganttBarDrag.pointerId) return;
  const { bar, pointerId } = ganttBarDrag;
  if (bar.hasPointerCapture(pointerId)) bar.releasePointerCapture(pointerId);
  bar.classList.remove("dragging");
  bar.style.transform = "";
  ganttBarDrag = null;
});

toggleChecksBtn.addEventListener("click", () => {
  checksVisible = !checksVisible;
  localStorage.setItem(CHECKS_VISIBLE_KEY, String(checksVisible));
  renderChecksToggle();
});

toggleAllGroupsBtn.addEventListener("click", toggleAllGroups);

function toggleAllGroups() {
  const rootGroupPaths = getRootGroupPaths();
  const allCollapsed = rootGroupPaths.length > 0 && rootGroupPaths.every((path) => isGroupCollapsed(path));
  collapsedGroups = allCollapsed ? new Set() : new Set(rootGroupPaths);
  saveCollapsedGroups();
  scheduleRender();
}

taskFilterRow.addEventListener("change", (event) => {
  const field = event.target.dataset.taskFilter;
  if (!field) return;
  taskFilters[field] = event.target.value;
  saveTaskFilters();
  scheduleRender();
});

taskFilterRow.addEventListener("click", (event) => {
  if (!event.target.closest("[data-status-filter-trigger]")) return;
  statusFilterMenuOpen = !statusFilterMenuOpen;
  if (statusFilterMenuOpen) statusFilterMenuOpenedAt = Date.now();
  scheduleRender(["table"]);
});

// The status filter menu lives on <body>, not inside taskFilterRow, so its own
// interactions (checkboxes, Clear) are wired at the document level instead of through
// taskFilterRow's delegated listeners above.
document.addEventListener("change", (event) => {
  const statusValue = event.target.dataset.statusFilterValue;
  if (statusValue === undefined) return;
  const selected = new Set(taskFilters.status);
  if (event.target.checked) selected.add(statusValue);
  else selected.delete(statusValue);
  taskFilters.status = Array.from(selected);
  saveTaskFilters();
  scheduleRender();
});

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-status-filter-clear]")) {
    taskFilters.status = [];
    saveTaskFilters();
    statusFilterMenuOpen = false;
    scheduleRender();
    return;
  }

  if (!statusFilterMenuOpen) return;
  if (event.target.closest(".status-filter-menu") || event.target.closest("[data-status-filter-trigger]")) return;
  statusFilterMenuOpen = false;
  scheduleRender(["table"]);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && statusFilterMenuOpen) {
    statusFilterMenuOpen = false;
    scheduleRender(["table"]);
  }
});

clearFiltersBtn.addEventListener("click", () => {
  taskFilters = defaultTaskFilters();
  saveTaskFilters();
  statusFilterMenuOpen = false;
  scheduleRender();
});

openColumnsBtn.addEventListener("click", () => {
  renderColumnsPanel();
  columnsDialog.showModal();
});

closeColumnsBtn.addEventListener("click", () => {
  columnsDialog.close();
});

resetColumnsBtn.addEventListener("click", () => {
  columnSettings = getDefaultColumnSettings();
  saveColumnSettings();
  renderColumnsPanel();
  applyTableColumnSettings();
});

columnsList.addEventListener("change", (event) => {
  const key = event.target.dataset.columnKey;
  if (!key || !columnSettings[key]) return;

  if (event.target.dataset.columnField === "visible") {
    columnSettings[key].visible = event.target.checked;
  } else if (event.target.dataset.columnField === "width") {
    const column = taskColumns.find((item) => item.key === key);
    columnSettings[key].width = Math.max(column.min, Number.parseInt(event.target.value, 10) || column.width);
  }

  saveColumnSettings();
  renderColumnsPanel();
  applyTableColumnSettings();
});

boardResizer.addEventListener("pointerdown", (event) => {
  boardResizeActive = true;
  boardResizer.setPointerCapture(event.pointerId);
  projectBoard.classList.add("resizing");
  document.body.classList.add("resizing-board");
  resizeProjectBoard(event.clientX);
});

boardResizer.addEventListener("pointermove", (event) => {
  if (!boardResizeActive) return;
  resizeProjectBoard(event.clientX);
});

boardResizer.addEventListener("pointerup", (event) => {
  finishBoardResize(event.pointerId);
});

boardResizer.addEventListener("pointercancel", (event) => {
  finishBoardResize(event.pointerId);
});

boardResizer.addEventListener("keydown", (event) => {
  const current = getCurrentBoardSplit();
  let next = current;
  if (event.key === "ArrowLeft") next -= 2;
  if (event.key === "ArrowRight") next += 2;
  if (event.key === "Home") next = 30;
  if (event.key === "End") next = 70;
  if (next === current) return;

  event.preventDefault();
  setBoardSplit(next);
});

let syncingPaneScroll = false;

function syncPaneScroll(source, target) {
  if (syncingPaneScroll) return;
  syncingPaneScroll = true;
  target.scrollTop = source.scrollTop;
  syncingPaneScroll = false;
}

// The status filter menu is position:fixed (so it can escape the pane's own
// overflow clipping), which means it doesn't move with the table when scrolled -
// close it instead of letting it drift away from its trigger. Ignore scrolls that
// happen right at open time (see statusFilterMenuOpenedAt) - those are the browser's
// own focus-scroll nudge, not the user scrolling the table.
tableWrap.addEventListener("scroll", () => {
  if (statusFilterMenuOpen && Date.now() - statusFilterMenuOpenedAt > 300) {
    statusFilterMenuOpen = false;
    scheduleRender(["table"]);
  }
});

tableWrap.addEventListener("scroll", () => syncPaneScroll(tableWrap, timelinePane));
timelinePane.addEventListener("scroll", () => syncPaneScroll(timelinePane, tableWrap));

const PLANNER_STACKED_LAYOUT_QUERY = "(max-width: 1180px)";

function applyPlannerMaxHeight(px) {
  const value = `${px}px`;
  tableWrap.style.maxHeight = value;
  timelinePane.style.maxHeight = value;
}

function syncPlannerHeights() {
  if (window.matchMedia(PLANNER_STACKED_LAYOUT_QUERY).matches) {
    tableWrap.style.maxHeight = "";
    timelinePane.style.maxHeight = "";
    return;
  }
  const top = projectBoard.getBoundingClientRect().top;
  let available = Math.max(240, Math.floor(window.innerHeight - top - 12));
  applyPlannerMaxHeight(available);

  // Correct for whatever chrome sits below the panes (borders, padding, scrollbar
  // reservation) rather than assuming a fixed pixel amount - shrink exactly enough
  // to eliminate any leftover page-level scroll.
  const overflow = Math.ceil(document.documentElement.scrollHeight - window.innerHeight);
  if (overflow > 0) {
    available = Math.max(240, available - overflow);
    applyPlannerMaxHeight(available);
  }
}

window.addEventListener("resize", syncPlannerHeights);

openDevopsOptionsBtn.addEventListener("click", () => {
  renderDevopsPanel();
  devopsDialog.showModal();
});

closeDevopsBtn.addEventListener("click", () => {
  devopsDialog.close();
});

devopsTokenInput.addEventListener("change", () => {
  const token = devopsTokenInput.value.trim();
  if (token) localStorage.setItem(DEVOPS_TOKEN_KEY, token);
});

// focusout (not change): renderDevopsPanel() rebuilds this input, and native
// <input type="date"> fires "change" as soon as a complete date is typed - before the
// user is necessarily done editing - so committing on "change" here has the same
// mid-typing rebuild/focus-loss problem as the task table's date fields.
devopsProjectStartInput.addEventListener("focusout", () => {
  state.devops.config.projectStartDate = isIsoDate(devopsProjectStartInput.value)
    ? devopsProjectStartInput.value
    : toIsoDate(new Date());
  saveState();
  renderDevopsPanel();
});

syncDevopsBtn.addEventListener("click", async () => {
  await syncDevopsInbox();
});

syncSelectedDevopsBtn.addEventListener("click", () => {
  const synced = syncDevopsInboxItems("selected");
  setDevopsStatus(synced ? `Synced ${synced} selected item${synced === 1 ? "" : "s"}.` : "Select at least one new or changed item.");
});

syncAllDevopsBtn.addEventListener("click", () => {
  const synced = syncDevopsInboxItems("all");
  setDevopsStatus(synced ? `Synced ${synced} item${synced === 1 ? "" : "s"}.` : "No new or changed items to sync.");
});

clearDevopsInboxBtn.addEventListener("click", () => {
  if (!confirm("Clear the DevOps inbox? Imported plan tasks will stay in place.")) return;
  state.devops.inbox = [];
  saveAndRender();
  renderDevopsPanel();
});

devopsTypeFilter.addEventListener("change", () => {
  state.devops.filters.type = devopsTypeFilter.value;
  saveState();
  renderDevopsPanel();
});

devopsStatusFilter.addEventListener("change", () => {
  state.devops.filters.status = devopsStatusFilter.value;
  saveState();
  renderDevopsPanel();
});

devopsInboxList.addEventListener("click", (event) => {
  const groupToggle = event.target.closest("[data-inbox-group-toggle]");
  if (groupToggle) {
    toggleDevopsInboxGroup(groupToggle.dataset.inboxGroupToggle);
    return;
  }

  const selectGroup = event.target.closest("[data-inbox-select-group]");
  if (selectGroup) {
    selectDevopsInboxGroup(selectGroup);
    return;
  }

  const action = event.target.dataset.action;
  const externalId = event.target.dataset.externalId;
  if (!action || !externalId) return;

  const inboxItem = state.devops.inbox.find((item) => String(item.externalId) === String(externalId));
  if (!inboxItem) return;

  if (action === "add") {
    addDevopsItemToPlan(inboxItem, event.target.closest(".inbox-item"));
  } else if (action === "update") {
    applyDevopsUpdate(inboxItem);
  } else if (action === "resetName") {
    resetDevopsTaskName(inboxItem);
  } else if (action === "ignore") {
    ignoreDevopsItem(inboxItem);
  } else if (action === "unignore") {
    unignoreDevopsItem(inboxItem);
  }

  saveAndRender();
  renderDevopsPanel();
});

document.querySelector("#exportJsonBtn").addEventListener("click", () => {
  downloadFile(`${safeFileName(state.projectName)}.json`, JSON.stringify(state, null, 2), "application/json");
});

document.querySelector("#exportCsvBtn").addEventListener("click", () => {
  downloadFile(`${safeFileName(state.projectName)}.csv`, toCsv(), "text/csv");
});

document.querySelector("#clearBtn").addEventListener("click", () => {
  if (!confirm("Clear this project and start over?")) return;
  state = { projectName: "Untitled Project", tasks: [], devops: defaultDevopsState(), capacity: defaultCapacityState() };
  saveAndRender();
});

document.querySelector("#importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported.tasks)) throw new Error("Missing tasks array.");
    state = normalizeState(imported);
    saveAndRender();
  } catch (error) {
    alert(`Could not import file: ${error.message}`);
  } finally {
    event.target.value = "";
  }
});

projectNameInput.addEventListener("change", () => {
  state.projectName = projectNameInput.value.trim() || "Untitled Project";
  saveAndRender();
});

function handleTaskTableFieldCommit(event) {
  // Native <input type="date"> fires "change" as soon as a complete date has been typed -
  // e.g. right after the 4th digit of the year makes the value valid - even though the
  // user may still be mid-edit (fixing a digit, etc.). Since every commit here triggers a
  // full table re-render, which destroys and rebuilds the very input being typed into,
  // that premature "change" was yanking focus away and leaving a half-typed date sitting
  // there looking "wrong" and un-editable. Date inputs commit on focusout (blur) instead,
  // which only fires once the user actually leaves the field; every other field keeps
  // committing on "change" exactly as before.
  const isDateInput = event.target.tagName === "INPUT" && event.target.type === "date";
  if (isDateInput && event.type === "change") return;
  if (!isDateInput && event.type === "focusout") return;

  const renameFrom = event.target.dataset.renameGroup;
  if (renameFrom !== undefined) {
    renameTaskGroup(renameFrom, event.target.value);
    saveAndRender();
    return;
  }

  const groupStartName = event.target.dataset.groupStartDate;
  if (groupStartName !== undefined) {
    const nextDate = event.target.value;
    const rollup = getGroupRollup(state.tasks.filter((task) => normalizeGroupName(task.group) === normalizeGroupName(groupStartName)));
    if (isIsoDate(nextDate) && rollup.range) {
      const dayDelta = diffCalendarDays(rollup.range.start, nextDate);
      if (dayDelta) shiftGroupDates(groupStartName, dayDelta);
    }
    saveAndRender();
    return;
  }

  const field = event.target.dataset.field;
  const id = event.target.dataset.id;
  if (!field || !id) return;

  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  const previousTaskId = task.taskId;
  const previousGroup = normalizeGroupName(task.group);
  if (field === "duration") {
    task.duration = Math.max(1, Number.parseInt(event.target.value, 10) || 1);
  } else if (field === "type") {
    task.type = normalizeTaskType(event.target.value);
    if (isMilestoneType(task.type)) task.duration = 1;
  } else if (field === "taskId" || field === "dependsOn") {
    task[field] = event.target.value.trim();
  } else if (field === "group") {
    moveTaskToGroup(task, event.target.value, previousGroup);
  } else if (field === "startDate") {
    task.startDate = event.target.value;
  } else {
    task[field] = event.target.value;
  }

  if (field === "taskId" && previousTaskId && task.taskId !== previousTaskId) {
    state.tasks.forEach((item) => {
      if (item.dependsOn === previousTaskId) item.dependsOn = task.taskId;
    });
  }

  if (field === "dependsOn" && task.dependsOn === task.taskId) {
    task.dependsOn = "";
  }

  saveAndRender(FIELDS_WITHOUT_GANTT_IMPACT.has(field) ? RENDER_SCOPES_WITHOUT_GANTT : RENDER_SCOPES);
}

taskTableBody.addEventListener("change", handleTaskTableFieldCommit);
taskTableBody.addEventListener("focusout", handleTaskTableFieldCommit);

taskTableBody.addEventListener("click", (event) => {
  if (event.target.closest("[data-toggle-all-groups]")) {
    toggleAllGroups();
    return;
  }

  const groupName = event.target.closest("[data-toggle-group]")?.dataset.toggleGroup;
  if (groupName) {
    toggleTaskGroup(groupName);
    return;
  }

  const id = event.target.dataset.deleteId;
  if (!id) return;

  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  if (!confirm(`Delete "${task.name || "this task"}"?`)) return;
  state.tasks = state.tasks.filter((item) => item.id !== id);
  state.tasks.forEach((item) => {
    if (item.dependsOn === task.taskId) item.dependsOn = "";
  });
  saveAndRender();
});

taskTableBody.addEventListener("dragstart", (event) => {
  const groupHandle = event.target.closest("[data-drag-group-name]");
  if (groupHandle) {
    draggedGroupName = groupHandle.dataset.dragGroupName;
    draggedGroupParentPath = groupHandle.closest("tr")?.dataset.groupParentPath || "";
    draggedTaskId = "";
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedGroupName);
    groupHandle.closest("tr")?.classList.add("dragging");
    return;
  }

  const handle = event.target.closest("[data-drag-task-id]");
  if (!handle) return;

  draggedTaskId = handle.dataset.dragTaskId;
  draggedGroupName = "";
  draggedGroupParentPath = "";
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedTaskId);
  handle.closest("tr")?.classList.add("dragging");
});

taskTableBody.addEventListener("dragover", (event) => {
  const targetRow = draggedGroupName ? getGroupDragTargetRow(event) : getDragTargetRow(event);
  if (!targetRow) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  clearDropIndicators();
  const dropsAtGroupTop = !draggedGroupName && targetRow.classList.contains("table-group-row");
  targetRow.classList.add(dropsAtGroupTop || getDropPosition(event, targetRow) === "before" ? "drop-before" : "drop-after");
});

taskTableBody.addEventListener("dragleave", (event) => {
  if (!event.relatedTarget || !taskTableBody.contains(event.relatedTarget)) {
    clearDropIndicators();
  }
});

taskTableBody.addEventListener("drop", (event) => {
  const targetRow = draggedGroupName ? getGroupDragTargetRow(event) : getDragTargetRow(event);
  if (!targetRow) return;

  event.preventDefault();
  const moved = draggedGroupName
    ? reorderGroup(draggedGroupName, targetRow.dataset.groupName, getDropPosition(event, targetRow))
    : moveDraggedTask(draggedTaskId, targetRow, getDropPosition(event, targetRow));
  draggedTaskId = "";
  draggedGroupName = "";
  draggedGroupParentPath = "";
  clearDropIndicators();
  if (moved) saveAndRender();
});

taskTableBody.addEventListener("dragend", () => {
  draggedTaskId = "";
  draggedGroupName = "";
  draggedGroupParentPath = "";
  clearDropIndicators();
  taskTableBody.querySelectorAll(".dragging").forEach((row) => row.classList.remove("dragging"));
});

defaultCapacityInput.addEventListener("change", () => {
  state.capacity.defaultDaily = normalizeCapacityValue(defaultCapacityInput.value, 1);
  saveAndRender();
});

ownerCapacityList.addEventListener("change", (event) => {
  const owner = event.target.dataset.capacityOwner;
  if (!owner) return;
  state.capacity.owners[owner] = normalizeCapacityValue(event.target.value, state.capacity.defaultDaily);
  saveAndRender();
});

render();

