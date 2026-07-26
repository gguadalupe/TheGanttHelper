const STORAGE_KEY = "simple-gantt-planner-v1";
const CHECKS_VISIBLE_KEY = "simple-gantt-checks-visible-v1";
const DEVOPS_TOKEN_KEY = "simple-gantt-devops-token-v1";
const BOARD_SPLIT_KEY = "simple-gantt-board-split-v1";
const COLLAPSED_GROUPS_KEY = "simple-gantt-collapsed-groups-v1";
const COLUMN_SETTINGS_KEY = "simple-gantt-column-settings-v1";
const DEVOPS_COLLAPSED_GROUPS_KEY = "simple-gantt-devops-collapsed-groups-v1";
const VIEW_KEY = "simple-gantt-view-v1";
const GANTT_ZOOM_KEY = "simple-gantt-zoom-v1";
const GANTT_ZOOM_LEVELS = { day: 34, week: 12, month: 4 };
const PLANNING_MONTH_COUNT_KEY = "simple-gantt-planning-month-count-v1";
const DEFAULT_PLANNING_MONTH_COUNT = 4;
const DEFAULT_DEVOPS_ORG = "insolut";
const DEFAULT_DEVOPS_PROJECT = "Insurance Solutions";
const DEFAULT_WIQL = [
  "SELECT [System.Id]",
  "FROM WorkItems",
  "WHERE [System.TeamProject] = @project",
  "AND [System.Title] CONTAINS 'Kanguro'",
  "AND [System.State] <> 'Closed'",
  "AND [System.State] <> 'Removed'",
  "ORDER BY [System.ChangedDate] DESC"
].join("\n");

const statusOptions = [
  ["not-started", "Not started"],
  ["in-progress", "In progress"],
  ["done", "Done"]
];

const typeOptions = [
  ["task", "Task"],
  ["milestone", "Milestone"],
  ["Bug", "Bug"],
  ["Epic", "Epic"],
  ["Feature", "Feature"],
  ["Issue", "Issue"],
  ["Product Backlog Item", "Product Backlog Item"],
  ["Requirement", "Requirement"],
  ["User Story", "User Story"],
  ["Test Case", "Test Case"],
  ["Test Plan", "Test Plan"],
  ["Test Suite", "Test Suite"],
  ["Impediment", "Impediment"],
  ["Change Request", "Change Request"],
  ["Risk", "Risk"],
  ["Review", "Review"],
  ["Feedback Request", "Feedback Request"],
  ["Feedback Response", "Feedback Response"],
  ["Code Review Request", "Code Review Request"],
  ["Code Review Response", "Code Review Response"],
  ["Shared Steps", "Shared Steps"]
];

const taskColumns = [
  { key: "id", label: "ID", width: 78, min: 54 },
  { key: "title", label: "Task", width: 300, min: 160 },
  { key: "group", label: "Group", width: 120, min: 90 },
  { key: "type", label: "Type", width: 122, min: 100 },
  { key: "owner", label: "Owner", width: 96, min: 80 },
  { key: "start", label: "Start", width: 140, min: 110 },
  { key: "duration", label: "Days", width: 78, min: 64 },
  { key: "finish", label: "Finish", width: 118, min: 100 },
  { key: "dependsOn", label: "Depends on", width: 156, min: 110 },
  { key: "due", label: "Due", width: 140, min: 110 },
  { key: "status", label: "Status", width: 120, min: 100 },
  { key: "notes", label: "Notes", width: 148, min: 100 },
  { key: "actions", label: "Actions", width: 58, min: 48 }
];

const sampleTasks = [
  {
    id: makeId(),
    taskId: "1",
    name: "Project kickoff",
    group: "Planning",
    type: "milestone",
    owner: "",
    startDate: toIsoDate(new Date()),
    planningMonth: toIsoDate(new Date()).slice(0, 7),
    duration: 1,
    dependsOn: "",
    dueDate: "",
    status: "done",
    notes: ""
  },
  {
    id: makeId(),
    taskId: "2",
    name: "Define requirements",
    group: "Planning",
    type: "task",
    owner: "",
    startDate: addBusinessDays(toIsoDate(new Date()), 1),
    planningMonth: toIsoDate(new Date()).slice(0, 7),
    duration: 3,
    dependsOn: "",
    dueDate: "",
    status: "in-progress",
    notes: ""
  },
  {
    id: makeId(),
    taskId: "3",
    name: "Build first version",
    group: "Delivery",
    type: "task",
    owner: "",
    startDate: addBusinessDays(toIsoDate(new Date()), 4),
    planningMonth: toIsoDate(new Date()).slice(0, 7),
    duration: 5,
    dependsOn: "",
    dueDate: "",
    status: "not-started",
    notes: ""
  }
];

sampleTasks[1].dependsOn = sampleTasks[0].taskId;
sampleTasks[2].dependsOn = sampleTasks[1].taskId;

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

applySavedBoardSplit();
applyTableColumnSettings();

document.querySelector("#addTaskBtn").addEventListener("click", () => {
  const lastTask = state.tasks[state.tasks.length - 1];
  const startDate = lastTask ? addBusinessDays(getFinishDate(lastTask), 1) : toIsoDate(new Date());
  state.tasks.push({
    id: makeId(),
    taskId: getNextTaskId(),
    name: "New task",
    group: lastTask ? lastTask.group : "",
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

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeState(JSON.parse(saved));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    projectName: "My Project Plan",
    tasks: sampleTasks,
    devops: defaultDevopsState(),
    capacity: defaultCapacityState()
  };
}

function normalizeState(raw) {
  const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  const usedTaskIds = new Set();
  const internalToTaskId = new Map();
  const tasks = rawTasks.map((task, index) => {
    const id = typeof task.id === "string" && task.id ? task.id : makeId();
    const taskId = getUniqueTaskId(getRawTaskId(task, index), usedTaskIds);
    internalToTaskId.set(id, taskId);

    return {
      id,
      taskId,
      name: typeof task.name === "string" ? task.name : "New task",
      group: typeof task.group === "string" ? task.group : "",
      type: normalizeTaskType(task.type),
      owner: typeof task.owner === "string" ? task.owner : "",
      startDate: isIsoDate(task.startDate) ? task.startDate : toIsoDate(new Date()),
      planningMonth: normalizePlanningMonth(task.planningMonth, task.startDate),
      duration: Math.max(1, Number.parseInt(task.duration || task.durationDays, 10) || 1),
      dependsOn: typeof task.dependsOn === "string" ? task.dependsOn.trim() : "",
      dueDate: isIsoDate(task.dueDate) ? task.dueDate : "",
      status: normalizeTaskStatus(task.status),
      notes: typeof task.notes === "string" ? task.notes : "",
      source: typeof task.source === "string" ? task.source : "",
      externalId: task.externalId ?? "",
      externalUrl: typeof task.externalUrl === "string" ? task.externalUrl : "",
      externalSignature: typeof task.externalSignature === "string" ? task.externalSignature : "",
      externalChangedDate: typeof task.externalChangedDate === "string" ? task.externalChangedDate : ""
    };
  });

  tasks.forEach((task) => {
    if (internalToTaskId.has(task.dependsOn)) {
      task.dependsOn = internalToTaskId.get(task.dependsOn);
    }
  });

  return {
    projectName: typeof raw.projectName === "string" && raw.projectName.trim() ? raw.projectName.trim() : "Untitled Project",
    tasks,
    devops: normalizeDevopsState(raw.devops),
    capacity: normalizeCapacityState(raw.capacity)
  };
}

function getRawTaskId(task, index) {
  if (task.source === "azure-devops" && task.externalId != null && String(task.externalId).trim()) return String(task.externalId).trim();
  if (typeof task.taskId === "string" && task.taskId.trim()) return task.taskId.trim();
  if (task.externalId != null && String(task.externalId).trim()) return String(task.externalId).trim();
  return String(index + 1);
}

function getUniqueTaskId(value, usedTaskIds) {
  const base = String(value || "").trim() || "1";
  let candidate = base;
  let suffix = 2;
  while (usedTaskIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedTaskIds.add(candidate);
  return candidate;
}

function normalizeTaskType(value) {
  const type = typeof value === "string" ? value.trim() : "";
  return type || "task";
}

function getTypeOptions(currentType = "") {
  const options = [];
  const seen = new Set();
  const addOption = (value, label = value) => {
    const normalizedValue = normalizeTaskType(value);
    if (seen.has(normalizedValue)) return;
    seen.add(normalizedValue);
    options.push([normalizedValue, label || normalizedValue]);
  };

  typeOptions.forEach(([value, label]) => addOption(value, label));
  state.tasks.forEach((task) => addOption(task.type, getTypeLabel(task.type)));
  state.devops.inbox.forEach((item) => {
    addOption(item.workItemType, getTypeLabel(item.workItemType));
    addOption(item.suggestedType, getTypeLabel(item.suggestedType));
  });
  addOption(currentType, getTypeLabel(currentType));
  return options;
}

function getTypeLabel(value) {
  const normalizedType = normalizeTaskType(value);
  return typeOptions.find(([optionValue]) => optionValue === normalizedType)?.[1] || normalizedType;
}

function isMilestoneType(value) {
  return normalizeTaskType(value).toLowerCase() === "milestone";
}

function normalizeTaskStatus(value) {
  const status = typeof value === "string" ? value.trim() : "";
  return status || "not-started";
}

function getStatusOptions(currentStatus = "") {
  const options = [];
  const seen = new Set();
  const addOption = (value, label = value) => {
    const normalizedValue = normalizeTaskStatus(value);
    if (seen.has(normalizedValue)) return;
    seen.add(normalizedValue);
    options.push([normalizedValue, label || normalizedValue]);
  };

  statusOptions.forEach(([value, label]) => addOption(value, label));
  state.tasks.forEach((task) => addOption(task.status, getStatusLabel(task.status)));
  state.devops.inbox.forEach((item) => addOption(item.state, getStatusLabel(item.state)));
  addOption(currentStatus, getStatusLabel(currentStatus));
  return options;
}

function getStatusLabel(value) {
  const normalizedStatus = normalizeTaskStatus(value);
  return statusOptions.find(([optionValue]) => optionValue === normalizedStatus)?.[1] || normalizedStatus;
}

function isDoneStatus(value) {
  return ["closed", "done", "resolved", "removed"].includes(normalizeTaskStatus(value).toLowerCase());
}

function isInProgressStatus(value) {
  return ["active", "committed", "in progress", "doing", "in-progress"].includes(normalizeTaskStatus(value).toLowerCase());
}

function saveAndRender() {
  saveState();
  render();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getDefaultColumnSettings() {
  return Object.fromEntries(taskColumns.map((column) => [
    column.key,
    { visible: true, width: column.width }
  ]));
}

function loadColumnSettings() {
  const defaults = getDefaultColumnSettings();
  try {
    const saved = JSON.parse(localStorage.getItem(COLUMN_SETTINGS_KEY) || "{}");
    taskColumns.forEach((column) => {
      const setting = saved[column.key] || {};
      defaults[column.key] = {
        visible: typeof setting.visible === "boolean" ? setting.visible : true,
        width: Math.max(column.min, Number.parseInt(setting.width, 10) || column.width)
      };
    });
  } catch {
    localStorage.removeItem(COLUMN_SETTINGS_KEY);
  }
  return defaults;
}

function saveColumnSettings() {
  localStorage.setItem(COLUMN_SETTINGS_KEY, JSON.stringify(columnSettings));
}

function renderColumnsPanel() {
  columnsList.textContent = "";

  taskColumns.forEach((column) => {
    const setting = columnSettings[column.key];
    const row = document.createElement("label");
    row.className = "column-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = setting.visible;
    checkbox.dataset.columnKey = column.key;
    checkbox.dataset.columnField = "visible";

    const name = document.createElement("span");
    name.textContent = column.label;

    const width = document.createElement("input");
    width.type = "number";
    width.min = String(column.min);
    width.step = "10";
    width.value = String(setting.width);
    width.dataset.columnKey = column.key;
    width.dataset.columnField = "width";

    row.append(checkbox, name, width);
    columnsList.append(row);
  });
}

function getVisibleColumnCount() {
  return taskColumns.filter((column) => columnSettings[column.key]?.visible).length || 1;
}

function applyTableColumnSettings() {
  if (!taskTableBody) return;
  const table = taskTableBody.closest("table");
  if (!table) return;

  let totalWidth = 0;
  taskColumns.forEach((column) => {
    const setting = columnSettings[column.key];
    const visible = setting?.visible !== false;
    const width = Math.max(column.min, Number.parseInt(setting?.width, 10) || column.width);
    if (visible) totalWidth += width;

    table.querySelectorAll(`[data-column="${column.key}"]`).forEach((cell) => {
      cell.hidden = !visible;
      cell.style.width = visible ? `${width}px` : "";
      cell.style.minWidth = visible ? `${width}px` : "";
    });
  });

  table.style.minWidth = `${Math.max(480, totalWidth)}px`;
}

function loadCollapsedGroups() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLLAPSED_GROUPS_KEY) || "[]");
    return new Set(Array.isArray(saved) ? saved.map(String) : []);
  } catch {
    localStorage.removeItem(COLLAPSED_GROUPS_KEY);
    return new Set();
  }
}

function saveCollapsedGroups() {
  localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(Array.from(collapsedGroups)));
}

function loadCollapsedDevopsGroups() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEVOPS_COLLAPSED_GROUPS_KEY) || "[]");
    return new Set(Array.isArray(saved) ? saved.map(String) : []);
  } catch {
    localStorage.removeItem(DEVOPS_COLLAPSED_GROUPS_KEY);
    return new Set();
  }
}

function saveCollapsedDevopsGroups() {
  localStorage.setItem(DEVOPS_COLLAPSED_GROUPS_KEY, JSON.stringify(Array.from(collapsedDevopsGroups)));
}

function loadPlanningMonthCount() {
  const saved = Number.parseInt(localStorage.getItem(PLANNING_MONTH_COUNT_KEY), 10);
  return Number.isFinite(saved) ? Math.max(DEFAULT_PLANNING_MONTH_COUNT, saved) : DEFAULT_PLANNING_MONTH_COUNT;
}

function loadGanttZoom() {
  const saved = localStorage.getItem(GANTT_ZOOM_KEY);
  return GANTT_ZOOM_LEVELS[saved] ? saved : "day";
}

function isGroupCollapsed(groupName) {
  return collapsedGroups.has(normalizeGroupName(groupName));
}

function toggleTaskGroup(groupName) {
  const normalizedGroup = normalizeGroupName(groupName);
  if (collapsedGroups.has(normalizedGroup)) {
    collapsedGroups.delete(normalizedGroup);
  } else {
    collapsedGroups.add(normalizedGroup);
  }
  saveCollapsedGroups();
  render();
}

function render() {
  const analysis = analyzeTasks();
  projectNameInput.value = state.projectName;
  renderViewToggle();
  renderChecksToggle(analysis);
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

function renderSummary(analysis) {
  const taskCount = state.tasks.length;
  const finish = analysis.projectFinish ? formatShortDate(analysis.projectFinish) : "No finish date";
  projectSummary.textContent = `${taskCount} task${taskCount === 1 ? "" : "s"} | Finish ${finish}`;
  timelineSummary.textContent = analysis.range
    ? `${formatShortDate(analysis.range.start)} to ${formatShortDate(analysis.range.end)}`
    : "No timeline yet";
}

function renderTable(analysis) {
  taskTableBody.textContent = "";

  if (!state.tasks.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = getVisibleColumnCount();
    cell.append(emptyStateTemplate.content.cloneNode(true));
    row.append(cell);
    taskTableBody.append(row);
    applyTableColumnSettings();
    return;
  }

  const warningsByTask = groupWarningsByTask(analysis.warnings);

  getTaskGroups().forEach((group) => {
    const collapsed = isGroupCollapsed(group.name);
    const rollup = getGroupRollup(group.tasks);
    const groupRow = document.createElement("tr");
    groupRow.className = "table-group-row";
    groupRow.dataset.groupName = group.name;
    groupRow.append(
      groupEmptyCell("id"),
      groupTitleCell(group.name, group.tasks.length, collapsed),
      groupEmptyCell("group"),
      groupEmptyCell("type"),
      groupEmptyCell("owner"),
      groupRollupCell(rollup.range ? formatShortDate(rollup.range.start) : "", "start"),
      groupRollupCell(rollup.range ? `${rollup.businessDays}d` : "", "duration"),
      groupRollupCell(rollup.range ? formatShortDate(rollup.range.end) : "", "finish"),
      groupEmptyCell("dependsOn"),
      groupEmptyCell("due"),
      groupRollupCell(rollup.totalCount ? `${rollup.doneCount}/${rollup.totalCount} done` : "", "status"),
      groupEmptyCell("notes"),
      groupEmptyCell("actions")
    );
    taskTableBody.append(groupRow);

    if (collapsed) return;

    group.tasks.forEach((task) => {
      const row = document.createElement("tr");
      row.dataset.taskId = task.id;
      row.dataset.group = normalizeGroupName(task.group);
      row.className = [
        warningsByTask.has(task.id) ? "has-warning" : "",
        isDoneStatus(task.status) ? "done" : "",
        isMilestoneType(task.type) ? "milestone-task" : ""
      ].filter(Boolean).join(" ");

      row.append(
        inputCell(task, "taskId", "text", "id"),
        taskNameCell(task, warningsByTask.get(task.id) || []),
        inputCell(task, "group", "text", "group"),
        typeCell(task),
        inputCell(task, "owner", "text", "owner"),
        inputCell(task, "startDate", "date", "start"),
        inputCell(task, "duration", "number", "duration"),
        readOnlyCell(getFinishDate(task), "finish"),
        inputCell(task, "dependsOn", "text", "dependsOn"),
        inputCell(task, "dueDate", "date", "due"),
        statusCell(task),
        inputCell(task, "notes", "text", "notes"),
        deleteCell(task)
      );

      taskTableBody.append(row);
    });
  });

  applyTableColumnSettings();
}

function renderPlanningBoard(analysis) {
  planningBoard.textContent = "";
  const warningsByTask = groupWarningsByTask(analysis.warnings);
  const buckets = getPlanningBuckets();

  buckets.forEach((bucket) => {
    const tasks = getPlanningBucketTasks(bucket);
    const column = document.createElement("section");
    column.className = `board-column ${bucket.kind}`;
    column.dataset.planningBucket = bucket.kind;
    if (bucket.month) column.dataset.planningMonth = bucket.month;

    const header = document.createElement("div");
    header.className = "board-column-header";
    const title = document.createElement("h3");
    title.textContent = bucket.label;
    const summary = document.createElement("p");
    summary.textContent = getPlanningBucketSummary(bucket, tasks);
    header.append(title, summary);

    const cards = document.createElement("div");
    cards.className = "board-cards";
    if (!tasks.length) {
      const empty = document.createElement("p");
      empty.className = "board-empty";
      empty.textContent = "No tickets";
      cards.append(empty);
    } else {
      tasks.forEach((task) => cards.append(planningCard(task, warningsByTask.get(task.id) || [])));
    }

    column.append(header, cards);
    planningBoard.append(column);
  });
}

function planningCard(task, warnings = []) {
  const card = document.createElement("article");
  card.className = [
    "board-card",
    warnings.length ? "has-warning" : "",
    isDoneStatus(task.status) ? "done" : ""
  ].filter(Boolean).join(" ");
  card.draggable = true;
  card.dataset.boardTaskId = task.id;

  const title = document.createElement("h4");
  title.textContent = `${task.taskId ? `${task.taskId} ` : ""}${task.name || "Untitled task"}`;

  const meta = document.createElement("p");
  meta.textContent = [
    getTypeLabel(task.type),
    task.owner || "Unassigned",
    getStatusLabel(task.status)
  ].filter(Boolean).join(" | ");

  const footer = document.createElement("div");
  footer.className = "board-card-footer";
  footer.append(boardPill(task.group || "Ungrouped"));
  if (task.dueDate) footer.append(boardPill(`Due ${formatShortDate(task.dueDate)}`));
  if (warnings.length) footer.append(boardPill(`! ${warnings.length}`, warnings.map((warning) => `${warning.type}: ${warning.message}`).join("\n"), "warning"));

  card.append(title, meta, footer);
  return card;
}

function boardPill(text, title = "", className = "") {
  const pill = document.createElement("span");
  pill.className = ["board-pill", className].filter(Boolean).join(" ");
  pill.textContent = text;
  if (title) pill.title = title;
  return pill;
}

function groupTitleCell(groupName, taskCount, collapsed) {
  const cell = document.createElement("td");
  cell.dataset.column = "title";
  const wrapper = document.createElement("div");
  wrapper.className = "group-header-cell";
  wrapper.append(
    groupDragHandle(groupName),
    groupToggleButton(groupName, collapsed),
    groupNameInput(groupName),
    groupCountBadge(taskCount)
  );
  cell.append(wrapper);
  return cell;
}

function groupDragHandle(groupName) {
  const handle = document.createElement("button");
  handle.className = "group-drag-handle";
  handle.type = "button";
  handle.draggable = true;
  handle.dataset.dragGroupName = groupName;
  handle.title = "Drag to reorder this group";
  handle.setAttribute("aria-label", `Reorder group ${groupName}`);
  handle.textContent = "::";
  return handle;
}

function groupToggleButton(groupName, collapsed) {
  const button = document.createElement("button");
  button.className = "group-toggle";
  button.type = "button";
  button.dataset.toggleGroup = groupName;
  button.setAttribute("aria-expanded", String(!collapsed));
  button.setAttribute("aria-label", collapsed ? `Expand ${groupName}` : `Collapse ${groupName}`);
  button.textContent = collapsed ? "+" : "-";
  return button;
}

function groupNameInput(groupName) {
  const input = document.createElement("input");
  input.className = "group-name-input";
  input.type = "text";
  input.value = groupName;
  input.dataset.renameGroup = groupName;
  input.setAttribute("aria-label", "Group name");
  input.title = "Rename this group (updates every task in it)";
  return input;
}

function groupCountBadge(taskCount) {
  const span = document.createElement("span");
  span.className = "group-count";
  span.textContent = `${taskCount} task${taskCount === 1 ? "" : "s"}`;
  return span;
}

function groupRollupCell(value, column) {
  const cell = document.createElement("td");
  cell.dataset.column = column;
  cell.className = "group-rollup-cell";
  cell.textContent = value;
  return cell;
}

function groupEmptyCell(column) {
  const cell = document.createElement("td");
  cell.dataset.column = column;
  return cell;
}

function taskNameCell(task, warnings = []) {
  const cell = document.createElement("td");
  cell.dataset.column = "title";
  const wrapper = document.createElement("div");
  wrapper.className = "task-name-cell";

  const handle = document.createElement("button");
  handle.className = "drag-handle";
  handle.type = "button";
  handle.draggable = true;
  handle.dataset.dragTaskId = task.id;
  handle.title = "Drag to reorder, or drop onto another group to move this task there";
  handle.setAttribute("aria-label", `Reorder or move ${task.name || "task"}`);
  handle.textContent = "::";

  const input = createTaskInput(task, "name", "text");
  wrapper.append(handle);
  if (warnings.length) wrapper.append(taskWarningButton(task, warnings));
  wrapper.append(input);
  cell.append(wrapper);
  return cell;
}

function taskWarningButton(task, warnings) {
  const button = document.createElement("button");
  button.className = "task-warning-indicator";
  button.type = "button";
  const messages = warnings.map((warning) => `${warning.type}: ${warning.message}`).join("\n");
  button.title = messages;
  button.setAttribute("aria-label", `${task.name || "Task"} warnings: ${messages}`);
  button.textContent = "!";
  return button;
}

function inputCell(task, field, type, column = field) {
  const cell = document.createElement("td");
  cell.dataset.column = column;
  cell.append(createTaskInput(task, field, type));
  return cell;
}

function createTaskInput(task, field, type) {
  const input = document.createElement("input");
  input.dataset.id = task.id;
  input.dataset.field = field;
  input.type = type;
  input.value = task[field] || "";
  if (field === "duration") {
    input.min = "1";
    input.step = "1";
    input.disabled = isMilestoneType(task.type);
    input.title = isMilestoneType(task.type) ? "Milestones are one day markers." : "";
  }
  return input;
}

function readOnlyCell(value, column) {
  const cell = document.createElement("td");
  if (column) cell.dataset.column = column;
  const input = document.createElement("input");
  input.type = "text";
  input.readOnly = true;
  input.value = value;
  cell.append(input);
  return cell;
}

function typeCell(task) {
  const cell = document.createElement("td");
  cell.dataset.column = "type";
  const select = document.createElement("select");
  select.dataset.id = task.id;
  select.dataset.field = "type";

  getTypeOptions(task.type).forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });

  select.value = normalizeTaskType(task.type);
  cell.append(select);
  return cell;
}

function statusCell(task) {
  const cell = document.createElement("td");
  cell.dataset.column = "status";
  const select = document.createElement("select");
  select.dataset.id = task.id;
  select.dataset.field = "status";

  getStatusOptions(task.status).forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });

  select.value = normalizeTaskStatus(task.status);
  cell.append(select);
  return cell;
}

function deleteCell(task) {
  const cell = document.createElement("td");
  cell.dataset.column = "actions";
  const button = document.createElement("button");
  button.className = "delete-btn";
  button.type = "button";
  button.dataset.deleteId = task.id;
  button.title = "Delete task";
  button.setAttribute("aria-label", `Delete ${task.name || "task"}`);
  button.textContent = "X";
  cell.append(button);
  return cell;
}

function renderGantt(analysis) {
  gantt.textContent = "";

  if (!state.tasks.length || !analysis.range) {
    gantt.append(emptyStateTemplate.content.cloneNode(true));
    return;
  }

  const days = enumerateDays(analysis.range.start, analysis.range.end);
  const dayWidth = GANTT_ZOOM_LEVELS[currentZoom] || GANTT_ZOOM_LEVELS.day;
  const columnsTemplate = `repeat(${days.length}, minmax(${dayWidth}px, 1fr))`;
  const inner = document.createElement("div");
  inner.className = "gantt-inner";
  inner.style.width = `${days.length * dayWidth}px`;
  inner.style.setProperty("--gantt-col-w", `${dayWidth}px`);

  const header = document.createElement("div");
  header.className = "gantt-header";
  header.append(labelCell("Task", ""));

  const axis = document.createElement("div");
  axis.className = "axis";
  axis.style.gridTemplateColumns = columnsTemplate;

  getMonthSpans(days).forEach((month) => {
    const cell = document.createElement("div");
    cell.className = "month-cell";
    cell.style.gridColumn = `${month.startIndex + 1} / span ${month.dayCount}`;
    cell.textContent = month.label;
    axis.append(cell);
  });

  if (currentZoom === "day") {
    days.forEach((day, index) => {
      const cell = document.createElement("div");
      cell.className = dayCellClass(day, "axis-cell");
      cell.style.gridColumn = `${index + 1}`;
      cell.innerHTML = `<strong>${day.slice(8, 10)}</strong><br>${weekdayLabel(day)}`;
      axis.append(cell);
    });
  } else {
    getWeekSpans(days).forEach((week) => {
      const cell = document.createElement("div");
      cell.className = "axis-cell week-cell";
      cell.style.gridColumn = `${week.startIndex + 1} / span ${week.dayCount}`;
      cell.textContent = week.label;
      axis.append(cell);
    });
  }

  header.append(axis);
  inner.append(header);

  const warningTasks = groupWarningsByTask(analysis.warnings);

  getTaskGroups().forEach((group) => {
    const collapsed = isGroupCollapsed(group.name);
    const rollup = getGroupRollup(group.tasks);
    const row = document.createElement("div");
    row.className = "gantt-group-row";
    row.append(labelCell(group.name, rollup.totalCount ? `${rollup.doneCount}/${rollup.totalCount} done` : "0 tasks"));

    const track = document.createElement("div");
    track.className = "track group-track";
    track.style.gridTemplateColumns = columnsTemplate;
    const groupRange = rollup.range;
    if (groupRange) {
      const startIndex = days.indexOf(groupRange.start);
      const endIndex = days.indexOf(groupRange.end);
      if (startIndex >= 0 && endIndex >= 0) {
        const summary = document.createElement("div");
        summary.className = "group-summary-bar";
        summary.dataset.groupName = group.name;
        summary.style.gridColumn = `${startIndex + 1} / span ${endIndex - startIndex + 1}`;
        summary.title = `${group.name}: ${formatShortDate(groupRange.start)} to ${formatShortDate(groupRange.end)} (drag to reschedule)`;

        const fill = document.createElement("div");
        fill.className = "group-summary-fill";
        fill.style.width = `${rollup.totalCount ? Math.round((rollup.doneCount / rollup.totalCount) * 100) : 0}%`;
        summary.append(fill);

        track.append(summary);
      }
    }
    row.append(track);
    inner.append(row);

    if (collapsed) return;

    group.tasks.forEach((task) => {
      const taskRow = document.createElement("div");
      taskRow.className = "gantt-row";
      taskRow.append(labelCell(task.name || "Untitled task", isMilestoneType(task.type) ? "Milestone" : `${task.duration}d`));

      const taskTrack = document.createElement("div");
      taskTrack.className = "track";
      taskTrack.style.gridTemplateColumns = columnsTemplate;

      days.forEach((day, index) => {
        const cell = document.createElement("div");
        cell.className = dayCellClass(day, "day-cell");
        cell.style.gridColumn = `${index + 1}`;
        taskTrack.append(cell);
      });

      const startIndex = days.indexOf(task.startDate);
      const finishDate = getFinishDate(task);
      const finishIndex = days.indexOf(finishDate);
      if (startIndex >= 0 && finishIndex >= 0) {
        if (isMilestoneType(task.type)) {
          const milestone = document.createElement("div");
          milestone.className = [
            "milestone",
            isDoneStatus(task.status) ? "done" : "",
            warningTasks.has(task.id) ? "warning" : ""
          ].filter(Boolean).join(" ");
          milestone.style.gridColumn = `${startIndex + 1}`;
          milestone.title = `${task.name || "Untitled milestone"}: ${formatShortDate(task.startDate)}`;
          milestone.setAttribute("aria-label", milestone.title);
          taskTrack.append(milestone);
        } else {
          const bar = document.createElement("div");
          bar.className = [
            "bar",
            isInProgressStatus(task.status) ? "in-progress" : "",
            isDoneStatus(task.status) ? "done" : "",
            warningTasks.has(task.id) ? "warning" : ""
          ].filter(Boolean).join(" ");
          bar.style.gridColumn = `${startIndex + 1} / span ${finishIndex - startIndex + 1}`;
          bar.textContent = task.name || "Untitled task";
          bar.title = `${task.name || "Untitled task"}: ${formatShortDate(task.startDate)} to ${formatShortDate(finishDate)}`;
          taskTrack.append(bar);
        }
      }

      taskRow.append(taskTrack);
      inner.append(taskRow);
    });
  });

  gantt.append(inner);
}

function getMonthSpans(days) {
  const months = [];
  days.forEach((day, index) => {
    const monthKey = day.slice(0, 7);
    const current = months.at(-1);
    if (current?.key === monthKey) {
      current.dayCount += 1;
      return;
    }

    months.push({
      key: monthKey,
      startIndex: index,
      dayCount: 1,
      label: formatMonthLabel(day)
    });
  });
  return months;
}

function getWeekSpans(days) {
  const weeks = [];
  days.forEach((day, index) => {
    const weekKey = getWeekStart(day);
    const current = weeks.at(-1);
    if (current?.key === weekKey) {
      current.dayCount += 1;
      return;
    }

    weeks.push({
      key: weekKey,
      startIndex: index,
      dayCount: 1,
      label: formatDayMonthLabel(weekKey)
    });
  });
  return weeks;
}

function getWeekStart(isoDate) {
  const date = parseIsoDate(isoDate);
  const weekday = date.getUTCDay();
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + offsetToMonday);
  return toIsoDate(date);
}

function formatDayMonthLabel(isoDate) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(parseIsoDate(isoDate));
}

function getGroupDateRange(tasks) {
  const ranges = tasks
    .filter((task) => isIsoDate(task.startDate) && isIsoDate(getFinishDate(task)))
    .map((task) => ({
      start: task.startDate,
      end: getFinishDate(task)
    }));

  if (!ranges.length) return null;
  return {
    start: ranges.map((range) => range.start).sort(compareDates)[0],
    end: ranges.map((range) => range.end).sort(compareDates).at(-1)
  };
}

function getGroupRollup(tasks) {
  const range = getGroupDateRange(tasks);
  const doneCount = tasks.filter((task) => isDoneStatus(task.status)).length;
  const inProgressCount = tasks.filter((task) => isInProgressStatus(task.status)).length;

  let status = "not-started";
  if (tasks.length && doneCount === tasks.length) status = "done";
  else if (doneCount > 0 || inProgressCount > 0) status = "in-progress";

  return {
    range,
    businessDays: range ? countBusinessDays(range.start, range.end) : 0,
    doneCount,
    totalCount: tasks.length,
    status
  };
}

function countBusinessDays(start, end) {
  return enumerateDays(start, end).filter((day) => !isWeekendIso(day)).length;
}

function shiftGroupDates(groupName, dayDelta) {
  if (!dayDelta) return;
  const normalized = normalizeGroupName(groupName);
  state.tasks.forEach((task) => {
    if (normalizeGroupName(task.group) !== normalized) return;
    if (!isIsoDate(task.startDate)) return;
    task.startDate = addCalendarDays(task.startDate, dayDelta);
    task.planningMonth = task.startDate.slice(0, 7);
  });
  autoSchedule();
}

function renameTaskGroup(previousName, nextNameRaw) {
  const previous = normalizeGroupName(previousName);
  const next = normalizeGroupName(nextNameRaw);
  if (next === previous) return false;

  let changed = false;
  state.tasks.forEach((task) => {
    if (normalizeGroupName(task.group) === previous) {
      task.group = next;
      changed = true;
    }
  });

  if (changed && collapsedGroups.has(previous)) {
    collapsedGroups.delete(previous);
    collapsedGroups.add(next);
    saveCollapsedGroups();
  }

  return changed;
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

function renderCapacity(analysis) {
  defaultCapacityInput.value = formatCapacityValue(state.capacity.defaultDaily);
  ownerCapacityList.textContent = "";
  capacityHeatmap.textContent = "";

  const owners = getCapacityOwners();
  if (!owners.length) {
    const empty = document.createElement("p");
    empty.className = "capacity-empty";
    empty.textContent = "Add owners to tasks to see capacity.";
    ownerCapacityList.append(empty);
    return;
  }

  owners.forEach((owner) => {
    const row = document.createElement("label");
    row.className = "owner-capacity-row";
    row.textContent = owner;

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "0.25";
    input.dataset.capacityOwner = owner;
    input.value = formatCapacityValue(getOwnerCapacity(owner));

    row.append(input);
    ownerCapacityList.append(row);
  });

  if (!analysis.capacity.days.length) {
    const empty = document.createElement("p");
    empty.className = "capacity-empty";
    empty.textContent = "No scheduled demand yet.";
    capacityHeatmap.append(empty);
    return;
  }

  capacityHeatmap.style.setProperty("--capacity-day-count", analysis.capacity.days.length);
  capacityHeatmap.append(capacityHeaderRow(analysis.capacity.days));

  analysis.capacity.owners.forEach((owner) => {
    const row = document.createElement("div");
    row.className = "capacity-row";

    const label = document.createElement("div");
    label.className = "capacity-owner";
    label.textContent = owner;
    row.append(label);

    analysis.capacity.days.forEach((day) => {
      const load = analysis.capacity.loads.get(owner)?.get(day) || 0;
      const capacity = getOwnerCapacity(owner);
      const ratio = capacity > 0 ? load / capacity : (load > 0 ? Number.POSITIVE_INFINITY : 0);
      const cell = document.createElement("div");
      cell.className = `capacity-cell ${getCapacityLevel(ratio)}`;
      cell.textContent = load ? (Number.isFinite(ratio) ? `${Math.round(ratio * 100)}%` : "Over") : "";
      cell.title = `${owner} on ${formatShortDate(day)}: ${formatCapacityValue(load)} demand / ${formatCapacityValue(capacity)} capacity`;
      row.append(cell);
    });

    capacityHeatmap.append(row);
  });
}

function capacityHeaderRow(days) {
  const row = document.createElement("div");
  row.className = "capacity-row capacity-date-row";

  const spacer = document.createElement("div");
  spacer.className = "capacity-owner";
  spacer.textContent = "Owner";
  row.append(spacer);

  days.forEach((day) => {
    const cell = document.createElement("div");
    cell.className = "capacity-date";
    cell.textContent = day.slice(5).replace("-", "/");
    cell.title = formatShortDate(day);
    row.append(cell);
  });

  return row;
}

function renderDevopsPanel() {
  const devops = state.devops;
  devopsOrgInput.value = devops.config.org || DEFAULT_DEVOPS_ORG;
  devopsProjectInput.value = devops.config.project || DEFAULT_DEVOPS_PROJECT;
  devopsProjectStartInput.value = devops.config.projectStartDate || toIsoDate(new Date());
  devopsTokenInput.value = localStorage.getItem(DEVOPS_TOKEN_KEY) || "";
  devopsWiqlInput.value = devops.config.wiql || DEFAULT_WIQL;
  renderDevopsFilters();
  devopsInboxList.textContent = "";

  const counts = getDevopsInboxCounts();
  const visibleItems = getFilteredDevopsInboxItems();
  devopsInboxSummary.textContent = `${visibleItems.length} shown | ${counts.new} new | ${counts.changed} updated | ${counts.ignored} ignored`;

  if (!devops.inbox.length) {
    const empty = document.createElement("div");
    empty.className = "inbox-empty";
    empty.textContent = "No DevOps items in the inbox yet.";
    devopsInboxList.append(empty);
    return;
  }

  if (!visibleItems.length) {
    const empty = document.createElement("div");
    empty.className = "inbox-empty";
    empty.textContent = "No inbox items match the current filters.";
    devopsInboxList.append(empty);
    return;
  }

  getGroupedDevopsInboxItems(visibleItems).forEach((statusGroup) => {
    devopsInboxList.append(renderDevopsStatusGroup(statusGroup));
  });
}

function renderDevopsStatusGroup(group) {
  const section = document.createElement("section");
  section.className = `inbox-group ${group.status}`;
  section.dataset.inboxGroup = group.key;

  section.append(inboxGroupHeader({
    key: group.key,
    title: group.label,
    detail: `${group.items.length} item${group.items.length === 1 ? "" : "s"}`,
    actionableCount: isDevopsInboxGroupCollapsed(group.key) ? 0 : group.actionableCount,
    level: "status"
  }));

  if (isDevopsInboxGroupCollapsed(group.key)) return section;

  group.items.forEach((item) => {
    section.append(renderDevopsInboxItem(item));
  });

  return section;
}

function renderDevopsInboxItem(item) {
  const row = document.createElement("article");
  row.className = `inbox-item ${item.status}`;
  row.dataset.externalId = item.externalId;

  const main = document.createElement("div");
  main.className = "inbox-main";

  if (isActionableDevopsItem(item)) {
    main.append(inboxSelection(item));
  }

  const title = document.createElement("h4");
  title.textContent = `#${item.externalId} ${item.title}`;

  const meta = document.createElement("p");
  meta.textContent = [
    item.workItemType,
    item.parentId ? `Parent #${item.parentId}${item.parentTitle ? ` ${item.parentTitle}` : ""}` : "",
    item.dueDate ? `Due ${formatShortDate(item.dueDate)}` : "",
    item.state,
    item.assignedTo || "Unassigned",
    item.changedDate ? `Changed ${formatDateTime(item.changedDate)}` : ""
  ].filter(Boolean).join(" | ");

  const paths = document.createElement("p");
  paths.className = "inbox-paths";
  paths.textContent = [item.areaPath, item.iterationPath, item.tags].filter(Boolean).join(" | ");

  main.append(title, meta);
  if (paths.textContent) main.append(paths);

  const controls = document.createElement("div");
  controls.className = "inbox-controls";

  if (item.status === "new") {
    controls.append(
      inboxInput("Group", "group", item.suggestedGroup || getLastGroupName()),
      inboxSelect("Type", "type", getTypeOptions(item.suggestedType), item.suggestedType || "task"),
      inboxInput("Start", "startDate", getDevopsProjectStartDate(), "date"),
      inboxInput("Days", "duration", "1", "number"),
      inboxAction("Add to plan", "add", item.externalId, "primary"),
      inboxAction("Ignore", "ignore", item.externalId)
    );
  } else if (item.status === "changed") {
    controls.append(
      inboxAction("Apply update", "update", item.externalId, "primary"),
      inboxAction("Ignore", "ignore", item.externalId)
    );
  } else if (item.status === "ignored") {
    controls.append(inboxAction("Unignore", "unignore", item.externalId));
  } else {
    const imported = document.createElement("span");
    imported.className = "inbox-badge";
    imported.textContent = "Already in plan";
    controls.append(imported);
  }

  row.append(main, controls);
  return row;
}

function getDevopsProjectStartDate() {
  return isIsoDate(state.devops.config.projectStartDate)
    ? state.devops.config.projectStartDate
    : toIsoDate(new Date());
}

function inboxGroupHeader({ key, title, detail, actionableCount, level }) {
  const header = document.createElement("div");
  header.className = `inbox-group-header ${level}`;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "inbox-group-toggle";
  toggle.dataset.inboxGroupToggle = key;
  toggle.setAttribute("aria-expanded", String(!isDevopsInboxGroupCollapsed(key)));
  toggle.textContent = `${isDevopsInboxGroupCollapsed(key) ? ">" : "v"} ${title}`;

  const count = document.createElement("span");
  count.textContent = detail;

  const actions = document.createElement("div");
  actions.className = "inbox-group-actions";

  if (actionableCount) {
    const selectAll = document.createElement("button");
    selectAll.type = "button";
    selectAll.dataset.inboxSelectGroup = key;
    selectAll.textContent = `Select all (${actionableCount})`;
    actions.append(selectAll);
  }

  header.append(toggle, count, actions);
  return header;
}

function getGroupedDevopsInboxItems(items) {
  const statusOrder = ["new", "changed", "imported", "ignored"];
  const statusLabels = {
    new: "New items",
    changed: "Updates",
    imported: "Already in plan",
    ignored: "Ignored"
  };

  return statusOrder
    .map((status) => {
      const statusItems = items.filter((item) => item.status === status);
      if (!statusItems.length) return null;

      return {
        key: `status:${status}`,
        status,
        label: statusLabels[status] || getStatusLabel(status),
        items: statusItems.slice().sort(compareDevopsInboxItems),
        actionableCount: statusItems.filter(isActionableDevopsItem).length
      };
    })
    .filter(Boolean);
}

function compareDevopsInboxItems(a, b) {
  const changed = String(b.changedDate || "").localeCompare(String(a.changedDate || ""));
  if (changed) return changed;
  const aId = Number(a.externalId);
  const bId = Number(b.externalId);
  if (Number.isFinite(aId) && Number.isFinite(bId)) return aId - bId;
  return String(a.externalId).localeCompare(String(b.externalId));
}

function toggleDevopsInboxGroup(key) {
  if (!key) return;
  if (collapsedDevopsGroups.has(key)) {
    collapsedDevopsGroups.delete(key);
  } else {
    collapsedDevopsGroups.add(key);
  }
  saveCollapsedDevopsGroups();
  renderDevopsPanel();
}

function selectDevopsInboxGroup(button) {
  const group = button.closest("[data-inbox-group]");
  if (!group) return;
  group.querySelectorAll("[data-inbox-select-id]").forEach((checkbox) => {
    checkbox.checked = true;
  });
}

function isDevopsInboxGroupCollapsed(key) {
  return collapsedDevopsGroups.has(key);
}

function inboxSelection(item) {
  const label = document.createElement("label");
  label.className = "inbox-select";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.dataset.inboxSelectId = item.externalId;
  label.append(checkbox, document.createTextNode("Sync"));
  return label;
}

function renderDevopsFilters() {
  const currentType = state.devops.filters.type || "";
  const typeOptions = getDevopsInboxTypeOptions();
  devopsTypeFilter.textContent = "";

  typeOptions.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    devopsTypeFilter.append(option);
  });

  devopsTypeFilter.value = typeOptions.some(([value]) => value === currentType) ? currentType : "";
  devopsStatusFilter.value = state.devops.filters.status || "";
}

function getDevopsInboxTypeOptions() {
  const options = [["", "All types"]];
  const seen = new Set();

  state.devops.inbox.forEach((item) => {
    const type = normalizeTaskType(item.workItemType || item.suggestedType);
    if (seen.has(type)) return;
    seen.add(type);
    options.push([type, getTypeLabel(type)]);
  });

  return options;
}

function getFilteredDevopsInboxItems() {
  const typeFilter = state.devops.filters.type || "";
  const statusFilter = state.devops.filters.status || "";

  return state.devops.inbox.filter((item) => {
    const itemType = normalizeTaskType(item.workItemType || item.suggestedType);
    if (typeFilter && itemType !== typeFilter) return false;
    if (statusFilter && item.status !== statusFilter) return false;
    return true;
  });
}

function inboxInput(label, name, value, type = "text") {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const input = document.createElement("input");
  input.dataset.inboxField = name;
  input.type = type;
  input.value = value;
  if (type === "number") {
    input.min = "1";
    input.step = "1";
  }
  wrapper.append(input);
  return wrapper;
}

function inboxSelect(label, name, options, value) {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const select = document.createElement("select");
  select.dataset.inboxField = name;

  options.forEach(([optionValue, optionLabel]) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionLabel;
    select.append(option);
  });

  select.value = value;
  wrapper.append(select);
  return wrapper;
}

function inboxAction(label, action, externalId, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.externalId = externalId;
  if (className) button.className = className;
  return button;
}

function syncDevopsInboxItems(mode) {
  let synced = 0;
  const rows = Array.from(devopsInboxList.querySelectorAll(".inbox-item"));

  rows.forEach((row) => {
    const item = state.devops.inbox.find((candidate) => String(candidate.externalId) === String(row.dataset.externalId));
    if (!item || !isActionableDevopsItem(item)) return;

    const selected = row.querySelector("[data-inbox-select-id]")?.checked;
    if (mode === "selected" && !selected) return;

    if (item.status === "new") {
      addDevopsItemToPlan(item, row);
      synced += 1;
    } else if (item.status === "changed") {
      applyDevopsUpdate(item);
      synced += 1;
    }
  });

  if (synced) {
    orderTasksByDependencies();
    saveAndRender();
    renderDevopsPanel();
  }

  return synced;
}

function isActionableDevopsItem(item) {
  return item.status === "new" || item.status === "changed";
}

async function syncDevopsInbox(source = "form") {
  const config = source === "saved" ? getSavedDevopsConfig() : getDevopsFormConfig();
  const token = source === "saved" ? localStorage.getItem(DEVOPS_TOKEN_KEY) || "" : devopsTokenInput.value.trim();

  if (!config.org || !config.project || !token) {
    setDevopsStatus("Organization, project, and token are required.", true);
    if (source === "saved") {
      renderDevopsPanel();
      devopsDialog.showModal();
    }
    return;
  }

  state.devops.config = config;
  localStorage.setItem(DEVOPS_TOKEN_KEY, token);
  setDevopsStatus("Fetching work item IDs...");
  syncDevopsBtn.disabled = true;
  openDevopsBtn.disabled = true;

  try {
    const ids = await fetchDevopsWorkItemIds(config, token);
    setDevopsStatus(`Fetching ${ids.length} work item${ids.length === 1 ? "" : "s"}...`);
    const workItems = await fetchDevopsWorkItems(config, token, ids);
    const syncableWorkItems = workItems.filter(isSyncableDevopsWorkItem);
    const parentIds = getDevopsParentIds(syncableWorkItems);
    const parentTitles = parentIds.length ? await fetchDevopsParentTitles(config, token, parentIds) : new Map();
    state.devops.inbox = mergeDevopsInbox(syncableWorkItems.map((item) => mapDevopsWorkItem(item, config, parentTitles)));
    saveAndRender();
    renderDevopsPanel();
    setDevopsStatus(`Synced ${syncableWorkItems.length} task/bug item${syncableWorkItems.length === 1 ? "" : "s"}.`);
  } catch (error) {
    setDevopsStatus(error.message || "DevOps sync failed.", true);
  } finally {
    syncDevopsBtn.disabled = false;
    openDevopsBtn.disabled = false;
  }
}

function getSavedDevopsConfig() {
  const config = state.devops.config || {};
  return {
    org: config.org || DEFAULT_DEVOPS_ORG,
    project: config.project || DEFAULT_DEVOPS_PROJECT,
    projectStartDate: isIsoDate(config.projectStartDate) ? config.projectStartDate : toIsoDate(new Date()),
    wiql: config.wiql || DEFAULT_WIQL
  };
}

function getDevopsFormConfig() {
  return {
    org: devopsOrgInput.value.trim(),
    project: devopsProjectInput.value.trim(),
    projectStartDate: isIsoDate(devopsProjectStartInput.value) ? devopsProjectStartInput.value : toIsoDate(new Date()),
    wiql: devopsWiqlInput.value.trim() || DEFAULT_WIQL
  };
}

async function fetchDevopsWorkItemIds(config, token) {
  const data = await fetchDevopsJson(`${getDevopsProjectUrl(config)}/_apis/wit/wiql?api-version=7.1`, {
    method: "POST",
    headers: devopsHeaders(token),
    body: JSON.stringify({ query: config.wiql })
  });
  return (data.workItems || []).map((item) => item.id);
}

async function fetchDevopsWorkItems(config, token, ids) {
  const batches = chunk(ids, 200);
  const results = [];

  for (const batch of batches) {
    const url = `${getDevopsProjectUrl(config)}/_apis/wit/workitems?ids=${batch.join(",")}&$expand=Relations&errorPolicy=Omit&api-version=7.1`;
    const data = await fetchDevopsJson(url, { headers: devopsHeaders(token) });
    results.push(...(data.value || []));
  }

  return results;
}

function isSyncableDevopsWorkItem(workItem) {
  const type = String(workItem.fields?.["System.WorkItemType"] || "").trim().toLowerCase();
  return type === "task" || type === "bug";
}

function getDevopsParentIds(workItems) {
  return Array.from(new Set(workItems.map(getDevopsParentId).filter(Boolean)));
}

async function fetchDevopsParentTitles(config, token, parentIds) {
  setDevopsStatus(`Fetching ${parentIds.length} parent item${parentIds.length === 1 ? "" : "s"}...`);
  const parentWorkItems = await fetchDevopsWorkItems(config, token, parentIds);
  return new Map(parentWorkItems.map((item) => [
    String(item.id),
    item.fields?.["System.Title"] || `Work item ${item.id}`
  ]));
}

async function readDevopsResponse(response) {
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Azure DevOps returned a response that was not JSON.");
    }
  }

  if (!response.ok) {
    const error = new Error(data.message || `Azure DevOps request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }

  return data;
}

async function fetchDevopsJson(url, options = {}, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      return await readDevopsResponse(response);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryableDevopsError(error)) break;
      setDevopsStatus(`Connection issue. Retrying ${attempt + 1} of ${retries}...`);
      await sleep(600 * (attempt + 1));
    }
  }
  throw lastError;
}

function isRetryableDevopsError(error) {
  if (!error.status) return true;
  return error.status === 408 || error.status === 429 || error.status >= 500;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapDevopsWorkItem(workItem, config, parentTitles = new Map()) {
  const fields = workItem.fields || {};
  const externalId = String(workItem.id);
  const title = fields["System.Title"] || `Work item ${externalId}`;
  const parentId = getDevopsParentId(workItem);
  const parentTitle = parentId ? parentTitles.get(parentId) || "" : "";
  const mapped = {
    externalId,
    title,
    workItemType: fields["System.WorkItemType"] || "",
    state: fields["System.State"] || "",
    assignedTo: fields["System.AssignedTo"]?.displayName || fields["System.AssignedTo"] || "",
    areaPath: fields["System.AreaPath"] || "",
    iterationPath: fields["System.IterationPath"] || "",
    tags: fields["System.Tags"] || "",
    changedDate: fields["System.ChangedDate"] || "",
    parentId,
    parentTitle,
    dueDate: getDevopsDueDate(fields),
    url: `${getDevopsProjectUrl(config)}/_workitems/edit/${externalId}`,
    suggestedGroup: parentTitle || getPathLeaf(fields["System.AreaPath"]) || getLastGroupName(),
    suggestedType: getDevopsTaskType(fields["System.WorkItemType"], title)
  };
  mapped.signature = getDevopsSignature(mapped);
  return mapped;
}

function mergeDevopsInbox(items) {
  const ignored = new Set(state.devops.ignoredIds.map(String));
  const previousById = new Map(state.devops.inbox.map((item) => [String(item.externalId), item]));
  const taskByExternalId = new Map(
    state.tasks
      .filter((task) => task.source === "azure-devops" && task.externalId)
      .map((task) => [String(task.externalId), task])
  );

  return items.map((item) => {
    const existingTask = taskByExternalId.get(String(item.externalId));
    const previous = previousById.get(String(item.externalId));
    const base = { ...previous, ...item };

    if (ignored.has(String(item.externalId))) {
      return { ...base, status: "ignored" };
    }

    if (!existingTask) {
      return { ...base, status: "new" };
    }

    if (existingTask.externalSignature !== item.signature) {
      return { ...base, status: "changed", localTaskId: existingTask.id };
    }

    return { ...base, status: "imported", localTaskId: existingTask.id };
  });
}

function addDevopsItemToPlan(item, row) {
  const group = row.querySelector('[data-inbox-field="group"]')?.value.trim() || item.suggestedGroup || "";
  const type = normalizeTaskType(row.querySelector('[data-inbox-field="type"]')?.value || item.workItemType || item.suggestedType);
  const startDate = row.querySelector('[data-inbox-field="startDate"]')?.value || toIsoDate(new Date());
  const duration = Math.max(1, Number.parseInt(row.querySelector('[data-inbox-field="duration"]')?.value, 10) || 1);
  const task = {
    id: makeId(),
    taskId: String(item.externalId),
    name: item.title,
    group,
    type,
    owner: item.assignedTo || "",
    startDate: isIsoDate(startDate) ? startDate : toIsoDate(new Date()),
    planningMonth: (isIsoDate(startDate) ? startDate : toIsoDate(new Date())).slice(0, 7),
    duration: isMilestoneType(type) ? 1 : duration,
    dependsOn: item.parentId || "",
    dueDate: item.dueDate || "",
    status: getDevopsStatus(item.state),
    notes: `Azure DevOps #${item.externalId}`,
    source: "azure-devops",
    externalId: item.externalId,
    externalUrl: item.url,
    externalSignature: item.signature,
    externalChangedDate: item.changedDate
  };
  insertTaskInGroup(task);
  item.status = "imported";
  item.localTaskId = task.id;
}

function applyDevopsUpdate(item) {
  const task = state.tasks.find((candidate) => candidate.source === "azure-devops" && String(candidate.externalId) === String(item.externalId));
  if (!task) return;

  if (task.taskId !== item.externalId) {
    const previousTaskId = task.taskId;
    task.taskId = item.externalId;
    state.tasks.forEach((candidate) => {
      if (candidate.dependsOn === previousTaskId) candidate.dependsOn = task.taskId;
    });
  }
  task.name = item.title;
  task.type = normalizeTaskType(item.workItemType || item.suggestedType || task.type);
  if (isMilestoneType(task.type)) task.duration = 1;
  task.owner = item.assignedTo || "";
  task.dependsOn = item.parentId || "";
  if (item.parentTitle) task.group = item.parentTitle;
  if (item.dueDate) task.dueDate = item.dueDate;
  task.status = getDevopsStatus(item.state);
  task.externalUrl = item.url;
  task.externalSignature = item.signature;
  task.externalChangedDate = item.changedDate;
  item.status = "imported";
  item.localTaskId = task.id;
}

function ignoreDevopsItem(item) {
  if (!state.devops.ignoredIds.includes(String(item.externalId))) {
    state.devops.ignoredIds.push(String(item.externalId));
  }
  item.status = "ignored";
}

function unignoreDevopsItem(item) {
  state.devops.ignoredIds = state.devops.ignoredIds.filter((id) => String(id) !== String(item.externalId));
  const task = state.tasks.find((candidate) => candidate.source === "azure-devops" && String(candidate.externalId) === String(item.externalId));
  item.status = task ? (task.externalSignature !== item.signature ? "changed" : "imported") : "new";
}

function insertTaskInGroup(task) {
  const normalizedGroup = normalizeGroupName(task.group);
  let insertAt = state.tasks.length;

  state.tasks.forEach((item, index) => {
    if (normalizeGroupName(item.group) === normalizedGroup) insertAt = index + 1;
  });

  state.tasks.splice(insertAt, 0, task);
}

function getPlanningBuckets() {
  const visibleMonths = getVisiblePlanningMonths();
  return [
    { kind: "unscheduled", label: "Unscheduled" },
    ...visibleMonths.map((month) => ({ kind: "month", month, label: formatPlanningMonth(month) })),
    { kind: "future", label: "Future" },
    { kind: "done", label: "Done" }
  ];
}

function getVisiblePlanningMonths() {
  const months = new Set();
  const currentMonth = toIsoDate(new Date()).slice(0, 7);
  const futureCutoff = addMonths(currentMonth, planningMonthCount);

  for (let offset = 0; offset < planningMonthCount; offset += 1) {
    months.add(addMonths(currentMonth, offset));
  }

  state.tasks.forEach((task) => {
    const month = normalizePlanningMonth(task.planningMonth, task.startDate);
    if (month && comparePlanningMonths(month, futureCutoff) < 0) months.add(month);
  });

  return Array.from(months).sort(comparePlanningMonths);
}

function getPlanningBucketTasks(bucket) {
  return state.tasks.filter((task) => {
    if (bucket.kind === "done") return isDoneStatus(task.status);
    if (isDoneStatus(task.status)) return false;

    const month = normalizePlanningMonth(task.planningMonth, "");
    if (bucket.kind === "unscheduled") return !month;
    if (bucket.kind === "month") return month === bucket.month;
    if (bucket.kind === "future") {
      const visibleMonths = getVisiblePlanningMonths();
      return month && !visibleMonths.includes(month);
    }
    return false;
  });
}

function getPlanningBucketSummary(bucket, tasks) {
  const count = tasks.length;
  const demand = getPlanningDemand(tasks);
  const bugs = tasks.filter((task) => normalizeTaskType(task.type).toLowerCase() === "bug").length;
  const unassigned = tasks.filter((task) => !task.owner.trim()).length;
  const parts = [`${count} ticket${count === 1 ? "" : "s"}`];
  if (demand) parts.push(`${demand}d demand`);
  if (bugs) parts.push(`${bugs} bug${bugs === 1 ? "" : "s"}`);
  if (unassigned) parts.push(`${unassigned} unassigned`);

  if (bucket.kind === "month") {
    const capacity = getPlanningMonthCapacity(bucket.month);
    if (capacity) parts.push(`${Math.round((demand / capacity) * 100)}% cap`);
  }

  return parts.join(" | ");
}

function getPlanningDemand(tasks) {
  return tasks
    .filter((task) => !isDoneStatus(task.status) && !isMilestoneType(task.type))
    .reduce((total, task) => total + Math.max(1, Number.parseInt(task.duration, 10) || 1), 0);
}

function getPlanningMonthCapacity(month) {
  const owners = getCapacityOwners();
  if (!owners.length) return 0;
  const days = getBusinessDaysInMonth(month);
  return owners.reduce((total, owner) => total + (getOwnerCapacity(owner) * days), 0);
}

function moveTaskToPlanningBucket(taskId, bucket, month) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return false;
  const previousMonth = task.planningMonth || "";
  const previousStatus = task.status;

  if (bucket === "unscheduled") {
    task.planningMonth = "";
    if (isDoneStatus(task.status)) task.status = "not-started";
  } else if (bucket === "month") {
    task.planningMonth = normalizePlanningMonth(month, "");
    if (isDoneStatus(task.status)) task.status = "not-started";
  } else if (bucket === "future") {
    task.planningMonth = addMonths(toIsoDate(new Date()).slice(0, 7), planningMonthCount);
    if (isDoneStatus(task.status)) task.status = "not-started";
  } else if (bucket === "done") {
    task.status = "done";
  }

  return previousMonth !== (task.planningMonth || "") || previousStatus !== task.status;
}

function clearPlanningDropState() {
  planningBoard.querySelectorAll(".drop-target, .dragging").forEach((item) => {
    item.classList.remove("drop-target", "dragging");
  });
}

function moveTaskToGroup(task, nextGroup, previousGroup) {
  const nextGroupName = normalizeGroupName(nextGroup);
  if (nextGroupName === previousGroup) {
    task.group = nextGroup;
    return;
  }

  const targetGroupExists = state.tasks.some((item) => (
    item.id !== task.id && normalizeGroupName(item.group) === nextGroupName
  ));

  task.group = nextGroup;
  if (!targetGroupExists) return;

  const withoutTask = state.tasks.filter((item) => item.id !== task.id);
  let insertAt = withoutTask.length;
  withoutTask.forEach((item, index) => {
    if (normalizeGroupName(item.group) === nextGroupName) insertAt = index + 1;
  });

  withoutTask.splice(insertAt, 0, task);
  state.tasks = withoutTask;
}

function getDragTargetRow(event) {
  if (!draggedTaskId || draggedGroupName) return null;
  const row = event.target.closest("tr[data-task-id], tr.table-group-row[data-group-name]");
  if (!row || row.dataset.taskId === draggedTaskId) return null;
  return row;
}

function getGroupDragTargetRow(event) {
  if (!draggedGroupName) return null;
  const row = event.target.closest("tr.table-group-row[data-group-name]");
  if (!row || row.dataset.groupName === draggedGroupName) return null;
  return row;
}

function getDropPosition(event, row) {
  const rect = row.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

function clearDropIndicators() {
  taskTableBody.querySelectorAll(".drop-before, .drop-after").forEach((row) => {
    row.classList.remove("drop-before", "drop-after");
  });
}

function moveDraggedTask(sourceId, targetRow, position) {
  if (!sourceId || !targetRow) return false;

  const sourceTask = state.tasks.find((task) => task.id === sourceId);
  if (!sourceTask) return false;

  const isGroupHeader = targetRow.classList.contains("table-group-row");
  const targetTaskId = isGroupHeader ? "" : targetRow.dataset.taskId;
  if (targetTaskId === sourceId) return false;

  const targetGroupName = isGroupHeader
    ? normalizeGroupName(targetRow.dataset.groupName)
    : normalizeGroupName(state.tasks.find((task) => task.id === targetTaskId)?.group);
  if (!targetGroupName) return false;

  const remaining = state.tasks.filter((task) => task.id !== sourceId);

  let insertAt;
  if (isGroupHeader) {
    const firstGroupIndex = remaining.findIndex((task) => normalizeGroupName(task.group) === targetGroupName);
    insertAt = firstGroupIndex < 0 ? remaining.length : firstGroupIndex;
  } else {
    const targetIndex = remaining.findIndex((task) => task.id === targetTaskId);
    if (targetIndex < 0) return false;
    insertAt = position === "after" ? targetIndex + 1 : targetIndex;
  }

  const previousGroupName = normalizeGroupName(sourceTask.group);
  if (previousGroupName !== targetGroupName) {
    sourceTask.group = targetGroupName === "Ungrouped" ? "" : targetGroupName;
  }

  remaining.splice(insertAt, 0, sourceTask);

  if (state.tasks.every((task, index) => task.id === remaining[index]?.id)) return false;

  state.tasks = remaining;
  return true;
}

function reorderGroup(sourceGroupName, targetGroupName, position) {
  const sourceName = normalizeGroupName(sourceGroupName);
  const targetName = normalizeGroupName(targetGroupName);
  if (!sourceName || !targetName || sourceName === targetName) return false;

  const groups = getTaskGroups();
  const sourceIndex = groups.findIndex((group) => group.name === sourceName);
  const targetIndex = groups.findIndex((group) => group.name === targetName);
  if (sourceIndex < 0 || targetIndex < 0) return false;

  const reorderedGroups = groups.slice();
  const [movedGroup] = reorderedGroups.splice(sourceIndex, 1);
  let insertAt = reorderedGroups.findIndex((group) => group.name === targetName);
  if (position === "after") insertAt += 1;
  reorderedGroups.splice(insertAt, 0, movedGroup);

  if (groups.every((group, index) => group.name === reorderedGroups[index].name)) return false;

  state.tasks = reorderedGroups.flatMap((group) => group.tasks);
  return true;
}

function normalizeDevopsState(devops) {
  const defaults = defaultDevopsState();
  if (!devops || typeof devops !== "object") return defaults;

  return {
    config: {
      org: typeof devops.config?.org === "string" && devops.config.org.trim() ? devops.config.org : DEFAULT_DEVOPS_ORG,
      project: typeof devops.config?.project === "string" && devops.config.project.trim() ? devops.config.project : DEFAULT_DEVOPS_PROJECT,
      projectStartDate: isIsoDate(devops.config?.projectStartDate) ? devops.config.projectStartDate : toIsoDate(new Date()),
      wiql: typeof devops.config?.wiql === "string" && devops.config.wiql.trim() ? devops.config.wiql : DEFAULT_WIQL
    },
    inbox: Array.isArray(devops.inbox) ? devops.inbox.map(normalizeDevopsInboxItem).filter(Boolean) : [],
    ignoredIds: Array.isArray(devops.ignoredIds) ? devops.ignoredIds.map(String) : [],
    filters: normalizeDevopsFilters(devops.filters)
  };
}

function normalizeDevopsInboxItem(item) {
  if (!item || item.externalId == null) return null;
  return {
    externalId: String(item.externalId),
    title: typeof item.title === "string" ? item.title : `Work item ${item.externalId}`,
    workItemType: typeof item.workItemType === "string" ? item.workItemType : "",
    state: typeof item.state === "string" ? item.state : "",
    assignedTo: typeof item.assignedTo === "string" ? item.assignedTo : "",
    areaPath: typeof item.areaPath === "string" ? item.areaPath : "",
    iterationPath: typeof item.iterationPath === "string" ? item.iterationPath : "",
    tags: typeof item.tags === "string" ? item.tags : "",
    changedDate: typeof item.changedDate === "string" ? item.changedDate : "",
    parentId: item.parentId == null ? "" : String(item.parentId),
    parentTitle: typeof item.parentTitle === "string" ? item.parentTitle : "",
    dueDate: isIsoDate(item.dueDate) ? item.dueDate : "",
    url: typeof item.url === "string" ? item.url : "",
    signature: typeof item.signature === "string" ? item.signature : "",
    status: ["new", "changed", "imported", "ignored"].includes(item.status) ? item.status : "new",
    localTaskId: typeof item.localTaskId === "string" ? item.localTaskId : "",
    suggestedGroup: typeof item.suggestedGroup === "string" && item.suggestedGroup ? item.suggestedGroup : (typeof item.parentTitle === "string" ? item.parentTitle : ""),
    suggestedType: normalizeTaskType(item.suggestedType || item.workItemType)
  };
}

function defaultDevopsState() {
  return {
    config: {
      org: DEFAULT_DEVOPS_ORG,
      project: DEFAULT_DEVOPS_PROJECT,
      projectStartDate: toIsoDate(new Date()),
      wiql: DEFAULT_WIQL
    },
    inbox: [],
    ignoredIds: [],
    filters: defaultDevopsFilters()
  };
}

function normalizeCapacityState(capacity) {
  const defaults = defaultCapacityState();
  if (!capacity || typeof capacity !== "object") return defaults;

  const owners = {};
  Object.entries(capacity.owners || {}).forEach(([owner, value]) => {
    const normalizedOwner = normalizeOwnerName(owner);
    if (normalizedOwner) owners[normalizedOwner] = normalizeCapacityValue(value, defaults.defaultDaily);
  });

  return {
    defaultDaily: normalizeCapacityValue(capacity.defaultDaily, defaults.defaultDaily),
    owners
  };
}

function defaultCapacityState() {
  return {
    defaultDaily: 1,
    owners: {}
  };
}

function normalizeDevopsFilters(filters) {
  if (!filters || typeof filters !== "object") return defaultDevopsFilters();
  return {
    type: typeof filters.type === "string" ? filters.type : "",
    status: ["", "new", "changed", "imported", "ignored"].includes(filters.status) ? filters.status : ""
  };
}

function defaultDevopsFilters() {
  return {
    type: "",
    status: ""
  };
}

function getDevopsInboxCounts() {
  const counts = { new: 0, changed: 0, imported: 0, ignored: 0 };
  state.devops.inbox.forEach((item) => {
    if (counts[item.status] != null) counts[item.status] += 1;
  });
  return counts;
}

function setDevopsStatus(message, isError = false) {
  devopsStatus.textContent = message;
  devopsStatus.classList.toggle("error", isError);
}

function devopsHeaders(token) {
  return {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": `Basic ${btoa(`:${token}`)}`
  };
}

function getDevopsProjectUrl(config) {
  return `${getDevopsOrgUrl(config.org)}/${encodeURIComponent(config.project)}`;
}

function getDevopsOrgUrl(value) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://dev.azure.com/${encodeURIComponent(trimmed)}`;
}

function getDevopsParentId(workItem) {
  const parentRelation = (workItem.relations || []).find((relation) => (
    relation.rel === "System.LinkTypes.Hierarchy-Reverse"
    || relation.attributes?.name === "Parent"
  ));
  if (!parentRelation?.url) return "";
  return parentRelation.url.split("/").filter(Boolean).at(-1) || "";
}

function getDevopsDueDate(fields) {
  const value = fields["Microsoft.VSTS.Scheduling.DueDate"]
    || fields["Microsoft.VSTS.Scheduling.TargetDate"]
    || fields["System.DueDate"];
  if (!value) return "";
  if (isIsoDate(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return toIsoDate(date);
}

function getDevopsSignature(item) {
  return JSON.stringify({
    title: item.title,
    workItemType: item.workItemType,
    state: item.state,
    status: getDevopsStatus(item.state),
    assignedTo: item.assignedTo,
    areaPath: item.areaPath,
    iterationPath: item.iterationPath,
    tags: item.tags,
    changedDate: item.changedDate,
    parentId: item.parentId,
    parentTitle: item.parentTitle,
    dueDate: item.dueDate
  });
}

function getDevopsStatus(value) {
  return normalizeTaskStatus(value);
}

function getDevopsTaskType(type, title) {
  const workItemType = normalizeTaskType(type);
  if (workItemType !== "task") return workItemType;
  return /milestone/i.test(title || "") ? "milestone" : "task";
}

function getPathLeaf(path) {
  if (!path) return "";
  return String(path).split("\\").filter(Boolean).at(-1) || "";
}

function getLastGroupName() {
  const lastTask = state.tasks.at(-1);
  return lastTask ? normalizeGroupName(lastTask.group) : "";
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function labelCell(title, detail) {
  const cell = document.createElement("div");
  cell.className = "gantt-label";
  const strong = document.createElement("strong");
  strong.textContent = title;
  cell.append(strong);
  if (detail) {
    const span = document.createElement("span");
    span.textContent = detail;
    cell.append(span);
  }
  return cell;
}

function getTaskGroups() {
  const groups = [];
  const groupByName = new Map();

  state.tasks.forEach((task) => {
    const name = normalizeGroupName(task.group);
    if (!groupByName.has(name)) {
      const group = { name, tasks: [] };
      groups.push(group);
      groupByName.set(name, group);
    }
    groupByName.get(name).tasks.push(task);
  });

  return groups;
}

function getCapacityOwners() {
  const owners = new Set();
  state.tasks.forEach((task) => owners.add(normalizeOwnerName(task.owner)));
  Object.keys(state.capacity.owners || {}).forEach((owner) => owners.add(normalizeOwnerName(owner)));
  owners.delete("");
  return Array.from(owners).sort((a, b) => a.localeCompare(b));
}

function normalizeOwnerName(value) {
  const owner = typeof value === "string" ? value.trim() : "";
  return owner || "Unassigned";
}

function getOwnerCapacity(owner) {
  const key = normalizeOwnerName(owner);
  return normalizeCapacityValue(state.capacity.owners[key], state.capacity.defaultDaily);
}

function normalizeCapacityValue(value, fallback = 1) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed * 100) / 100;
}

function formatCapacityValue(value) {
  return Number(value || 0).toFixed(2).replace(/\.?0+$/, "");
}

function analyzeCapacity(range) {
  const days = range ? enumerateDays(range.start, range.end).filter((day) => !isWeekendIso(day)) : [];
  const owners = getCapacityOwners();
  const loads = new Map(owners.map((owner) => [owner, new Map()]));

  state.tasks.forEach((task) => {
    if (!isCapacityDemandTask(task)) return;
    const owner = normalizeOwnerName(task.owner);
    if (!loads.has(owner)) loads.set(owner, new Map());
    getTaskBusinessDays(task).forEach((day) => {
      const ownerLoads = loads.get(owner);
      ownerLoads.set(day, (ownerLoads.get(day) || 0) + 1);
    });
  });

  const overloads = [];
  loads.forEach((ownerLoads, owner) => {
    const capacity = getOwnerCapacity(owner);
    ownerLoads.forEach((load, day) => {
      if (load > capacity) overloads.push({ owner, day, load, capacity });
    });
  });

  return {
    owners: Array.from(loads.keys()).sort((a, b) => a.localeCompare(b)),
    days,
    loads,
    overloads
  };
}

function isCapacityDemandTask(task) {
  return isIsoDate(task.startDate)
    && Number.isFinite(task.duration)
    && task.duration > 0
    && !isDoneStatus(task.status)
    && !isMilestoneType(task.type);
}

function getTaskBusinessDays(task) {
  const days = [];
  let cursor = task.startDate;
  while (days.length < Math.max(1, task.duration)) {
    if (!isWeekendIso(cursor)) days.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return days;
}

function getCapacityLevel(ratio) {
  if (!Number.isFinite(ratio)) return "over";
  if (ratio > 1) return "over";
  if (ratio >= 0.85) return "near";
  if (ratio > 0) return "ok";
  return "empty";
}

function normalizeGroupName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  return name || "Ungrouped";
}

function getTaskIdMap() {
  const map = new Map();
  state.tasks.forEach((task) => {
    const taskId = task.taskId.trim();
    if (taskId) map.set(taskId, task);

    const externalId = task.externalId == null ? "" : String(task.externalId).trim();
    if (task.source === "azure-devops" && externalId && !map.has(externalId)) {
      map.set(externalId, task);
    }
  });
  return map;
}

function getDuplicateTaskIds() {
  const seen = new Set();
  const duplicates = new Set();
  state.tasks.forEach((task) => {
    const taskId = task.taskId.trim();
    if (!taskId) return;
    if (seen.has(taskId)) duplicates.add(taskId);
    seen.add(taskId);
  });
  return duplicates;
}

function getNextTaskId() {
  const used = new Set(state.tasks.map((task) => task.taskId));
  let next = 1;
  while (used.has(String(next))) next += 1;
  return String(next);
}

function analyzeTasks() {
  const warnings = [];
  const taskByTaskId = getTaskIdMap();
  const duplicateTaskIds = getDuplicateTaskIds();
  const cycles = findCycleTaskIds(taskByTaskId);
  const today = toIsoDate(new Date());

  state.tasks.forEach((task) => {
    if (!task.taskId.trim()) {
      warnings.push({ taskId: task.id, type: "ID", message: `${task.name || "Untitled task"} needs an ID.` });
    }

    if (duplicateTaskIds.has(task.taskId)) {
      warnings.push({ taskId: task.id, type: "ID", message: `ID ${task.taskId} is used by more than one task.` });
    }

    if (!task.name.trim()) {
      warnings.push({ taskId: task.id, type: "Task", message: "A task is missing a name." });
    }

    if (!isIsoDate(task.startDate)) {
      warnings.push({ taskId: task.id, type: "Date", message: `${task.name || "Untitled task"} needs a valid start date.` });
    }

    if (isIsoDate(task.startDate) && isWeekendIso(task.startDate)) {
      warnings.push({ taskId: task.id, type: "Date", message: `${task.name || "Untitled task"} starts on a weekend.` });
    }

    if (!Number.isFinite(task.duration) || task.duration < 1) {
      warnings.push({ taskId: task.id, type: "Days", message: `${task.name || "Untitled task"} needs a duration of at least 1 day.` });
    }

    if (task.dependsOn && task.dependsOn === task.taskId) {
      warnings.push({ taskId: task.id, type: "Link", message: `${task.name || "Untitled task"} cannot depend on itself.` });
    } else if (task.dependsOn && !taskByTaskId.has(task.dependsOn)) {
      warnings.push({ taskId: task.id, type: "Link", message: `${task.name || "Untitled task"} depends on ID ${task.dependsOn}, but no task has that ID.` });
    }

    if (cycles.has(task.id)) {
      warnings.push({ taskId: task.id, type: "Loop", message: `${task.name || "Untitled task"} is part of a circular dependency.` });
    }

    const finishDate = getFinishDate(task);

    if (task.dependsOn && taskByTaskId.has(task.dependsOn) && !cycles.has(task.id)) {
      const dependency = taskByTaskId.get(task.dependsOn);
      const earliest = addBusinessDays(getFinishDate(dependency), 1);
      if (compareDates(task.startDate, earliest) < 0) {
        warnings.push({
          taskId: task.id,
          type: "Link",
          message: `${task.name || "Untitled task"} starts before ${dependency.name || "its dependency"} finishes. Earliest start is ${formatShortDate(earliest)}.`
        });
      }
    }

    if (task.dueDate && compareDates(finishDate, task.dueDate) > 0) {
      warnings.push({
        taskId: task.id,
        type: "Due",
        message: `${task.name || "Untitled task"} finishes ${formatShortDate(finishDate)}, after its due date ${formatShortDate(task.dueDate)}.`
      });
    }

    if (task.dueDate && compareDates(task.dueDate, today) < 0 && !isDoneStatus(task.status)) {
      warnings.push({
        taskId: task.id,
        type: "Due",
        message: `${task.name || "Untitled task"} has a past due date and is not done.`
      });
    }
  });

  const dates = [];
  state.tasks.forEach((task) => {
    if (isIsoDate(task.startDate)) dates.push(task.startDate);
    const finish = getFinishDate(task);
    if (isIsoDate(finish)) dates.push(finish);
    if (isIsoDate(task.dueDate)) dates.push(task.dueDate);
  });

  const range = dates.length
    ? {
        start: addCalendarDays(dates.sort(compareDates)[0], -2),
        end: addCalendarDays(dates.sort(compareDates)[dates.length - 1], 4)
      }
    : null;

  const projectFinish = state.tasks.length
    ? state.tasks.map(getFinishDate).sort(compareDates).at(-1)
    : "";

  const capacity = analyzeCapacity(range);
  capacity.overloads.forEach((overload) => {
    warnings.push({
      taskId: "",
      type: "Capacity",
      message: `${overload.owner} is over capacity on ${formatShortDate(overload.day)}: ${formatCapacityValue(overload.load)} demand / ${formatCapacityValue(overload.capacity)} capacity.`
    });
  });

  return { warnings, range, projectFinish, capacity };
}

function autoSchedule() {
  const { taskByTaskId, cycles, ordered } = orderTasksByDependencies();

  ordered.forEach((task) => {
    if (!task.dependsOn || cycles.has(task.id)) return;
    const dependency = taskByTaskId.get(task.dependsOn);
    if (!dependency) return;
    const earliest = addBusinessDays(getFinishDate(dependency), 1);
    if (compareDates(task.startDate, earliest) < 0) {
      task.startDate = earliest;
    }
  });
}

function orderTasksByDependencies() {
  const taskByTaskId = getTaskIdMap();
  const cycles = findCycleTaskIds(taskByTaskId);
  const ordered = getDependencyOrderedTasks(taskByTaskId, cycles);
  state.tasks = ordered;
  return { taskByTaskId, cycles, ordered };
}

function getDependencyOrderedTasks(taskByTaskId, cycles) {
  const ordered = [];
  const seen = new Set();

  state.tasks.forEach((task) => visit(task));
  return ordered;

  function visit(task) {
    if (seen.has(task.id)) return;
    seen.add(task.id);

    const dependency = task.dependsOn && !cycles.has(task.id)
      ? taskByTaskId.get(task.dependsOn)
      : null;

    if (dependency) visit(dependency);
    ordered.push(task);
  }
}

function findCycleTaskIds(taskByTaskId) {
  const visiting = new Set();
  const visited = new Set();
  const cycles = new Set();

  taskByTaskId.forEach((task) => walk(task, []));
  return cycles;

  function walk(task, path) {
    if (visited.has(task.id)) return;
    if (visiting.has(task.id)) {
      const start = path.indexOf(task.id);
      path.slice(Math.max(0, start)).forEach((id) => cycles.add(id));
      cycles.add(task.id);
      return;
    }

    visiting.add(task.id);
    const dependency = task.dependsOn ? taskByTaskId.get(task.dependsOn) : null;
    if (dependency) walk(dependency, [...path, task.id]);
    visiting.delete(task.id);
    visited.add(task.id);
  }
}

function groupWarningsByTask(warnings) {
  const map = new Map();
  warnings.forEach((warning) => {
    if (!warning.taskId) return;
    if (!map.has(warning.taskId)) map.set(warning.taskId, []);
    map.get(warning.taskId).push(warning);
  });
  return map;
}

function getFinishDate(task) {
  if (!isIsoDate(task.startDate)) return "";
  if (isMilestoneType(task.type)) return task.startDate;
  return addBusinessDays(task.startDate, Math.max(1, task.duration) - 1);
}

function addBusinessDays(isoDate, count) {
  let date = parseIsoDate(isoDate);
  let remaining = Math.abs(count);
  const direction = count < 0 ? -1 : 1;

  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + direction);
    if (isBusinessDay(date)) remaining -= 1;
  }

  return toIsoDate(date);
}

function addCalendarDays(isoDate, count) {
  const date = parseIsoDate(isoDate);
  date.setUTCDate(date.getUTCDate() + count);
  return toIsoDate(date);
}

function enumerateDays(startIso, endIso) {
  const days = [];
  let cursor = startIso;
  while (compareDates(cursor, endIso) <= 0) {
    days.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return days;
}

function isBusinessDay(date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function isWeekendIso(isoDate) {
  return !isBusinessDay(parseIsoDate(isoDate));
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseIsoDate(value);
  return !Number.isNaN(date.getTime()) && toIsoDate(date) === value;
}

function parseIsoDate(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`);
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function compareDates(a, b) {
  return a.localeCompare(b);
}

function normalizePlanningMonth(value, fallbackDate = "") {
  if (typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  return isIsoDate(fallbackDate) ? fallbackDate.slice(0, 7) : "";
}

function comparePlanningMonths(a, b) {
  return a.localeCompare(b);
}

function addMonths(month, count) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + count, 1));
  return date.toISOString().slice(0, 7);
}

function formatPlanningMonth(month) {
  const date = parseIsoDate(`${month}-01`);
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function getBusinessDaysInMonth(month) {
  const start = `${month}-01`;
  const end = addCalendarDays(`${addMonths(month, 1)}-01`, -1);
  return countBusinessDays(start, end);
}

function formatShortDate(isoDate) {
  if (!isIsoDate(isoDate)) return "";
  const date = parseIsoDate(isoDate);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatMonthLabel(isoDate) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(parseIsoDate(isoDate));
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function weekdayLabel(isoDate) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(parseIsoDate(isoDate)).slice(0, 2);
}

function dayCellClass(day, base) {
  return [
    base,
    isWeekendIso(day) ? "weekend" : "",
    day === toIsoDate(new Date()) ? "today" : ""
  ].filter(Boolean).join(" ");
}

function makeId() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeFileName(value) {
  return (value || "project-plan").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project-plan";
}

function toCsv() {
  const rows = [
    ["ID", "Task", "Group", "Type", "Owner", "Planning Month", "Start", "Duration", "Finish", "Depends On", "Due", "Status", "Notes", "Source", "External ID", "External URL"]
  ];
  state.tasks.forEach((task) => {
    rows.push([
      task.taskId,
      task.name,
      task.group,
      getTypeLabel(task.type),
      task.owner,
      task.planningMonth,
      task.startDate,
      String(task.duration),
      getFinishDate(task),
      task.dependsOn,
      task.dueDate,
      getStatusLabel(task.status),
      task.notes,
      task.source,
      task.externalId,
      task.externalUrl
    ]);
  });

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadFile(fileName, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
