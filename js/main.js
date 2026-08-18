let state = loadState();

const projectNameInput = document.querySelector("#projectName");
const appShell = document.querySelector(".app-shell");
const projectBoard = document.querySelector(".project-board");
const boardResizer = document.querySelector("#boardResizer");
const openColumnsBtn = document.querySelector("#openColumnsBtn");
const togglePlanningBoardBtn = document.querySelector("#togglePlanningBoardBtn");
const addPlanningMonthBtn = document.querySelector("#addPlanningMonthBtn");
const ganttZoomToggle = document.querySelector("#ganttZoomToggle");
const openDevopsBtn = document.querySelector("#openDevopsBtn");
const openDevopsOptionsBtn = document.querySelector("#openDevopsOptionsBtn");
const toggleChecksBtn = document.querySelector("#toggleChecksBtn");
const toggleAllGroupsBtn = document.querySelector("#toggleAllGroupsBtn");
const projectSummary = document.querySelector("#projectSummary");
const timelineSummary = document.querySelector("#timelineSummary");
const taskTableBody = document.querySelector("#taskTableBody");
const planningBoard = document.querySelector("#planningBoard");
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
let currentView = localStorage.getItem(VIEW_KEY) === "planning" ? "planning" : "schedule";
let currentZoom = loadGanttZoom();
let planningMonthCount = loadPlanningMonthCount();
let draggedTaskId = "";
let draggedGroupName = "";
let draggedBoardTaskId = "";
let boardResizeActive = false;
let groupBarDrag = null;
let collapsedGroups = loadCollapsedGroups();
let columnSettings = loadColumnSettings();
let collapsedDevopsGroups = loadCollapsedDevopsGroups();

function saveAndRender() {
  saveState();
  render();
}

function render() {
  const analysis = analyzeTasks();
  projectNameInput.value = state.projectName;
  renderViewToggle();
  renderChecksToggle(analysis);
  renderGroupsToggle();
  renderDevopsButton();
  renderSummary(analysis);
  renderTable(analysis);
  renderGantt(analysis);
  renderPlanningBoard(analysis);
  renderWarnings(analysis);
  renderCapacity(analysis);
}

function renderViewToggle() {
  const planningActive = currentView === "planning";
  projectBoard.hidden = planningActive;
  planningBoard.hidden = !planningActive;
  addPlanningMonthBtn.hidden = !planningActive;
  ganttZoomToggle.hidden = planningActive;
  togglePlanningBoardBtn.textContent = planningActive ? "Schedule view" : "Planning board";
  togglePlanningBoardBtn.setAttribute("aria-pressed", String(planningActive));

  ganttZoomToggle.querySelectorAll("[data-zoom]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.zoom === currentZoom));
  });
}

function renderDevopsButton() {
  const counts = getDevopsInboxCounts();
  const activeCount = counts.new + counts.changed;
  openDevopsBtn.textContent = activeCount ? `DevOps sync (${activeCount})` : "DevOps sync";
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
  const groupNames = getTaskGroups().map((group) => group.name);
  toggleAllGroupsBtn.hidden = !groupNames.length;
  const allCollapsed = groupNames.length > 0 && groupNames.every((name) => isGroupCollapsed(name));
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
    planningMonth: startDate.slice(0, 7),
    duration: 1,
    dependsOn: lastTask ? lastTask.taskId : "",
    dueDate: "",
    status: "not-started",
    notes: ""
  });
  saveAndRender();
});

document.querySelector("#autoScheduleBtn").addEventListener("click", () => {
  autoSchedule();
  saveAndRender();
});

togglePlanningBoardBtn.addEventListener("click", () => {
  currentView = currentView === "planning" ? "schedule" : "planning";
  localStorage.setItem(VIEW_KEY, currentView);
  render();
});

addPlanningMonthBtn.addEventListener("click", () => {
  planningMonthCount += 1;
  localStorage.setItem(PLANNING_MONTH_COUNT_KEY, String(planningMonthCount));
  render();
});

ganttZoomToggle.addEventListener("click", (event) => {
  const button = event.target.closest("[data-zoom]");
  if (!button) return;
  const zoom = button.dataset.zoom;
  if (!GANTT_ZOOM_LEVELS[zoom] || zoom === currentZoom) return;
  currentZoom = zoom;
  localStorage.setItem(GANTT_ZOOM_KEY, zoom);
  render();
});

gantt.addEventListener("pointerdown", (event) => {
  const bar = event.target.closest(".group-summary-bar");
  if (!bar) return;
  event.preventDefault();
  bar.setPointerCapture(event.pointerId);
  groupBarDrag = {
    pointerId: event.pointerId,
    groupName: bar.dataset.groupName,
    startX: event.clientX,
    dayWidth: GANTT_ZOOM_LEVELS[currentZoom] || GANTT_ZOOM_LEVELS.day,
    dayDelta: 0,
    bar
  };
  bar.classList.add("dragging");
});

gantt.addEventListener("pointermove", (event) => {
  if (!groupBarDrag || event.pointerId !== groupBarDrag.pointerId) return;
  const deltaX = event.clientX - groupBarDrag.startX;
  const dayDelta = Math.round(deltaX / groupBarDrag.dayWidth);
  groupBarDrag.dayDelta = dayDelta;
  groupBarDrag.bar.style.transform = dayDelta ? `translateX(${dayDelta * groupBarDrag.dayWidth}px)` : "";
});

gantt.addEventListener("pointerup", (event) => {
  if (!groupBarDrag || event.pointerId !== groupBarDrag.pointerId) return;
  const { groupName, dayDelta, bar, pointerId } = groupBarDrag;
  if (bar.hasPointerCapture(pointerId)) bar.releasePointerCapture(pointerId);
  bar.classList.remove("dragging");
  bar.style.transform = "";
  groupBarDrag = null;
  if (dayDelta) {
    shiftGroupDates(groupName, dayDelta);
    saveAndRender();
  }
});

gantt.addEventListener("pointercancel", (event) => {
  if (!groupBarDrag || event.pointerId !== groupBarDrag.pointerId) return;
  const { bar, pointerId } = groupBarDrag;
  if (bar.hasPointerCapture(pointerId)) bar.releasePointerCapture(pointerId);
  bar.classList.remove("dragging");
  bar.style.transform = "";
  groupBarDrag = null;
});

toggleChecksBtn.addEventListener("click", () => {
  checksVisible = !checksVisible;
  localStorage.setItem(CHECKS_VISIBLE_KEY, String(checksVisible));
  renderChecksToggle();
});

toggleAllGroupsBtn.addEventListener("click", toggleAllGroups);

function toggleAllGroups() {
  const groupNames = getTaskGroups().map((group) => group.name);
  const allCollapsed = groupNames.length > 0 && groupNames.every((name) => isGroupCollapsed(name));
  collapsedGroups = allCollapsed ? new Set() : new Set(groupNames.map(normalizeGroupName));
  saveCollapsedGroups();
  render();
}

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

openDevopsBtn.addEventListener("click", async () => {
  await syncDevopsInbox("saved");
});

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

devopsProjectStartInput.addEventListener("change", () => {
  state.devops.config.projectStartDate = isIsoDate(devopsProjectStartInput.value)
    ? devopsProjectStartInput.value
    : toIsoDate(new Date());
  saveState();
  renderDevopsPanel();
});

syncDevopsBtn.addEventListener("click", async () => {
  await syncDevopsInbox("form");
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
    orderTasksByDependencies();
  } else if (action === "update") {
    applyDevopsUpdate(inboxItem);
    orderTasksByDependencies();
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

taskTableBody.addEventListener("change", (event) => {
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
    if (!task.planningMonth && isIsoDate(task.startDate)) task.planningMonth = task.startDate.slice(0, 7);
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

  if (field === "dependsOn") {
    autoSchedule();
  }

  saveAndRender();
});

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
  clearDropIndicators();
  if (moved) saveAndRender();
});

taskTableBody.addEventListener("dragend", () => {
  draggedTaskId = "";
  draggedGroupName = "";
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

planningBoard.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-board-task-id]");
  if (!card) return;
  draggedBoardTaskId = card.dataset.boardTaskId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedBoardTaskId);
  card.classList.add("dragging");
});

planningBoard.addEventListener("dragover", (event) => {
  const column = event.target.closest("[data-planning-bucket]");
  if (!draggedBoardTaskId || !column) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  planningBoard.querySelectorAll(".board-column.drop-target").forEach((item) => item.classList.remove("drop-target"));
  column.classList.add("drop-target");
});

planningBoard.addEventListener("drop", (event) => {
  const column = event.target.closest("[data-planning-bucket]");
  if (!draggedBoardTaskId || !column) return;
  event.preventDefault();
  const moved = moveTaskToPlanningBucket(draggedBoardTaskId, column.dataset.planningBucket, column.dataset.planningMonth || "");
  draggedBoardTaskId = "";
  clearPlanningDropState();
  if (moved) saveAndRender();
});

planningBoard.addEventListener("dragend", () => {
  draggedBoardTaskId = "";
  clearPlanningDropState();
});

render();

