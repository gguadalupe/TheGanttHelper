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
      groupStartDateCell(group.name, rollup),
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

