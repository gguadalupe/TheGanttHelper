function loadPlanningMonthCount() {
  const saved = Number.parseInt(localStorage.getItem(PLANNING_MONTH_COUNT_KEY), 10);
  return Number.isFinite(saved) ? Math.max(DEFAULT_PLANNING_MONTH_COUNT, saved) : DEFAULT_PLANNING_MONTH_COUNT;
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

