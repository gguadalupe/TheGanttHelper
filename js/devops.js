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
  const inboxTypeOptions = getDevopsInboxTypeOptions();
  devopsTypeFilter.textContent = "";

  inboxTypeOptions.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    devopsTypeFilter.append(option);
  });

  devopsTypeFilter.value = inboxTypeOptions.some(([value]) => value === currentType) ? currentType : "";
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
    suggestedGroup: parentId ? `#${parentId} ${parentTitle}`.trim() : (getPathLeaf(fields["System.AreaPath"]) || getLastGroupName()),
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
    dependsOn: "",
    parentId: item.parentId || "",
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
  task.parentId = item.parentId || "";
  if (item.parentId) task.group = `#${item.parentId} ${item.parentTitle || ""}`.trim();
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
    suggestedGroup: typeof item.suggestedGroup === "string" && item.suggestedGroup
      ? item.suggestedGroup
      : (item.parentId ? `#${item.parentId} ${item.parentTitle || ""}`.trim() : ""),
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

