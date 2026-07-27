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

