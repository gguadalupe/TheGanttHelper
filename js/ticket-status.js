// A general status report of every task in the plan, grouped for an at-a-glance
// share-out: top-level group (just the first segment of a nested "A / B / C" group
// path) -> owner -> status, each ticket listed with its ID and name, linking straight
// to the DevOps work item when one exists. Pure local data - unlike the PR-focused
// modals, this never calls the DevOps API, so there's nothing to fetch or fail.

function buildTicketStatusSummary() {
  const groups = new Map();

  state.tasks.forEach((task) => {
    const groupName = splitGroupPath(task.group)[0] || "Ungrouped";
    const ownerName = normalizeOwnerName(task.owner);
    const statusValue = normalizeTaskStatus(task.status);

    if (!groups.has(groupName)) groups.set(groupName, new Map());
    const owners = groups.get(groupName);

    if (!owners.has(ownerName)) owners.set(ownerName, new Map());
    const statuses = owners.get(ownerName);

    if (!statuses.has(statusValue)) statuses.set(statusValue, []);
    statuses.get(statusValue).push(task);
  });

  return Array.from(groups.entries())
    .map(([groupName, owners]) => ({
      groupName,
      ticketCount: countGroupTickets(owners),
      owners: Array.from(owners.entries())
        .map(([ownerName, statuses]) => ({
          ownerName,
          statuses: Array.from(statuses.entries())
            .map(([statusValue, tasks]) => ({
              statusValue,
              statusLabel: getStatusLabel(statusValue),
              // Workflow order (not started -> in progress -> done), not alphabetical -
              // reads naturally in a status report instead of scattering "Done" and
              // "Not started" at random based on spelling.
              progressFactor: getStatusProgressFactor(statusValue),
              tickets: tasks
                .slice()
                .sort(compareTicketsForStatusReport)
                .map((ticket) => ({
                  taskId: ticket.taskId,
                  name: ticket.name || "Untitled task",
                  url: ticket.externalUrl || ""
                }))
            }))
            .sort((a, b) => a.progressFactor - b.progressFactor || a.statusLabel.localeCompare(b.statusLabel))
        }))
        .sort((a, b) => a.ownerName.localeCompare(b.ownerName))
    }))
    .sort((a, b) => a.groupName.localeCompare(b.groupName));
}

function countGroupTickets(owners) {
  let total = 0;
  owners.forEach((statuses) => {
    statuses.forEach((tasks) => { total += tasks.length; });
  });
  return total;
}

function compareTicketsForStatusReport(a, b) {
  const aId = Number(a.taskId);
  const bId = Number(b.taskId);
  if (Number.isFinite(aId) && Number.isFinite(bId)) return aId - bId;
  return String(a.taskId || "").localeCompare(String(b.taskId || ""));
}

// Plain text on purpose - see js/pr-review.js's buildTeamsMessageText for why (Teams
// only live-renders markdown as you type it, not on paste).
function buildTicketStatusText(groups) {
  if (!groups.length) return "No tasks in this plan yet.";

  const lines = [`Project status - ${formatDateTime(new Date())}`, ""];
  groups.forEach((group) => {
    lines.push(`${group.groupName} (${group.ticketCount})`);
    group.owners.forEach((owner) => {
      lines.push(`  ${owner.ownerName}`);
      owner.statuses.forEach((status) => {
        lines.push(`    ${status.statusLabel} (${status.tickets.length})`);
        status.tickets.forEach((ticket) => {
          lines.push(`      • #${ticket.taskId} ${ticket.name}`);
          if (ticket.url) lines.push(`        ${ticket.url}`);
        });
      });
    });
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

// Built as real DOM (not an HTML string) so group/owner/ticket text is always inserted
// via textContent - safe even if a task name happens to contain markup. This same
// element's innerHTML is what gets copied for the rich-text (Teams) paste.
function renderTicketStatusHtml(groups) {
  const container = document.createElement("div");
  container.className = "ticket-status-html";

  if (!groups.length) {
    const empty = document.createElement("p");
    empty.textContent = "No tasks in this plan yet.";
    container.append(empty);
    return container;
  }

  groups.forEach((group) => {
    container.append(renderTicketStatusGroup(group));
  });

  return container;
}

function renderTicketStatusGroup(group) {
  const details = document.createElement("details");
  details.className = "ticket-status-group";
  details.open = true;

  const summary = document.createElement("summary");
  summary.textContent = `${group.groupName} (${group.ticketCount})`;
  details.append(summary);

  group.owners.forEach((owner) => {
    const ownerBlock = document.createElement("div");
    ownerBlock.className = "ticket-status-owner";

    const ownerHeading = document.createElement("div");
    ownerHeading.className = "ticket-status-owner-name";
    ownerHeading.textContent = owner.ownerName;
    ownerBlock.append(ownerHeading);

    owner.statuses.forEach((status) => {
      ownerBlock.append(renderTicketStatusBucket(status));
    });

    details.append(ownerBlock);
  });

  return details;
}

function renderTicketStatusBucket(status) {
  const block = document.createElement("div");
  block.className = "ticket-status-status";

  const heading = document.createElement("div");
  heading.className = "ticket-status-status-name";
  heading.textContent = `${status.statusLabel} (${status.tickets.length})`;
  block.append(heading);

  const list = document.createElement("ul");
  status.tickets.forEach((ticket) => {
    const item = document.createElement("li");
    const label = `#${ticket.taskId} ${ticket.name}`;
    item.append(ticket.url ? ticketStatusLink(ticket.url, label) : document.createTextNode(label));
    list.append(item);
  });
  block.append(list);

  return block;
}

function ticketStatusLink(href, label) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}
