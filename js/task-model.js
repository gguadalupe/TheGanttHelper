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
      effortLevel: typeof task.effortLevel === "string" ? task.effortLevel : "",
      dependsOn: typeof task.dependsOn === "string" ? task.dependsOn.trim() : "",
      parentId: task.parentId == null ? "" : String(task.parentId),
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

  // Older syncs set a DevOps task's dependsOn to its parent User Story's ID, but User
  // Stories are never imported as tasks (see isSyncableDevopsWorkItem) - that ID can
  // never resolve, so it only ever produced a false "no task has that ID" warning.
  // Recover the parent link into parentId, fold it into the group label, and drop it
  // from dependsOn. Once cleared, dependsOn stays empty so this is a one-time repair.
  const validTaskIds = new Set(tasks.map((task) => task.taskId));
  tasks.forEach((task) => {
    if (task.source !== "azure-devops" || !task.dependsOn || validTaskIds.has(task.dependsOn)) return;
    if (!task.parentId) task.parentId = task.dependsOn;
    if (task.group) task.group = `#${task.dependsOn} ${task.group}`;
    task.dependsOn = "";
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

// Filter dropdowns only offer values actually present on a task, so every option is
// guaranteed to match at least one row - unlike getTypeOptions(), which also seeds the
// canonical list and the DevOps inbox for the per-task <select> editors.
function getUsedTaskTypes() {
  const seen = new Set();
  const options = [];
  state.tasks.forEach((task) => {
    const type = normalizeTaskType(task.type);
    if (seen.has(type)) return;
    seen.add(type);
    options.push([type, getTypeLabel(type)]);
  });
  return options.sort((a, b) => a[1].localeCompare(b[1]));
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

function getUsedTaskStatuses() {
  const seen = new Set();
  const options = [];
  state.tasks.forEach((task) => {
    const status = normalizeTaskStatus(task.status);
    if (seen.has(status)) return;
    seen.add(status);
    options.push([status, getStatusLabel(status)]);
  });
  return options.sort((a, b) => a[1].localeCompare(b[1]));
}

function getEffortLevelOptions(currentValue = "") {
  const options = [];
  const seen = new Set();
  const addOption = (value) => {
    const normalizedValue = typeof value === "string" ? value.trim() : "";
    if (seen.has(normalizedValue)) return;
    seen.add(normalizedValue);
    options.push([normalizedValue, normalizedValue || "-"]);
  };

  effortLevelOptions.forEach(([value]) => addOption(value));
  state.tasks.forEach((task) => addOption(task.effortLevel));
  state.devops.inbox.forEach((item) => addOption(item.effortLevel));
  addOption(currentValue);
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

function getStatusProgressFactor(value) {
  const key = normalizeTaskStatus(value).toLowerCase();
  if (Object.prototype.hasOwnProperty.call(STATUS_PROGRESS_FACTORS, key)) return STATUS_PROGRESS_FACTORS[key];
  if (isDoneStatus(value)) return 1;
  if (isInProgressStatus(value)) return 0.5;
  return 0;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  const progressPercent = tasks.length
    ? Math.round((tasks.reduce((sum, task) => sum + getStatusProgressFactor(task.status), 0) / tasks.length) * 100)
    : 0;
  // Total effort is the sum of each task's own duration (person-days of work), distinct
  // from businessDays above (the group's elapsed calendar span) - tasks that overlap
  // push this higher than the span they fit into.
  const totalEffort = tasks.reduce((sum, task) => sum + (Number.isFinite(task.duration) ? task.duration : 0), 0);

  let status = "not-started";
  if (tasks.length && doneCount === tasks.length) status = "done";
  else if (doneCount > 0 || inProgressCount > 0) status = "in-progress";

  return {
    range,
    businessDays: range ? countBusinessDays(range.start, range.end) : 0,
    doneCount,
    totalCount: tasks.length,
    progressPercent,
    totalEffort,
    status
  };
}

function splitGroupPath(value) {
  const raw = typeof value === "string" ? value : "";
  const segments = raw.split(GROUP_PATH_SEPARATOR).map((part) => part.trim()).filter(Boolean);
  return segments.length ? segments : ["Ungrouped"];
}

function normalizeGroupName(value) {
  return splitGroupPath(value).join(GROUP_PATH_SEPARATOR);
}

function isGroupPathOrDescendant(taskGroupRaw, groupPath) {
  const candidate = splitGroupPath(taskGroupRaw);
  const target = splitGroupPath(groupPath);
  return target.every((segment, index) => candidate[index] === segment);
}

function replaceGroupPathPrefix(candidatePath, previousSegments, nextSegments) {
  const candidateSegments = splitGroupPath(candidatePath);
  if (!previousSegments.every((segment, index) => candidateSegments[index] === segment)) return candidatePath;
  const rest = candidateSegments.slice(previousSegments.length);
  return [...nextSegments, ...rest].join(GROUP_PATH_SEPARATOR);
}

function shiftGroupDates(groupPath, dayDelta) {
  if (!dayDelta) return;
  state.tasks.forEach((task) => {
    if (!isGroupPathOrDescendant(task.group, groupPath)) return;
    if (!isIsoDate(task.startDate)) return;
    task.startDate = addCalendarDays(task.startDate, dayDelta);
    task.planningMonth = task.startDate.slice(0, 7);
  });
  autoSchedule();
}

function renameTaskGroup(previousPathRaw, nextPathRaw) {
  const previousSegments = splitGroupPath(previousPathRaw);
  const nextSegments = splitGroupPath(nextPathRaw);
  const previous = previousSegments.join(GROUP_PATH_SEPARATOR);
  const next = nextSegments.join(GROUP_PATH_SEPARATOR);
  if (next === previous) return false;

  let changed = false;
  state.tasks.forEach((task) => {
    if (!isGroupPathOrDescendant(task.group, previous)) return;
    task.group = replaceGroupPathPrefix(task.group, previousSegments, nextSegments);
    changed = true;
  });

  if (changed) {
    const remapped = new Set();
    collapsedGroups.forEach((path) => {
      remapped.add(replaceGroupPathPrefix(path, previousSegments, nextSegments));
    });
    collapsedGroups = remapped;
    saveCollapsedGroups();
  }

  return changed;
}

function insertTaskInGroup(task) {
  const groupPath = normalizeGroupName(task.group);
  let insertAt = state.tasks.length;

  state.tasks.forEach((item, index) => {
    if (isGroupPathOrDescendant(item.group, groupPath)) insertAt = index + 1;
  });

  state.tasks.splice(insertAt, 0, task);
}

function moveTaskToGroup(task, nextGroup, previousGroup) {
  const nextGroupPath = normalizeGroupName(nextGroup);
  if (nextGroupPath === previousGroup) {
    task.group = nextGroup;
    return;
  }

  const targetGroupExists = state.tasks.some((item) => (
    item.id !== task.id && isGroupPathOrDescendant(item.group, nextGroupPath)
  ));

  task.group = nextGroup;
  if (!targetGroupExists) return;

  const withoutTask = state.tasks.filter((item) => item.id !== task.id);
  let insertAt = withoutTask.length;
  withoutTask.forEach((item, index) => {
    if (isGroupPathOrDescendant(item.group, nextGroupPath)) insertAt = index + 1;
  });

  withoutTask.splice(insertAt, 0, task);
  state.tasks = withoutTask;
}

function getLastGroupName() {
  const lastTask = state.tasks.at(-1);
  return lastTask ? normalizeGroupName(lastTask.group) : "";
}

function getTaskGroupTree(tasks = state.tasks) {
  const root = { name: "", path: "", segments: [], depth: -1, entries: [], childByName: new Map() };

  tasks.forEach((task) => {
    const segments = splitGroupPath(task.group);
    let node = root;
    let pathSoFar = [];

    segments.forEach((segment, index) => {
      pathSoFar.push(segment);
      const isLast = index === segments.length - 1;
      let child = node.childByName.get(segment);
      if (!child) {
        child = {
          name: segment,
          path: pathSoFar.join(GROUP_PATH_SEPARATOR),
          segments: pathSoFar.slice(),
          depth: pathSoFar.length - 1,
          entries: [],
          childByName: new Map()
        };
        node.childByName.set(segment, child);
        node.entries.push({ type: "group", node: child });
      }
      node = child;
      if (isLast) node.entries.push({ type: "task", task });
    });
  });

  return root;
}

function getGroupNodeTasks(node) {
  const tasks = [];
  node.entries.forEach((entry) => {
    if (entry.type === "task") tasks.push(entry.task);
    else tasks.push(...getGroupNodeTasks(entry.node));
  });
  return tasks;
}

function flattenGroupEntries(entries) {
  return entries.flatMap((entry) => (entry.type === "task" ? [entry.task] : flattenGroupEntries(entry.node.entries)));
}

function getRootGroupPaths() {
  return getTaskGroupTree().entries
    .filter((entry) => entry.type === "group")
    .map((entry) => entry.node.path);
}

// Every group path at every depth (not just leaves) - lets the filter dropdown offer
// a whole subtree (e.g. "Pet") as one option, not just its Done/Pending leaves.
function getAllGroupPaths(node = getTaskGroupTree(), acc = []) {
  node.entries.forEach((entry) => {
    if (entry.type !== "group") return;
    acc.push(entry.node.path);
    getAllGroupPaths(entry.node, acc);
  });
  return acc;
}

function getFilteredTasks() {
  const todayIso = toIsoDate(new Date());
  return state.tasks.filter((task) => taskMatchesFilters(task, taskFilters, todayIso));
}

function taskMatchesFilters(task, filters, todayIso = toIsoDate(new Date())) {
  if (filters.group && !isGroupPathOrDescendant(task.group, filters.group)) return false;
  if (filters.type && normalizeTaskType(task.type) !== filters.type) return false;
  if (filters.owner && normalizeOwnerName(task.owner) !== filters.owner) return false;
  if (filters.status && normalizeTaskStatus(task.status) !== filters.status) return false;
  if (filters.dueBucket && getDueDateBucket(task, todayIso) !== filters.dueBucket) return false;
  if (filters.search) {
    const needle = filters.search.trim().toLowerCase();
    if (needle && !task.name.toLowerCase().includes(needle) && !task.taskId.toLowerCase().includes(needle)) return false;
  }
  return true;
}

// "This week" is the calendar week (Mon-Sun) containing today, matching the week
// boundaries the Gantt's week-zoom view already uses (getWeekStart in dates.js) -
// keeps the filter's idea of "current" consistent with the rest of the app.
function getDueDateBucket(task, todayIso = toIsoDate(new Date())) {
  if (!isIsoDate(task.dueDate)) return "none";
  if (compareDates(task.dueDate, todayIso) < 0) return "overdue";
  const weekEnd = addCalendarDays(getWeekStart(todayIso), 6);
  if (compareDates(task.dueDate, weekEnd) <= 0) return "this-week";
  return "later";
}

function isAnyTaskFilterActive(filters) {
  return Boolean(filters.group || filters.type || filters.owner || filters.status || filters.dueBucket || filters.search.trim());
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
    if (isIsoDate(task.dueDate)) {
      // Due dates take priority over dependency pushes: schedule backward from the
      // deadline so Start always answers "when does this need to start to land on
      // time, given its duration?" - even if that lands before a dependency finishes.
      // That conflict isn't hidden - it surfaces as the existing "starts before X
      // finishes" Link warning in analyzeTasks, same as any other scheduling conflict.
      const span = isMilestoneType(task.type) ? 0 : Math.max(1, task.duration) - 1;
      task.startDate = addBusinessDays(task.dueDate, -span);
      task.planningMonth = task.startDate.slice(0, 7);
      return;
    }

    if (!task.dependsOn || cycles.has(task.id)) return;
    const dependency = taskByTaskId.get(task.dependsOn);
    if (!dependency) return;
    const earliest = addBusinessDays(getFinishDate(dependency), 1);
    if (compareDates(task.startDate, earliest) < 0) {
      task.startDate = earliest;
      task.planningMonth = task.startDate.slice(0, 7);
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

