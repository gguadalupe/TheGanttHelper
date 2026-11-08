// A single sortable table of every Azure DevOps-synced ticket with its linked pull
// request(s) - one row per (ticket, PR) pair, plus a row for a ticket with no PR at all.
// Deliberately flat, not grouped: a PR can span tickets from several different groups,
// and bucketing rows into group sections made it impossible to sort straight across all
// of them (e.g. by PR #) to see that PR's tickets together. Group is just a sortable
// column like any other - and shows the FULL group path (not collapsed to the top-level
// segment the way Share Ticket/PR Status do for a short team-facing report), since this
// view exists to work the plan directly and the full path is what the Gantt groups by.
//
// Pure data-shaping and rendering live here; main.js owns the dialog's mutable sort
// state and wires up the click handlers (same split as every other feature in this app -
// fetch/build here, DOM wiring in main.js).

const WORK_LIST_COLUMNS = [
  { key: "group", label: "Group" },
  { key: "ticket", label: "Ticket" },
  { key: "owner", label: "Owner" },
  { key: "status", label: "Status" },
  { key: "prId", label: "PR #" },
  { key: "prTitle", label: "PR title" },
  { key: "prStatus", label: "PR status" },
  { key: "pending", label: "Pending reviewers" },
  { key: "comments", label: "Comments" },
  { key: "createdBy", label: "Created by" }
];

function getWorkListSortValue(row, key) {
  switch (key) {
    case "group": return row.group || "";
    case "ticket": return Number(row.taskExternalId);
    case "owner": return row.owner || "";
    case "status": return row.statusLabel || "";
    case "prId": return row.pr && !row.pr.error ? Number(row.pr.id) : null;
    case "prTitle": return row.pr && !row.pr.error ? row.pr.title : null;
    case "prStatus": return row.pr && !row.pr.error ? row.pr.status : null;
    case "pending": return row.pr && !row.pr.error ? getWorkListPendingText(row.pr) : null;
    case "comments": return row.pr && !row.pr.error && row.pr.status === "active" ? getPrCommentsSummaryText(row.pr.comments) : null;
    case "createdBy": return row.pr && !row.pr.error ? row.pr.createdBy || null : null;
    default: return "";
  }
}

// Rows missing a value for the active sort column (most often "no linked PR") always
// sink to the bottom, in either direction - flipping sort direction shouldn't make
// "no PR" rows jump to the top, which would read as if they were somehow first.
function compareWorkListRows(a, b, sort) {
  const av = getWorkListSortValue(a, sort.key);
  const bv = getWorkListSortValue(b, sort.key);
  const aEmpty = av == null || av === "" || Number.isNaN(av);
  const bEmpty = bv == null || bv === "" || Number.isNaN(bv);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  let result;
  if (typeof av === "number" && typeof bv === "number") result = av - bv;
  else result = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
  return sort.dir === "asc" ? result : -result;
}

function sortWorkListRows(rows, sort) {
  return rows.slice().sort((a, b) => compareWorkListRows(a, b, sort));
}

function getWorkListPendingText(pr) {
  if (pr.status !== "active") return "-";
  if (pr.pendingNow.length) return pr.pendingNow.join(", ");
  if (pr.pendingLater.length) return `(waiting) ${pr.pendingLater.join(", ")}`;
  return "None";
}

function buildWorkListTable(rows, sort) {
  const table = document.createElement("table");
  table.className = "work-list-table";
  table.append(buildWorkListHeader(sort));

  const tbody = document.createElement("tbody");

  if (!rows.length) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = WORK_LIST_COLUMNS.length;
    emptyCell.className = "work-list-empty";
    emptyCell.textContent = "No Azure DevOps-synced tickets in this plan yet.";
    emptyRow.append(emptyCell);
    tbody.append(emptyRow);
  }

  sortWorkListRows(rows, sort).forEach((row) => tbody.append(buildWorkListRow(row)));

  table.append(tbody);
  return table;
}

function buildWorkListHeader(sort) {
  const thead = document.createElement("thead");
  const tr = document.createElement("tr");

  WORK_LIST_COLUMNS.forEach((col) => {
    const th = document.createElement("th");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "work-list-sort-btn";
    button.dataset.sortKey = col.key;

    const active = sort.key === col.key;
    button.classList.toggle("active", active);
    button.append(document.createTextNode(col.label));
    if (active) {
      const arrow = document.createElement("span");
      arrow.className = "work-list-sort-arrow";
      arrow.textContent = sort.dir === "asc" ? " ▲" : " ▼";
      button.append(arrow);
    }

    th.append(button);
    tr.append(th);
  });

  thead.append(tr);
  return thead;
}

function buildWorkListRow(row) {
  const tr = document.createElement("tr");
  tr.className = "work-list-row";

  tr.append(workListCell(row.group || "Ungrouped"));
  tr.append(workListTicketCell(row));
  tr.append(workListCell(row.owner));
  tr.append(workListCell(row.statusLabel));

  if (!row.pr) {
    tr.append(workListCell("-"));
    tr.append(workListCell("No linked PR", "work-list-muted"));
    tr.append(workListCell("-"), workListCell("-"), workListCell("-"), workListCell("-"));
  } else if (row.pr.error) {
    const errorCell = workListCell(`Couldn't load this pull request (${row.pr.error})`, "work-list-error");
    errorCell.colSpan = 6;
    tr.append(errorCell);
  } else {
    tr.append(workListPrNumberCell(row.pr));
    tr.append(workListPrTitleCell(row.pr));
    tr.append(workListPrStatusCell(row.pr));
    tr.append(workListCell(getWorkListPendingText(row.pr)));
    tr.append(workListCell(row.pr.status === "active" ? getPrCommentsSummaryText(row.pr.comments) : "-"));
    tr.append(workListCell(row.pr.createdBy || "-"));
  }

  return tr;
}

function workListCell(text, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = text;
  return cell;
}

function workListTicketCell(row) {
  const cell = document.createElement("td");
  const label = `#${row.taskExternalId} ${row.taskName}`;
  cell.append(row.taskUrl ? workListLink(row.taskUrl, label) : document.createTextNode(label));
  return cell;
}

function workListPrNumberCell(pr) {
  const cell = document.createElement("td");
  const label = `#${pr.id}`;
  cell.append(pr.url ? workListLink(pr.url, label) : document.createTextNode(label));
  return cell;
}

function workListPrTitleCell(pr) {
  const cell = document.createElement("td");
  cell.append(pr.url ? workListLink(pr.url, pr.title) : document.createTextNode(pr.title));
  return cell;
}

function workListPrStatusCell(pr) {
  const cell = document.createElement("td");
  if (pr.status === "active") {
    cell.append(document.createTextNode("Active "));
    cell.append(prStatusHandledPill(pr.isFullyHandled));
  } else {
    cell.textContent = pr.status ? pr.status[0].toUpperCase() + pr.status.slice(1) : "Unknown";
  }
  return cell;
}

function workListLink(href, label) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}

// Plain text, same reasoning as every other Teams-shareable report in this app: Teams
// only renders markdown typed into the compose box, not pasted text.
function buildWorkListText(rows, sort) {
  if (!rows.length) return "No Azure DevOps-synced tickets in this plan yet.";

  const lines = ["Ticket / PR work list", ""];
  sortWorkListRows(rows, sort).forEach((row) => {
    lines.push(`• ${buildWorkListRowText(row)}`);
  });

  return lines.join("\n").trimEnd();
}

function buildWorkListRowText(row) {
  const parts = [row.group || "Ungrouped", `#${row.taskExternalId} ${row.taskName}`, row.owner, row.statusLabel];

  if (!row.pr) {
    parts.push("No linked PR");
  } else if (row.pr.error) {
    parts.push(`PR error: ${row.pr.error}`);
  } else {
    const handled = row.pr.status === "active" ? (row.pr.isFullyHandled ? ", fully handled" : ", needs attention") : "";
    parts.push(`PR #${row.pr.id} ${row.pr.title} (${row.pr.status}${handled})`);
    if (row.pr.url) parts.push(row.pr.url);
    if (row.pr.status === "active") {
      const pending = getWorkListPendingText(row.pr);
      parts.push(pending === "None" ? "Pending: none" : `Pending: ${pending}`);
      parts.push(getPrCommentsSummaryText(row.pr.comments));
    }
    if (row.pr.createdBy) parts.push(`Created by: ${row.pr.createdBy}`);
  }

  return parts.filter(Boolean).join(" | ");
}
