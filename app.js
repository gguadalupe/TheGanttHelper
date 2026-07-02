const STORAGE_KEY = "simple-gantt-planner-v1";
const CHECKS_VISIBLE_KEY = "simple-gantt-checks-visible-v1";
const DEFAULT_WIQL = [
  "SELECT [System.Id]",
  "FROM WorkItems",
  "WHERE [System.TeamProject] = @project",
  "AND [System.State] <> 'Closed'",
  "AND [System.State] <> 'Removed'",
  "ORDER BY [System.ChangedDate] DESC"
].join("\n");

const DEVOPS_FIELDS = [
  "System.Id",
  "System.Title",
  "System.WorkItemType",
  "System.State",
  "System.AssignedTo",
  "System.AreaPath",
  "System.IterationPath",
  "System.Tags",
  "System.ChangedDate"
];

const statusOptions = [
  ["not-started", "Not started"],
  ["in-progress", "In progress"],
  ["done", "Done"]
];

const typeOptions = [
  ["task", "Task"],
  ["milestone", "Milestone"]
];

const sampleTasks = [
  {
    id: makeId(),
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

sampleTasks[1].dependsOn = sampleTasks[0].id;
sampleTasks[2].dependsOn = sampleTasks[1].id;

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
const clearDevopsInboxBtn = document.querySelector("#clearDevopsInboxBtn");
const devopsStatus = document.querySelector("#devopsStatus");
const devopsInboxSummary = document.querySelector("#devopsInboxSummary");
const devopsInboxList = document.querySelector("#devopsInboxList");
let checksVisible = localStorage.getItem(CHECKS_VISIBLE_KEY) === "true";

document.querySelector("#addTaskBtn").addEventListener("click", () => {
  const lastTask = state.tasks[state.tasks.length - 1];
  const startDate = lastTask ? addBusinessDays(getFinishDate(lastTask), 1) : toIsoDate(new Date());
  state.tasks.push({
    id: makeId(),
    name: "New task",
    group: lastTask ? lastTask.group : "",
    type: "task",
    owner: "",
    startDate,
    duration: 1,
    dependsOn: lastTask ? lastTask.id : "",
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

syncDevopsBtn.addEventListener("click", async () => {
  await syncDevopsInbox();
});

clearDevopsInboxBtn.addEventListener("click", () => {
  if (!confirm("Clear the DevOps inbox? Imported plan tasks will stay in place.")) return;
  state.devops.inbox = [];
  saveAndRender();
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

  if (field === "duration") {
    task.duration = Math.max(1, Number.parseInt(event.target.value, 10) || 1);
  } else if (field === "type") {
    task.type = typeOptions.some(([value]) => value === event.target.value) ? event.target.value : "task";
    if (task.type === "milestone") task.duration = 1;
  } else {
    task[field] = event.target.value;
  }

  if (field === "dependsOn" && task.dependsOn === task.id) {
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
    if (item.dependsOn === id) item.dependsOn = "";
  });
  saveAndRender();
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
  return {
    projectName: typeof raw.projectName === "string" && raw.projectName.trim() ? raw.projectName.trim() : "Untitled Project",
    tasks: (raw.tasks || []).map((task) => ({
      id: typeof task.id === "string" && task.id ? task.id : makeId(),
      name: typeof task.name === "string" ? task.name : "New task",
      group: typeof task.group === "string" ? task.group : "",
      type: typeOptions.some(([value]) => value === task.type) ? task.type : "task",
      owner: typeof task.owner === "string" ? task.owner : "",
      startDate: isIsoDate(task.startDate) ? task.startDate : toIsoDate(new Date()),
      duration: Math.max(1, Number.parseInt(task.duration || task.durationDays, 10) || 1),
      dependsOn: typeof task.dependsOn === "string" ? task.dependsOn : "",
      dueDate: isIsoDate(task.dueDate) ? task.dueDate : "",
      status: statusOptions.some(([value]) => value === task.status) ? task.status : "not-started",
      notes: typeof task.notes === "string" ? task.notes : "",
      source: typeof task.source === "string" ? task.source : "",
      externalId: task.externalId ?? "",
      externalUrl: typeof task.externalUrl === "string" ? task.externalUrl : "",
      externalSignature: typeof task.externalSignature === "string" ? task.externalSignature : "",
      externalChangedDate: typeof task.externalChangedDate === "string" ? task.externalChangedDate : ""
    })),
    devops: normalizeDevopsState(raw.devops)
  };
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
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
    cell.colSpan = 12;
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
    groupCell.colSpan = 12;
    groupCell.textContent = `${group.name} (${group.tasks.length})`;
    groupRow.append(groupCell);
    taskTableBody.append(groupRow);

    group.tasks.forEach((task) => {
      const row = document.createElement("tr");
      row.className = [
        warningsByTask.has(task.id) ? "has-warning" : "",
        task.status === "done" ? "done" : "",
        task.type === "milestone" ? "milestone-task" : ""
      ].filter(Boolean).join(" ");

      row.append(
        inputCell(task, "name", "text"),
        inputCell(task, "group", "text"),
        typeCell(task),
        inputCell(task, "owner", "text"),
        inputCell(task, "startDate", "date"),
        inputCell(task, "duration", "number"),
        readOnlyCell(getFinishDate(task)),
        dependencyCell(task),
        inputCell(task, "dueDate", "date"),
        statusCell(task),
        inputCell(task, "notes", "text"),
        deleteCell(task)
      );

      taskTableBody.append(row);
    });
  });
}

function inputCell(task, field, type) {
  const cell = document.createElement("td");
  const input = document.createElement("input");
  input.dataset.id = task.id;
  input.dataset.field = field;
  input.type = type;
  input.value = task[field] || "";
  if (field === "duration") {
    input.min = "1";
    input.step = "1";
    input.disabled = task.type === "milestone";
    input.title = task.type === "milestone" ? "Milestones are one day markers." : "";
  }
  cell.append(input);
  return cell;
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

function dependencyCell(task) {
  const cell = document.createElement("td");
  const select = document.createElement("select");
  select.dataset.id = task.id;
  select.dataset.field = "dependsOn";

  const none = document.createElement("option");
  none.value = "";
  none.textContent = "None";
  select.append(none);

  state.tasks.forEach((item) => {
    if (item.id === task.id) return;
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name || "Untitled task";
    select.append(option);
  });

  select.value = task.dependsOn || "";
  cell.append(select);
  return cell;
}

function typeCell(task) {
  const cell = document.createElement("td");
  const select = document.createElement("select");
  select.dataset.id = task.id;
  select.dataset.field = "type";

  typeOptions.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });

  select.value = task.type || "task";
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
      taskRow.append(labelCell(task.name || "Untitled task", task.type === "milestone" ? "Milestone" : `${task.duration}d`));

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
        if (task.type === "milestone") {
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
  devopsOrgInput.value = devops.config.org || "";
  devopsProjectInput.value = devops.config.project || "";
  devopsWiqlInput.value = devops.config.wiql || DEFAULT_WIQL;
  devopsInboxList.textContent = "";

  const counts = getDevopsInboxCounts();
  devopsInboxSummary.textContent = `${counts.new} new | ${counts.changed} changed | ${counts.ignored} ignored`;

  if (!devops.inbox.length) {
    const empty = document.createElement("div");
    empty.className = "inbox-empty";
    empty.textContent = "No DevOps items in the inbox yet.";
    devopsInboxList.append(empty);
    return;
  }

  devops.inbox.forEach((item) => {
    const row = document.createElement("article");
    row.className = `inbox-item ${item.status}`;
    row.dataset.externalId = item.externalId;

    const main = document.createElement("div");
    main.className = "inbox-main";

    const title = document.createElement("h4");
    title.textContent = `#${item.externalId} ${item.title}`;

    const meta = document.createElement("p");
    meta.textContent = [
      item.workItemType,
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
        inboxSelect("Type", "type", [["task", "Task"], ["milestone", "Milestone"]], item.suggestedType || "task"),
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
    const url = `${getDevopsProjectUrl(config)}/_apis/wit/workitems?ids=${batch.join(",")}&fields=${DEVOPS_FIELDS.join(",")}&errorPolicy=Omit&api-version=7.1`;
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
    url: `${getDevopsProjectUrl(config)}/_workitems/edit/${externalId}`,
    suggestedGroup: getPathLeaf(fields["System.AreaPath"]) || getLastGroupName(),
    suggestedType: isMilestoneWorkItem(fields["System.WorkItemType"], title) ? "milestone" : "task"
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
  const type = row.querySelector('[data-inbox-field="type"]')?.value || "task";
  const startDate = row.querySelector('[data-inbox-field="startDate"]')?.value || toIsoDate(new Date());
  const duration = Math.max(1, Number.parseInt(row.querySelector('[data-inbox-field="duration"]')?.value, 10) || 1);
  const task = {
    id: makeId(),
    name: item.title,
    group,
    type,
    owner: item.assignedTo || "",
    startDate: isIsoDate(startDate) ? startDate : toIsoDate(new Date()),
    duration: type === "milestone" ? 1 : duration,
    dependsOn: "",
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

  task.name = item.title;
  task.owner = item.assignedTo || "";
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

function normalizeDevopsState(devops) {
  const defaults = defaultDevopsState();
  if (!devops || typeof devops !== "object") return defaults;

  return {
    config: {
      org: typeof devops.config?.org === "string" ? devops.config.org : "",
      project: typeof devops.config?.project === "string" ? devops.config.project : "",
      wiql: typeof devops.config?.wiql === "string" && devops.config.wiql.trim() ? devops.config.wiql : DEFAULT_WIQL
    },
    inbox: Array.isArray(devops.inbox) ? devops.inbox.map(normalizeDevopsInboxItem).filter(Boolean) : [],
    ignoredIds: Array.isArray(devops.ignoredIds) ? devops.ignoredIds.map(String) : []
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
    url: typeof item.url === "string" ? item.url : "",
    signature: typeof item.signature === "string" ? item.signature : "",
    status: ["new", "changed", "imported", "ignored"].includes(item.status) ? item.status : "new",
    localTaskId: typeof item.localTaskId === "string" ? item.localTaskId : "",
    suggestedGroup: typeof item.suggestedGroup === "string" ? item.suggestedGroup : "",
    suggestedType: typeOptions.some(([value]) => value === item.suggestedType) ? item.suggestedType : "task"
  };
}

function defaultDevopsState() {
  return {
    config: {
      org: "",
      project: "",
      wiql: DEFAULT_WIQL
    },
    inbox: [],
    ignoredIds: []
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

function getDevopsSignature(item) {
  return JSON.stringify({
    title: item.title,
    workItemType: item.workItemType,
    state: item.state,
    assignedTo: item.assignedTo,
    areaPath: item.areaPath,
    iterationPath: item.iterationPath,
    tags: item.tags,
    changedDate: item.changedDate
  });
}

function mapDevopsStateToStatus(value) {
  const stateName = String(value || "").toLowerCase();
  if (["closed", "done", "resolved", "removed"].includes(stateName)) return "done";
  if (["active", "committed", "in progress", "doing"].includes(stateName)) return "in-progress";
  return "not-started";
}

function isMilestoneWorkItem(type, title) {
  return /milestone/i.test(`${type || ""} ${title || ""}`);
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

function analyzeTasks() {
  const warnings = [];
  const taskById = new Map(state.tasks.map((task) => [task.id, task]));
  const cycles = findCycleTaskIds(taskById);
  const today = toIsoDate(new Date());

  state.tasks.forEach((task) => {
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

    if (task.dependsOn && !taskById.has(task.dependsOn)) {
      warnings.push({ taskId: task.id, type: "Link", message: `${task.name || "Untitled task"} depends on a task that no longer exists.` });
    }

    if (cycles.has(task.id)) {
      warnings.push({ taskId: task.id, type: "Loop", message: `${task.name || "Untitled task"} is part of a circular dependency.` });
    }

    const finishDate = getFinishDate(task);

    if (task.dependsOn && taskById.has(task.dependsOn) && !cycles.has(task.id)) {
      const dependency = taskById.get(task.dependsOn);
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
  const taskById = new Map(state.tasks.map((task) => [task.id, task]));
  const cycles = findCycleTaskIds(taskById);
  const ordered = [];
  const seen = new Set();

  state.tasks.forEach((task) => visit(task));

  ordered.forEach((task) => {
    if (!task.dependsOn || cycles.has(task.id)) return;
    const dependency = taskById.get(task.dependsOn);
    if (!dependency) return;
    const earliest = addBusinessDays(getFinishDate(dependency), 1);
    if (compareDates(task.startDate, earliest) < 0) {
      task.startDate = earliest;
    }
  });

  function visit(task) {
    if (seen.has(task.id)) return;
    seen.add(task.id);
    const dependency = task.dependsOn ? taskById.get(task.dependsOn) : null;
    if (dependency) visit(dependency);
    ordered.push(task);
  }
}

function findCycleTaskIds(taskById) {
  const visiting = new Set();
  const visited = new Set();
  const cycles = new Set();

  taskById.forEach((task) => walk(task, []));
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
    const dependency = task.dependsOn ? taskById.get(task.dependsOn) : null;
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
  if (task.type === "milestone") return task.startDate;
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
    ["Task", "Group", "Type", "Owner", "Start", "Duration", "Finish", "Depends On", "Due", "Status", "Notes", "Source", "External ID", "External URL"]
  ];
  const taskById = new Map(state.tasks.map((task) => [task.id, task]));
  state.tasks.forEach((task) => {
    rows.push([
      task.name,
      task.group,
      typeOptions.find(([value]) => value === task.type)?.[1] || "Task",
      task.owner,
      task.startDate,
      String(task.duration),
      getFinishDate(task),
      task.dependsOn ? taskById.get(task.dependsOn)?.name || "" : "",
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
