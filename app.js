const STORAGE_KEY = "simple-gantt-planner-v1";
const CHECKS_VISIBLE_KEY = "simple-gantt-checks-visible-v1";
const DEVOPS_TOKEN_KEY = "simple-gantt-devops-token-v1";
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

const sampleTasks = [
  {
    id: makeId(),
    taskId: "1",
    name: "Project kickoff",
    group: "Planning",
    type: "milestone",
    owner: "",
    startDate: toIsoDate(new Date()),
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
const openDevopsBtn = document.querySelector("#openDevopsBtn");
const toggleChecksBtn = document.querySelector("#toggleChecksBtn");
const projectSummary = document.querySelector("#projectSummary");
const timelineSummary = document.querySelector("#timelineSummary");
const taskTableBody = document.querySelector("#taskTableBody");
const gantt = document.querySelector("#gantt");
const warningsList = document.querySelector("#warningsList");
const warningCount = document.querySelector("#warningCount");
const emptyStateTemplate = document.querySelector("#emptyStateTemplate");
const devopsDialog = document.querySelector("#devopsDialog");
const closeDevopsBtn = document.querySelector("#closeDevopsBtn");
const devopsOrgInput = document.querySelector("#devopsOrg");
const devopsProjectInput = document.querySelector("#devopsProject");
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
let draggedTaskId = "";

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

toggleChecksBtn.addEventListener("click", () => {
  checksVisible = !checksVisible;
  localStorage.setItem(CHECKS_VISIBLE_KEY, String(checksVisible));
  renderChecksToggle();
});

openDevopsBtn.addEventListener("click", () => {
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
  const action = event.target.dataset.action;
  const externalId = event.target.dataset.externalId;
  if (!action || !externalId) return;

  const inboxItem = state.devops.inbox.find((item) => String(item.externalId) === String(externalId));
  if (!inboxItem) return;

  if (action === "add") {
    addDevopsItemToPlan(inboxItem, event.target.closest(".inbox-item"));
  } else if (action === "update") {
    applyDevopsUpdate(inboxItem);
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
  state = { projectName: "Untitled Project", tasks: [], devops: defaultDevopsState() };
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
  const field = event.target.dataset.field;
  const id = event.target.dataset.id;
  if (!field || !id) return;

  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  const previousTaskId = task.taskId;
  if (field === "duration") {
    task.duration = Math.max(1, Number.parseInt(event.target.value, 10) || 1);
  } else if (field === "type") {
    task.type = normalizeTaskType(event.target.value);
    if (isMilestoneType(task.type)) task.duration = 1;
  } else if (field === "taskId" || field === "dependsOn") {
    task[field] = event.target.value.trim();
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

  saveAndRender();
});

taskTableBody.addEventListener("click", (event) => {
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
  const handle = event.target.closest("[data-drag-task-id]");
  if (!handle) return;

  draggedTaskId = handle.dataset.dragTaskId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedTaskId);
  handle.closest("tr")?.classList.add("dragging");
});

taskTableBody.addEventListener("dragover", (event) => {
  const targetRow = getDragTargetRow(event);
  if (!targetRow) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  clearDropIndicators();
  targetRow.classList.add(getDropPosition(event, targetRow) === "before" ? "drop-before" : "drop-after");
});

taskTableBody.addEventListener("dragleave", (event) => {
  if (!event.relatedTarget || !taskTableBody.contains(event.relatedTarget)) {
    clearDropIndicators();
  }
});

taskTableBody.addEventListener("drop", (event) => {
  const targetRow = getDragTargetRow(event);
  if (!targetRow) return;

  event.preventDefault();
  const moved = reorderTaskWithinGroup(draggedTaskId, targetRow.dataset.taskId, getDropPosition(event, targetRow));
  draggedTaskId = "";
  clearDropIndicators();
  if (moved) saveAndRender();
});

taskTableBody.addEventListener("dragend", () => {
  draggedTaskId = "";
  clearDropIndicators();
  taskTableBody.querySelectorAll(".dragging").forEach((row) => row.classList.remove("dragging"));
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
    devops: defaultDevopsState()
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
      duration: Math.max(1, Number.parseInt(task.duration || task.durationDays, 10) || 1),
      dependsOn: typeof task.dependsOn === "string" ? task.dependsOn.trim() : "",
      dueDate: isIsoDate(task.dueDate) ? task.dueDate : "",
      status: statusOptions.some(([value]) => value === task.status) ? task.status : "not-started",
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
    devops: normalizeDevopsState(raw.devops)
  };
}

function getRawTaskId(task, index) {
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

function saveAndRender() {
  saveState();
  render();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  const analysis = analyzeTasks();
  projectNameInput.value = state.projectName;
  renderChecksToggle(analysis);
  renderDevopsButton();
  renderSummary(analysis);
  renderTable(analysis);
  renderGantt(analysis);
  renderWarnings(analysis);
}

function renderDevopsButton() {
  const counts = getDevopsInboxCounts();
  const activeCount = counts.new + counts.changed;
  openDevopsBtn.textContent = activeCount ? `DevOps sync (${activeCount})` : "DevOps sync";
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
    cell.colSpan = 13;
    cell.append(emptyStateTemplate.content.cloneNode(true));
    row.append(cell);
    taskTableBody.append(row);
    return;
  }

  const warningsByTask = groupWarningsByTask(analysis.warnings);

  getTaskGroups().forEach((group) => {
    const groupRow = document.createElement("tr");
    groupRow.className = "table-group-row";
    const groupCell = document.createElement("td");
    groupCell.colSpan = 13;
    groupCell.textContent = `${group.name} (${group.tasks.length})`;
    groupRow.append(groupCell);
    taskTableBody.append(groupRow);

    group.tasks.forEach((task) => {
      const row = document.createElement("tr");
      row.dataset.taskId = task.id;
      row.dataset.group = normalizeGroupName(task.group);
      row.className = [
        warningsByTask.has(task.id) ? "has-warning" : "",
        task.status === "done" ? "done" : "",
        isMilestoneType(task.type) ? "milestone-task" : ""
      ].filter(Boolean).join(" ");

      row.append(
        inputCell(task, "taskId", "text"),
        taskNameCell(task),
        inputCell(task, "group", "text"),
        typeCell(task),
        inputCell(task, "owner", "text"),
        inputCell(task, "startDate", "date"),
        inputCell(task, "duration", "number"),
        readOnlyCell(getFinishDate(task)),
        inputCell(task, "dependsOn", "text"),
        inputCell(task, "dueDate", "date"),
        statusCell(task),
        inputCell(task, "notes", "text"),
        deleteCell(task)
      );

      taskTableBody.append(row);
    });
  });
}

function taskNameCell(task) {
  const cell = document.createElement("td");
  const wrapper = document.createElement("div");
  wrapper.className = "task-name-cell";

  const handle = document.createElement("button");
  handle.className = "drag-handle";
  handle.type = "button";
  handle.draggable = true;
  handle.dataset.dragTaskId = task.id;
  handle.title = "Drag to reorder within this group";
  handle.setAttribute("aria-label", `Reorder ${task.name || "task"}`);
  handle.textContent = "::";

  const input = createTaskInput(task, "name", "text");
  wrapper.append(handle, input);
  cell.append(wrapper);
  return cell;
}

function inputCell(task, field, type) {
  const cell = document.createElement("td");
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

function readOnlyCell(value) {
  const cell = document.createElement("td");
  const input = document.createElement("input");
  input.type = "text";
  input.readOnly = true;
  input.value = value;
  cell.append(input);
  return cell;
}

function typeCell(task) {
  const cell = document.createElement("td");
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
  const select = document.createElement("select");
  select.dataset.id = task.id;
  select.dataset.field = "status";

  statusOptions.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });

  select.value = task.status;
  cell.append(select);
  return cell;
}

function deleteCell(task) {
  const cell = document.createElement("td");
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
  const inner = document.createElement("div");
  inner.className = "gantt-inner";
  inner.style.width = `${230 + days.length * 34}px`;

  const header = document.createElement("div");
  header.className = "gantt-header";
  header.append(labelCell("Task", ""));

  const axis = document.createElement("div");
  axis.className = "axis";
  axis.style.gridTemplateColumns = `repeat(${days.length}, minmax(28px, 1fr))`;

  days.forEach((day) => {
    const cell = document.createElement("div");
    cell.className = dayCellClass(day, "axis-cell");
    cell.innerHTML = `<strong>${day.slice(8, 10)}</strong><br>${weekdayLabel(day)}`;
    axis.append(cell);
  });

  header.append(axis);
  inner.append(header);

  const warningTasks = groupWarningsByTask(analysis.warnings);

  getTaskGroups().forEach((group) => {
    const row = document.createElement("div");
    row.className = "gantt-group-row";
    row.append(labelCell(group.name, `${group.tasks.length}`));

    const track = document.createElement("div");
    track.className = "track group-track";
    track.style.gridTemplateColumns = `repeat(${days.length}, minmax(28px, 1fr))`;
    row.append(track);
    inner.append(row);

    group.tasks.forEach((task) => {
      const taskRow = document.createElement("div");
      taskRow.className = "gantt-row";
      taskRow.append(labelCell(task.name || "Untitled task", isMilestoneType(task.type) ? "Milestone" : `${task.duration}d`));

      const taskTrack = document.createElement("div");
      taskTrack.className = "track";
      taskTrack.style.gridTemplateColumns = `repeat(${days.length}, minmax(28px, 1fr))`;

      days.forEach((day) => {
        const cell = document.createElement("div");
        cell.className = dayCellClass(day, "day-cell");
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
            task.status === "done" ? "done" : "",
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
            task.status === "in-progress" ? "in-progress" : "",
            task.status === "done" ? "done" : "",
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

function renderDevopsPanel() {
  const devops = state.devops;
  devopsOrgInput.value = devops.config.org || DEFAULT_DEVOPS_ORG;
  devopsProjectInput.value = devops.config.project || DEFAULT_DEVOPS_PROJECT;
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

  visibleItems.forEach((item) => {
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
      item.parentId ? `Parent #${item.parentId}` : "",
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
        inboxInput("Start", "startDate", toIsoDate(new Date()), "date"),
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
    devopsInboxList.append(row);
  });
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
    saveAndRender();
    renderDevopsPanel();
  }

  return synced;
}

function isActionableDevopsItem(item) {
  return item.status === "new" || item.status === "changed";
}

async function syncDevopsInbox() {
  const config = {
    org: devopsOrgInput.value.trim(),
    project: devopsProjectInput.value.trim(),
    wiql: devopsWiqlInput.value.trim() || DEFAULT_WIQL
  };
  const token = devopsTokenInput.value.trim();

  if (!config.org || !config.project || !token) {
    setDevopsStatus("Organization, project, and token are required.", true);
    return;
  }

  state.devops.config = config;
  localStorage.setItem(DEVOPS_TOKEN_KEY, token);
  setDevopsStatus("Fetching work item IDs...");
  syncDevopsBtn.disabled = true;

  try {
    const ids = await fetchDevopsWorkItemIds(config, token);
    setDevopsStatus(`Fetching ${ids.length} work item${ids.length === 1 ? "" : "s"}...`);
    const workItems = await fetchDevopsWorkItems(config, token, ids);
    state.devops.inbox = mergeDevopsInbox(workItems.map((item) => mapDevopsWorkItem(item, config)));
    saveAndRender();
    renderDevopsPanel();
    setDevopsStatus(`Synced ${workItems.length} work item${workItems.length === 1 ? "" : "s"}.`);
  } catch (error) {
    setDevopsStatus(error.message || "DevOps sync failed.", true);
  } finally {
    syncDevopsBtn.disabled = false;
  }
}

async function fetchDevopsWorkItemIds(config, token) {
  const response = await fetch(`${getDevopsProjectUrl(config)}/_apis/wit/wiql?api-version=7.1`, {
    method: "POST",
    headers: devopsHeaders(token),
    body: JSON.stringify({ query: config.wiql })
  });
  const data = await readDevopsResponse(response);
  return (data.workItems || []).map((item) => item.id);
}

async function fetchDevopsWorkItems(config, token, ids) {
  const batches = chunk(ids, 200);
  const results = [];

  for (const batch of batches) {
    const url = `${getDevopsProjectUrl(config)}/_apis/wit/workitems?ids=${batch.join(",")}&$expand=Relations&errorPolicy=Omit&api-version=7.1`;
    const response = await fetch(url, { headers: devopsHeaders(token) });
    const data = await readDevopsResponse(response);
    results.push(...(data.value || []));
  }

  return results;
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
    throw new Error(data.message || `Azure DevOps request failed (${response.status}).`);
  }

  return data;
}

function mapDevopsWorkItem(workItem, config) {
  const fields = workItem.fields || {};
  const externalId = String(workItem.id);
  const title = fields["System.Title"] || `Work item ${externalId}`;
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
    parentId: getDevopsParentId(workItem),
    url: `${getDevopsProjectUrl(config)}/_workitems/edit/${externalId}`,
    suggestedGroup: getPathLeaf(fields["System.AreaPath"]) || getLastGroupName(),
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
    duration: isMilestoneType(type) ? 1 : duration,
    dependsOn: item.parentId || "",
    dueDate: "",
    status: mapDevopsStateToStatus(item.state),
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
  task.status = mapDevopsStateToStatus(item.state);
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

function getDragTargetRow(event) {
  if (!draggedTaskId) return null;
  const row = event.target.closest("tr[data-task-id]");
  if (!row || row.dataset.taskId === draggedTaskId) return null;

  const draggedTask = state.tasks.find((task) => task.id === draggedTaskId);
  if (!draggedTask || normalizeGroupName(draggedTask.group) !== row.dataset.group) return null;

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

function reorderTaskWithinGroup(sourceId, targetId, position) {
  if (!sourceId || !targetId || sourceId === targetId) return false;

  const sourceTask = state.tasks.find((task) => task.id === sourceId);
  const targetTask = state.tasks.find((task) => task.id === targetId);
  if (!sourceTask || !targetTask) return false;

  const groupName = normalizeGroupName(sourceTask.group);
  if (normalizeGroupName(targetTask.group) !== groupName) return false;

  const groupTasks = state.tasks.filter((task) => normalizeGroupName(task.group) === groupName);
  const sourceIndex = groupTasks.findIndex((task) => task.id === sourceId);
  const targetIndex = groupTasks.findIndex((task) => task.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return false;

  const reordered = groupTasks.slice();
  const [movedTask] = reordered.splice(sourceIndex, 1);
  let insertAt = reordered.findIndex((task) => task.id === targetId);
  if (position === "after") insertAt += 1;
  reordered.splice(insertAt, 0, movedTask);

  if (groupTasks.every((task, index) => task.id === reordered[index].id)) return false;

  let nextGroupIndex = 0;
  state.tasks = state.tasks.map((task) => (
    normalizeGroupName(task.group) === groupName ? reordered[nextGroupIndex++] : task
  ));
  return true;
}

function normalizeDevopsState(devops) {
  const defaults = defaultDevopsState();
  if (!devops || typeof devops !== "object") return defaults;

  return {
    config: {
      org: typeof devops.config?.org === "string" && devops.config.org.trim() ? devops.config.org : DEFAULT_DEVOPS_ORG,
      project: typeof devops.config?.project === "string" && devops.config.project.trim() ? devops.config.project : DEFAULT_DEVOPS_PROJECT,
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
    url: typeof item.url === "string" ? item.url : "",
    signature: typeof item.signature === "string" ? item.signature : "",
    status: ["new", "changed", "imported", "ignored"].includes(item.status) ? item.status : "new",
    localTaskId: typeof item.localTaskId === "string" ? item.localTaskId : "",
    suggestedGroup: typeof item.suggestedGroup === "string" ? item.suggestedGroup : "",
    suggestedType: normalizeTaskType(item.suggestedType || item.workItemType)
  };
}

function defaultDevopsState() {
  return {
    config: {
      org: DEFAULT_DEVOPS_ORG,
      project: DEFAULT_DEVOPS_PROJECT,
      wiql: DEFAULT_WIQL
    },
    inbox: [],
    ignoredIds: [],
    filters: defaultDevopsFilters()
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

function getDevopsSignature(item) {
  return JSON.stringify({
    title: item.title,
    workItemType: item.workItemType,
    state: item.state,
    assignedTo: item.assignedTo,
    areaPath: item.areaPath,
    iterationPath: item.iterationPath,
    tags: item.tags,
    changedDate: item.changedDate,
    parentId: item.parentId
  });
}

function mapDevopsStateToStatus(value) {
  const stateName = String(value || "").toLowerCase();
  if (["closed", "done", "resolved", "removed"].includes(stateName)) return "done";
  if (["active", "committed", "in progress", "doing"].includes(stateName)) return "in-progress";
  return "not-started";
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

function normalizeGroupName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  return name || "Ungrouped";
}

function getTaskIdMap() {
  return new Map(
    state.tasks
      .filter((task) => task.taskId.trim())
      .map((task) => [task.taskId.trim(), task])
  );
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

    if (task.dueDate && compareDates(task.dueDate, today) < 0 && task.status !== "done") {
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

  return { warnings, range, projectFinish };
}

function autoSchedule() {
  const taskByTaskId = getTaskIdMap();
  const cycles = findCycleTaskIds(taskByTaskId);
  const ordered = getDependencyOrderedTasks(taskByTaskId, cycles);
  state.tasks = ordered;

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

function formatShortDate(isoDate) {
  if (!isIsoDate(isoDate)) return "";
  const date = parseIsoDate(isoDate);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
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
    ["ID", "Task", "Group", "Type", "Owner", "Start", "Duration", "Finish", "Depends On", "Due", "Status", "Notes", "Source", "External ID", "External URL"]
  ];
  state.tasks.forEach((task) => {
    rows.push([
      task.taskId,
      task.name,
      task.group,
      getTypeLabel(task.type),
      task.owner,
      task.startDate,
      String(task.duration),
      getFinishDate(task),
      task.dependsOn,
      task.dueDate,
      statusOptions.find(([value]) => value === task.status)?.[1] || task.status,
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
