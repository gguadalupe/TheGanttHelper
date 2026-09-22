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

function isGroupCollapsed(groupPath) {
  return collapsedGroups.has(normalizeGroupName(groupPath));
}

function toggleTaskGroup(groupPath) {
  const normalizedPath = normalizeGroupName(groupPath);
  if (collapsedGroups.has(normalizedPath)) {
    collapsedGroups.delete(normalizedPath);
  } else {
    collapsedGroups.add(normalizedPath);
  }
  saveCollapsedGroups();
  render();
}

function defaultTaskFilters() {
  return { group: "", type: "", owner: "", status: "", dueBucket: "", search: "" };
}

function loadTaskFilters() {
  const defaults = defaultTaskFilters();
  try {
    const saved = JSON.parse(localStorage.getItem(TASK_FILTERS_KEY) || "{}");
    const dueBucketValues = ["", ...dueBucketOptions.map(([value]) => value)];
    return {
      group: typeof saved.group === "string" ? saved.group : defaults.group,
      type: typeof saved.type === "string" ? saved.type : defaults.type,
      owner: typeof saved.owner === "string" ? saved.owner : defaults.owner,
      status: typeof saved.status === "string" ? saved.status : defaults.status,
      dueBucket: dueBucketValues.includes(saved.dueBucket) ? saved.dueBucket : defaults.dueBucket,
      search: typeof saved.search === "string" ? saved.search : defaults.search
    };
  } catch {
    localStorage.removeItem(TASK_FILTERS_KEY);
    return defaults;
  }
}

function saveTaskFilters() {
  localStorage.setItem(TASK_FILTERS_KEY, JSON.stringify(taskFilters));
}

function renderTaskFilterRow() {
  if (!taskFilterRow) return;
  taskFilterRow.textContent = "";

  taskFilterRow.append(
    filterEmptyCell("id"),
    filterSearchCell(),
    filterSelectCell("group", getAllGroupPaths().map((path) => [path, path]), "All groups"),
    filterSelectCell("type", getUsedTaskTypes(), "All types"),
    filterSelectCell("owner", getCapacityOwners().map((owner) => [owner, owner]), "All owners"),
    filterEmptyCell("start"),
    filterEmptyCell("duration"),
    filterEmptyCell("effortLevel"),
    filterEmptyCell("finish"),
    filterEmptyCell("dependsOn"),
    filterSelectCell("dueBucket", dueBucketOptions, "All due dates", "due"),
    filterSelectCell("status", getUsedTaskStatuses(), "All statuses"),
    filterEmptyCell("notes"),
    filterEmptyCell("actions")
  );
}

function filterEmptyCell(column) {
  const cell = document.createElement("td");
  cell.dataset.column = column;
  return cell;
}

function filterSearchCell() {
  const cell = document.createElement("td");
  cell.dataset.column = "title";
  const input = document.createElement("input");
  input.type = "search";
  input.className = "filter-input";
  input.placeholder = "Search name or ID...";
  input.value = taskFilters.search;
  input.dataset.taskFilter = "search";
  input.setAttribute("aria-label", "Search tasks by name or ID");
  cell.append(input);
  return cell;
}

function filterSelectCell(field, options, allLabel, column = field) {
  const cell = document.createElement("td");
  cell.dataset.column = column;
  const select = document.createElement("select");
  select.className = "filter-input";
  select.dataset.taskFilter = field;

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = allLabel;
  select.append(allOption);

  options.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });

  select.value = taskFilters[field];
  cell.append(select);
  return cell;
}

function renderTable(analysis) {
  taskTableBody.textContent = "";
  renderTaskFilterRow();

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

  const filteredTasks = getFilteredTasks();
  if (!filteredTasks.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = getVisibleColumnCount();
    cell.className = "filter-empty";
    cell.textContent = "No tasks match the current filters.";
    row.append(cell);
    taskTableBody.append(row);
    applyTableColumnSettings();
    return;
  }

  const warningsByTask = groupWarningsByTask(analysis.warnings);
  const tree = getTaskGroupTree(filteredTasks);
  const projectRollup = getGroupRollup(filteredTasks);
  const rootGroupPaths = getRootGroupPaths();
  const allGroupsCollapsed = rootGroupPaths.length > 0 && rootGroupPaths.every((path) => isGroupCollapsed(path));

  const projectRow = document.createElement("tr");
  projectRow.className = "table-group-row table-project-row";
  projectRow.append(
    groupEmptyCell("id"),
    projectTitleCell(filteredTasks.length, allGroupsCollapsed, filteredTasks.length !== state.tasks.length ? state.tasks.length : 0),
    groupEmptyCell("group"),
    groupEmptyCell("type"),
    groupEmptyCell("owner"),
    groupRollupCell(projectRollup.range ? formatShortDate(projectRollup.range.start) : "", "start"),
    groupRollupCell(formatGroupDaysEffort(projectRollup), "duration"),
    groupEmptyCell("effortLevel"),
    groupRollupCell(projectRollup.range ? formatShortDate(projectRollup.range.end) : "", "finish"),
    groupEmptyCell("dependsOn"),
    groupEmptyCell("due"),
    groupRollupCell(
      projectRollup.totalCount ? `${projectRollup.progressPercent}%` : "",
      "status",
      projectRollup.totalCount ? `${projectRollup.doneCount}/${projectRollup.totalCount} done` : ""
    ),
    groupEmptyCell("notes"),
    groupEmptyCell("actions")
  );
  taskTableBody.append(projectRow);

  renderTableGroupEntries(tree.entries, 0, "", warningsByTask);

  applyTableColumnSettings();
}

function renderTableGroupEntries(entries, depth, parentPath, warningsByTask) {
  entries.forEach((entry) => {
    if (entry.type === "task") {
      renderTaskRow(entry.task, warningsByTask);
    } else {
      renderGroupRow(entry.node, depth, parentPath, warningsByTask);
    }
  });
}

function renderGroupRow(node, depth, parentPath, warningsByTask) {
  const collapsed = isGroupCollapsed(node.path);
  const nodeTasks = getGroupNodeTasks(node);
  const rollup = getGroupRollup(nodeTasks);
  const groupRow = document.createElement("tr");
  groupRow.className = "table-group-row";
  groupRow.dataset.groupName = node.path;
  groupRow.dataset.groupParentPath = parentPath;
  groupRow.append(
    groupEmptyCell("id"),
    groupTitleCell(node, nodeTasks.length, collapsed, depth),
    groupEmptyCell("group"),
    groupEmptyCell("type"),
    groupEmptyCell("owner"),
    groupStartDateCell(node.path, rollup),
    groupRollupCell(formatGroupDaysEffort(rollup), "duration"),
    groupEmptyCell("effortLevel"),
    groupRollupCell(rollup.range ? formatShortDate(rollup.range.end) : "", "finish"),
    groupEmptyCell("dependsOn"),
    groupEmptyCell("due"),
    groupRollupCell(
      rollup.totalCount ? `${rollup.progressPercent}%` : "",
      "status",
      rollup.totalCount ? `${rollup.doneCount}/${rollup.totalCount} done` : ""
    ),
    groupEmptyCell("notes"),
    groupEmptyCell("actions")
  );
  taskTableBody.append(groupRow);

  if (collapsed) return;
  renderTableGroupEntries(node.entries, depth + 1, node.path, warningsByTask);
}

function renderTaskRow(task, warningsByTask) {
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
    effortLevelCell(task),
    readOnlyCell(getFinishDate(task), "finish"),
    inputCell(task, "dependsOn", "text", "dependsOn"),
    inputCell(task, "dueDate", "date", "due"),
    statusCell(task),
    inputCell(task, "notes", "text", "notes"),
    deleteCell(task)
  );

  taskTableBody.append(row);
}

function groupTitleCell(node, taskCount, collapsed, depth) {
  const cell = document.createElement("td");
  cell.dataset.column = "title";
  const wrapper = document.createElement("div");
  wrapper.className = "group-header-cell";
  wrapper.style.setProperty("--depth", String(depth));
  wrapper.append(
    groupDragHandle(node),
    groupToggleButton(node.path, collapsed),
    groupNameInput(node.path),
    groupCountBadge(taskCount)
  );
  cell.append(wrapper);
  return cell;
}

function groupDragHandle(node) {
  const handle = document.createElement("button");
  handle.className = "group-drag-handle";
  handle.type = "button";
  handle.draggable = true;
  handle.dataset.dragGroupName = node.path;
  handle.title = "Drag to reorder this group";
  handle.setAttribute("aria-label", `Reorder group ${node.path}`);
  handle.textContent = "::";
  return handle;
}

function groupToggleButton(groupPath, collapsed) {
  const button = document.createElement("button");
  button.className = "group-toggle";
  button.type = "button";
  button.dataset.toggleGroup = groupPath;
  button.setAttribute("aria-expanded", String(!collapsed));
  button.setAttribute("aria-label", collapsed ? `Expand ${groupPath}` : `Collapse ${groupPath}`);
  button.textContent = collapsed ? "+" : "-";
  return button;
}

function groupNameInput(groupPath) {
  const input = document.createElement("input");
  input.className = "group-name-input";
  input.type = "text";
  input.value = groupPath;
  input.dataset.renameGroup = groupPath;
  input.setAttribute("aria-label", "Group path");
  input.title = "Rename this group. Use \" / \" to nest it under (or move it under) another group.";
  return input;
}

function projectTitleCell(taskCount, collapsed, totalCount = 0) {
  const cell = document.createElement("td");
  cell.dataset.column = "title";
  const wrapper = document.createElement("div");
  wrapper.className = "group-header-cell project-header-cell";

  const toggle = document.createElement("button");
  toggle.className = "group-toggle";
  toggle.type = "button";
  toggle.dataset.toggleAllGroups = "1";
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.setAttribute("aria-label", collapsed ? "Expand all groups" : "Collapse all groups");
  toggle.textContent = collapsed ? "+" : "-";

  const name = document.createElement("strong");
  name.className = "project-name-label";
  name.textContent = state.projectName || "Project";

  wrapper.append(toggle, name, groupCountBadge(taskCount, totalCount));
  cell.append(wrapper);
  return cell;
}

function groupCountBadge(taskCount, totalCount = 0) {
  const span = document.createElement("span");
  span.className = "group-count";
  span.textContent = totalCount
    ? `${taskCount} of ${totalCount} task${totalCount === 1 ? "" : "s"}`
    : `${taskCount} task${taskCount === 1 ? "" : "s"}`;
  return span;
}

// "Days" (businessDays) is the group's elapsed calendar span; "fte" (totalEffort) is the
// sum of every task's own duration - they diverge once tasks in the group overlap.
function formatGroupDaysEffort(rollup) {
  if (!rollup.range) return "";
  return rollup.totalEffort > 0 ? `${rollup.businessDays}d / ${rollup.totalEffort} fte` : `${rollup.businessDays}d`;
}

function groupRollupCell(value, column, title = "") {
  const cell = document.createElement("td");
  cell.dataset.column = column;
  cell.className = "group-rollup-cell";
  cell.textContent = value;
  if (title) cell.title = title;
  return cell;
}

function groupStartDateCell(groupName, rollup) {
  const cell = document.createElement("td");
  cell.dataset.column = "start";
  const input = document.createElement("input");
  input.type = "date";
  input.dataset.groupStartDate = groupName;
  input.disabled = !rollup.range;
  input.title = "Move this group: every task in it shifts by the same number of days.";
  if (rollup.range) input.value = rollup.range.start;
  cell.append(input);
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

function effortLevelCell(task) {
  const cell = document.createElement("td");
  cell.dataset.column = "effortLevel";
  const select = document.createElement("select");
  select.dataset.id = task.id;
  select.dataset.field = "effortLevel";

  getEffortLevelOptions(task.effortLevel).forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });

  select.value = task.effortLevel || "";
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
  if (row.dataset.groupParentPath !== draggedGroupParentPath) return null;
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
    const firstGroupIndex = remaining.findIndex((task) => isGroupPathOrDescendant(task.group, targetGroupName));
    insertAt = firstGroupIndex < 0 ? remaining.length : firstGroupIndex;
  } else {
    const targetIndex = remaining.findIndex((task) => task.id === targetTaskId);
    if (targetIndex < 0) return false;
    insertAt = position === "after" ? targetIndex + 1 : targetIndex;
  }

  const previousGroupName = normalizeGroupName(sourceTask.group);
  if (previousGroupName !== targetGroupName) {
    sourceTask.group = targetGroupName === "Ungrouped" ? "" : targetGroupName;

    const targetGroupRollup = getGroupRollup(remaining.filter((task) => isGroupPathOrDescendant(task.group, targetGroupName)));
    if (targetGroupRollup.range) {
      sourceTask.startDate = targetGroupRollup.range.start;
      sourceTask.planningMonth = sourceTask.startDate.slice(0, 7);
    }
  }

  remaining.splice(insertAt, 0, sourceTask);

  if (state.tasks.every((task, index) => task.id === remaining[index]?.id)) return false;

  state.tasks = remaining;
  return true;
}

function findGroupEntryLocation(entries, path) {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.type !== "group") continue;
    if (entry.node.path === path) return { entries, index };
    const found = findGroupEntryLocation(entry.node.entries, path);
    if (found) return found;
  }
  return null;
}

function reorderGroup(sourceGroupPath, targetGroupPath, position) {
  const sourcePath = normalizeGroupName(sourceGroupPath);
  const targetPath = normalizeGroupName(targetGroupPath);
  if (!sourcePath || !targetPath || sourcePath === targetPath) return false;

  const tree = getTaskGroupTree();
  const sourceLocation = findGroupEntryLocation(tree.entries, sourcePath);
  const targetLocation = findGroupEntryLocation(tree.entries, targetPath);
  if (!sourceLocation || !targetLocation || sourceLocation.entries !== targetLocation.entries) return false;

  const parentEntries = sourceLocation.entries;
  const targetEntry = targetLocation.entries[targetLocation.index];
  const [movedEntry] = parentEntries.splice(sourceLocation.index, 1);
  let insertAt = parentEntries.indexOf(targetEntry);
  if (insertAt < 0) return false;
  if (position === "after") insertAt += 1;
  parentEntries.splice(insertAt, 0, movedEntry);

  state.tasks = flattenGroupEntries(tree.entries);
  return true;
}

