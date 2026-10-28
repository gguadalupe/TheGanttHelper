// A general status report of every task in the plan, grouped for an at-a-glance
// share-out: top-level group (just the first segment of a nested "A / B / C" group
// path) -> owner -> status, each ticket listed with its ID and name, linking straight
// to the DevOps work item when one exists.
//
// Blocked status and active PRs need live DevOps data (work item tags and linked pull
// requests aren't stored on the task locally - same reasoning as js/pr-review.js), so
// fetchTicketStatusSummary() does that fetch, reusing pr-review.js's DevOps helpers,
// then hands the result to buildTicketStatusSummary() for the actual grouping. Without
// DevOps configured (or for hand-added tasks with no externalId) the grouping still
// works from local data alone - only the blocked flag and PR list go missing.

async function fetchTicketStatusSummary(onStatus = () => {}) {
  const config = {
    org: state.devops.config.org || DEFAULT_DEVOPS_ORG,
    project: state.devops.config.project || DEFAULT_DEVOPS_PROJECT
  };
  const token = localStorage.getItem(DEVOPS_TOKEN_KEY) || "";
  const devopsTasks = state.tasks.filter((task) => task.source === "azure-devops" && task.externalId);

  const liveInfoByTaskId = new Map();
  let liveDataNote = "";

  if (!devopsTasks.length) {
    // Nothing synced from DevOps - the report is still useful from local data alone.
  } else if (!config.org || !config.project || !token) {
    liveDataNote = "Set up Azure DevOps sync (org, project, token) in Sync options to see blocked status and linked PRs.";
  } else {
    try {
      onStatus(`Fetching ${devopsTasks.length} work item${devopsTasks.length === 1 ? "" : "s"}...`);
      const ids = devopsTasks.map((task) => task.externalId);
      const workItems = await fetchDevopsWorkItems(config, token, ids);
      const workItemById = new Map(workItems.map((workItem) => [String(workItem.id), workItem]));

      const prRefsByTaskId = new Map();
      const uniquePrIds = new Set();
      devopsTasks.forEach((task) => {
        const workItem = workItemById.get(String(task.externalId));
        const refs = workItem ? getDevopsPullRequestRefs(workItem) : [];
        prRefsByTaskId.set(task.id, refs);
        refs.forEach((ref) => uniquePrIds.add(ref.pullRequestId));
      });

      let prById = new Map();
      if (uniquePrIds.size) {
        onStatus(`Fetching ${uniquePrIds.size} pull request${uniquePrIds.size === 1 ? "" : "s"}...`);
        const prEntries = await Promise.all(
          Array.from(uniquePrIds).map(async (pullRequestId) => {
            try {
              return [pullRequestId, await fetchDevopsPullRequest(config, token, pullRequestId)];
            } catch (error) {
              return [pullRequestId, { fetchError: error.message || "Failed to load this pull request." }];
            }
          })
        );
        prById = new Map(prEntries);
      }

      devopsTasks.forEach((task) => {
        const workItem = workItemById.get(String(task.externalId));
        const tags = splitDevopsTags(workItem?.fields?.["System.Tags"]);
        const refs = prRefsByTaskId.get(task.id) || [];
        const activePrs = refs
          .map((ref) => prById.get(ref.pullRequestId))
          .filter((pr) => pr && !pr.fetchError && pr.status === "active")
          .map((pr) => ({
            title: pr.title || `Pull request #${pr.pullRequestId}`,
            url: getDevopsPullRequestUrl(pr, config)
          }));

        liveInfoByTaskId.set(task.id, {
          isBlockedByTag: tags.some((tag) => /blocked/i.test(tag)),
          activePrs
        });
      });
    } catch (error) {
      liveDataNote = `Couldn't load live DevOps data (${error.message || "unknown error"}) - showing local status only.`;
    }
  }

  return { groups: buildTicketStatusSummary(liveInfoByTaskId), liveDataNote };
}

function buildTicketStatusSummary(liveInfoByTaskId = new Map()) {
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
                .map((ticket) => buildTicketStatusEntry(ticket, liveInfoByTaskId.get(ticket.id)))
            }))
            .sort((a, b) => a.progressFactor - b.progressFactor || a.statusLabel.localeCompare(b.statusLabel))
        }))
        .sort((a, b) => a.ownerName.localeCompare(b.ownerName))
    }))
    .sort((a, b) => a.groupName.localeCompare(b.groupName));
}

function buildTicketStatusEntry(task, liveInfo) {
  return {
    taskId: task.taskId,
    name: task.name || "Untitled task",
    url: task.externalUrl || "",
    isBlocked: isLocallyBlockedStatus(task.status) || Boolean(liveInfo?.isBlockedByTag),
    activePrs: liveInfo?.activePrs || []
  };
}

// Some teams track "blocked" as an actual workflow state (a Kanban "Blocked" column)
// rather than, or in addition to, a tag - this catches that case straight from the
// task's own status, no live fetch required.
function isLocallyBlockedStatus(status) {
  return /blocked/i.test(normalizeTaskStatus(status));
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
          const blockedTag = ticket.isBlocked ? " [BLOCKED]" : "";
          lines.push(`      • #${ticket.taskId} ${ticket.name}${blockedTag}`);
          if (ticket.url) lines.push(`        ${ticket.url}`);
          ticket.activePrs.forEach((pr) => {
            lines.push(`        PR: ${pr.title}${pr.url ? ` (${pr.url})` : ""}`);
          });
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
    list.append(renderTicketStatusItem(ticket));
  });
  block.append(list);

  return block;
}

function renderTicketStatusItem(ticket) {
  const item = document.createElement("li");

  const row = document.createElement("div");
  row.className = "ticket-status-row";
  const label = `#${ticket.taskId} ${ticket.name}`;
  row.append(ticket.url ? ticketStatusLink(ticket.url, label) : document.createTextNode(label));
  if (ticket.isBlocked) {
    const pill = document.createElement("span");
    pill.className = "ticket-status-blocked-pill";
    pill.textContent = "Blocked";
    row.append(pill);
  }
  item.append(row);

  if (ticket.activePrs.length) {
    const prs = document.createElement("div");
    prs.className = "ticket-status-prs";
    prs.append(document.createTextNode(ticket.activePrs.length > 1 ? "PRs: " : "PR: "));
    ticket.activePrs.forEach((pr, index) => {
      if (index > 0) prs.append(document.createTextNode(", "));
      prs.append(pr.url ? ticketStatusLink(pr.url, pr.title) : document.createTextNode(pr.title));
    });
    item.append(prs);
  }

  return item;
}

function ticketStatusLink(href, label) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}
