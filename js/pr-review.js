// Cross-checks each synced Azure DevOps work item's linked pull request reviewers
// against the work item's current tags, so you can see who still needs a "please
// review" tag and whose tag is stale because they've already voted. Nothing here
// writes back to DevOps - tagging stays manual (see the modal copy), because tags in
// this org use nicknames/first names rather than exact display names, so an automatic
// match can't be trusted to add/remove tags on its own.
//
// Review order isn't "everyone at once": optional reviewers go first, then required
// reviewers, then the senior-reviewer group (configured in Sync options, defaults to
// "Senior Developers") goes last of all - only once every optional AND required
// reviewer has actually approved. A reviewer whose turn hasn't arrived yet is left
// alone (not suggested for a tag) even if they haven't voted.

async function fetchReviewTagSummary(onStatus = () => {}) {
  const config = {
    org: state.devops.config.org || DEFAULT_DEVOPS_ORG,
    project: state.devops.config.project || DEFAULT_DEVOPS_PROJECT,
    seniorReviewerGroup: state.devops.config.seniorReviewerGroup || DEFAULT_SENIOR_REVIEWER_GROUP
  };
  const token = localStorage.getItem(DEVOPS_TOKEN_KEY) || "";

  if (!config.org || !config.project || !token) {
    throw new Error("Set up Azure DevOps sync (org, project, token) in Sync options first.");
  }

  const syncedTasks = state.tasks.filter((task) => task.source === "azure-devops" && task.externalId);
  if (!syncedTasks.length) {
    return { tasks: [], prSummaries: [], prSummaryErrors: 0 };
  }

  onStatus(`Fetching ${syncedTasks.length} work item${syncedTasks.length === 1 ? "" : "s"}...`);
  const ids = syncedTasks.map((task) => task.externalId);
  const workItems = await fetchDevopsWorkItems(config, token, ids);
  const workItemById = new Map(workItems.map((workItem) => [String(workItem.id), workItem]));

  const prRefsByTaskId = new Map();
  const uniquePrIds = new Set();
  syncedTasks.forEach((task) => {
    const workItem = workItemById.get(String(task.externalId));
    const refs = workItem ? getDevopsPullRequestRefs(workItem) : [];
    prRefsByTaskId.set(task.id, refs);
    refs.forEach((ref) => uniquePrIds.add(ref.pullRequestId));
  });

  if (!uniquePrIds.size) {
    return {
      tasks: syncedTasks.map((task) => buildReviewTaskEntry(task, workItemById.get(String(task.externalId)), [], config)),
      prSummaries: [],
      prSummaryErrors: 0
    };
  }

  onStatus(`Fetching ${uniquePrIds.size} pull request${uniquePrIds.size === 1 ? "" : "s"}...`);
  const prEntries = await Promise.all(
    Array.from(uniquePrIds).map(async (pullRequestId) => {
      try {
        const pr = await fetchDevopsPullRequest(config, token, pullRequestId);
        return [pullRequestId, pr];
      } catch (error) {
        return [pullRequestId, { fetchError: error.message || "Failed to load this pull request." }];
      }
    })
  );
  const prById = new Map(prEntries);

  const tasks = syncedTasks.map((task) => {
    const workItem = workItemById.get(String(task.externalId));
    const refs = prRefsByTaskId.get(task.id) || [];
    const prs = refs.map((ref) => prById.get(ref.pullRequestId)).filter(Boolean);
    return buildReviewTaskEntry(task, workItem, prs, config);
  });

  const { prSummaries, erroredCount } = buildPrSummaries(syncedTasks, prRefsByTaskId, prById, config);

  return { tasks, prSummaries, prSummaryErrors: erroredCount };
}

// One row per unique active PR (not per task - the same PR can be linked from more than
// one work item) for the "share with the team" list: who's pending right now, same
// ordering rules as the tag check, so this never asks someone to look before it's
// actually their turn.
function buildPrSummaries(syncedTasks, prRefsByTaskId, prById, config) {
  const summaryById = new Map();
  let erroredCount = 0;

  syncedTasks.forEach((task) => {
    const refs = prRefsByTaskId.get(task.id) || [];
    refs.forEach((ref) => {
      const pr = prById.get(ref.pullRequestId);
      if (!pr) return;
      if (pr.fetchError) {
        erroredCount += 1;
        return;
      }
      if (pr.status !== "active") return;

      if (!summaryById.has(ref.pullRequestId)) {
        summaryById.set(ref.pullRequestId, {
          pullRequestId: ref.pullRequestId,
          title: pr.title || `Pull request #${ref.pullRequestId}`,
          url: getDevopsPullRequestUrl(pr, config),
          createdBy: pr.createdBy?.displayName || "",
          taskRefs: [],
          reviewers: getPullRequestReviewerFacts(pr, config)
        });
      }
      summaryById.get(ref.pullRequestId).taskRefs.push({
        taskExternalId: task.externalId,
        taskName: task.name,
        taskUrl: task.externalUrl
      });
    });
  });

  // "Fully approved" must mean every reviewer has actually voted - not just that no
  // one is eligible to vote *yet*. A reviewer stuck behind an earlier stage (most
  // often the senior group, waiting on everyone else) still hasn't voted, so they
  // belong in pendingLater, not in a false "nothing pending" result.
  const prSummaries = Array.from(summaryById.values())
    .map((summary) => {
      const notVoted = summary.reviewers.filter((reviewer) => reviewer.vote === 0);
      return {
        ...summary,
        pendingNow: notVoted.filter((reviewer) => reviewer.stageEligible).map((reviewer) => reviewer.name),
        pendingLater: notVoted.filter((reviewer) => !reviewer.stageEligible).map((reviewer) => reviewer.name)
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  return { prSummaries, erroredCount };
}

// Plain text on purpose - Teams only live-renders markdown as you type it in the
// compose box, not when you paste preformatted text, so markdown syntax here would
// just show up as literal asterisks/dashes instead of formatting.
function buildTeamsMessageText(prSummaries) {
  if (!prSummaries.length) {
    return "No active pull requests need review right now.";
  }

  const lines = ["Pull requests open for review:", ""];
  prSummaries.forEach((pr) => {
    const taskLabel = pr.taskRefs.map((ref) => `#${ref.taskExternalId} ${ref.taskName}`).join(", ");
    lines.push(`• ${pr.title}${taskLabel ? ` (${taskLabel})` : ""}`);
    if (pr.createdBy) lines.push(`  Created by: ${pr.createdBy}`);
    if (pr.url) lines.push(`  ${pr.url}`);
    lines.push(`  ${getPrPendingSummaryText(pr)}`);
    lines.push("");
  });
  lines.push("Please take a look when you can. Thanks!");

  return lines.join("\n");
}

// "Fully approved" is only claimed when NEITHER list has anyone left in it - pendingLater
// (reviewers DevOps is still waiting on, just not their turn yet per the review-order
// rules) must still show up here, or a PR that's actually still pending on e.g. the
// senior group would get reported as fully approved.
function getPrPendingSummaryText(pr) {
  if (pr.pendingNow.length) return `Pending: ${pr.pendingNow.join(", ")}`;
  if (pr.pendingLater.length) return `Pending (once earlier reviewers finish): ${pr.pendingLater.join(", ")}`;
  return "Pending: none - fully approved";
}

// Built as real DOM (not an HTML string) so reviewer/task/PR text is always inserted
// via textContent - safe even if a title or display name happens to contain markup.
// This same element's innerHTML is what gets copied for the rich-text (Teams) paste.
function renderPrStatusHtml(prSummaries) {
  const container = document.createElement("div");
  container.className = "pr-status-html";

  if (!prSummaries.length) {
    const empty = document.createElement("p");
    empty.textContent = "No active pull requests need review right now.";
    container.append(empty);
    return container;
  }

  const intro = document.createElement("p");
  intro.textContent = "Pull requests open for review:";
  container.append(intro);

  const list = document.createElement("ul");
  prSummaries.forEach((pr) => {
    list.append(renderPrStatusItem(pr));
  });
  container.append(list);

  const outro = document.createElement("p");
  outro.textContent = "Please take a look when you can. Thanks!";
  container.append(outro);

  return container;
}

function renderPrStatusItem(pr) {
  const item = document.createElement("li");

  // PR link and work item link(s) are kept on their own labeled lines, not run together
  // inline - when they sat right next to each other on one line, both styled the same
  // way, it was too easy to click the work item link while aiming for the PR.
  const title = document.createElement("div");
  title.className = "pr-status-title";
  title.append(document.createTextNode("PR: "));
  title.append(pr.url ? prStatusLink(pr.url, pr.title) : document.createTextNode(pr.title));
  item.append(title);

  if (pr.taskRefs.length) {
    const tasks = document.createElement("div");
    tasks.className = "pr-status-tasks";
    tasks.append(document.createTextNode(pr.taskRefs.length > 1 ? "Work items: " : "Work item: "));
    pr.taskRefs.forEach((ref, index) => {
      if (index > 0) tasks.append(document.createTextNode(", "));
      const label = `#${ref.taskExternalId} ${ref.taskName}`;
      tasks.append(ref.taskUrl ? prStatusLink(ref.taskUrl, label) : document.createTextNode(label));
    });
    item.append(tasks);
  }

  if (pr.createdBy) {
    const author = document.createElement("div");
    author.className = "pr-status-author";
    author.textContent = `Created by: ${pr.createdBy}`;
    item.append(author);
  }

  const pending = document.createElement("div");
  pending.className = "pr-status-pending";
  pending.textContent = getPrPendingSummaryText(pr);
  item.append(pending);

  return item;
}

function prStatusLink(href, label) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}

function buildReviewTaskEntry(task, workItem, prs, config) {
  const tags = splitDevopsTags(workItem?.fields?.["System.Tags"]);
  const activePrs = prs.filter((pr) => !pr.fetchError && pr.status === "active");
  const prErrors = prs.filter((pr) => pr.fetchError).map((pr) => pr.fetchError);

  // A work item can have more than one active PR linked to it - collect every
  // reviewer's per-PR facts first, then decide add/remove/waiting/ok once per person
  // across ALL of those PRs (see aggregateReviewerEntries), not per PR in isolation.
  // Only taggable reviewers (individuals, plus the recognized senior group) are
  // relevant here - there's no tag to suggest for an unrecognized team.
  const perPrFacts = [];
  activePrs.forEach((pr) => {
    perPrFacts.push(...getPullRequestReviewerFacts(pr, config).filter((fact) => fact.isTaggable));
  });

  return {
    taskId: task.id,
    taskName: task.name,
    taskExternalId: task.externalId,
    taskUrl: task.externalUrl,
    currentTags: tags,
    activePrCount: activePrs.length,
    linkedPrCount: prs.length,
    prErrors,
    reviewers: aggregateReviewerEntries(perPrFacts, tags)
  };
}

// Computes per-PR facts (vote, whether their review stage has cleared, whether there's
// an individual/known identity to actually tag) for every non-declined reviewer. It
// deliberately doesn't decide add/remove/waiting/ok itself - that depends on every PR
// the reviewer is on for this task, not just this one (see aggregateReviewerEntries).
//
// A reviewer who declined (Azure DevOps' hasDeclined flag, set when someone removes
// themselves from the review instead of voting) is dropped entirely - ignored, not
// "waiting", and doesn't block later review stages.
//
// Every OTHER reviewer is kept, including teams/groups DevOps itself is still waiting
// on, even ones this org's Sync options don't specifically recognize as the senior
// group: dropping an unrecognized team used to make a PR with a genuinely pending team
// reviewer look "fully approved" in the status summary, which was wrong. What those
// unrecognized teams don't get is staging (isTaggable: false) - there's no individual
// name to suggest tagging for an arbitrary team, and no reason to gate anyone else's
// turn on a team this config doesn't know about.
function getPullRequestReviewerFacts(pr, config) {
  const isSenior = (reviewer) => isSeniorReviewerGroup(reviewer, config.seniorReviewerGroup);
  const allReviewers = (pr.reviewers || []).filter((reviewer) => !reviewer.hasDeclined);
  const taggable = allReviewers.filter((reviewer) => !reviewer.isContainer || isSenior(reviewer));

  const optionalReviewers = taggable.filter((reviewer) => !reviewer.isRequired && !isSenior(reviewer));
  const requiredReviewers = taggable.filter((reviewer) => reviewer.isRequired && !isSenior(reviewer));

  const optionalStageCleared = optionalReviewers.every((reviewer) => isApprovedVote(reviewer.vote));
  const requiredStageCleared = optionalStageCleared && requiredReviewers.every((reviewer) => isApprovedVote(reviewer.vote));

  return allReviewers.map((reviewer) => {
    const senior = isSenior(reviewer);
    const isTaggable = !reviewer.isContainer || senior;
    // Optional reviewers go first (no gate); required reviewers wait on optional; the
    // senior group waits on both. An unrecognized team isn't part of that staging at
    // all - DevOps is just waiting on them directly, same as any un-gated reviewer.
    const stageEligible = !isTaggable ? true : (senior ? requiredStageCleared : (reviewer.isRequired ? optionalStageCleared : true));

    return {
      name: reviewer.displayName || "Unknown reviewer",
      vote: Number(reviewer.vote) || 0,
      isRequired: Boolean(reviewer.isRequired),
      isSeniorGroup: senior,
      isTaggable,
      stageEligible,
      waitingOn: senior ? "required & optional reviewers" : "optional reviewers",
      prTitle: pr.title || `Pull request #${pr.pullRequestId}`,
      prUrl: getDevopsPullRequestUrl(pr, config)
    };
  });
}

// One person can be a reviewer on more than one PR linked to the same work item.
// Voting on one doesn't clear them - they only stop needing their tag once they've
// voted on every active PR they're a reviewer for; a pending PR anywhere keeps the
// tag (and the "add" suggestion, once it's actually their turn on that PR).
function aggregateReviewerEntries(perPrFacts, tags) {
  const byName = new Map();
  perPrFacts.forEach((fact) => {
    const key = fact.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(fact);
  });

  return Array.from(byName.values()).map((facts) => {
    const name = facts[0].name;
    const matchedTag = findMatchingTag(tags, name);
    const pendingFacts = facts.filter((fact) => fact.vote === 0);
    const eligibleNow = pendingFacts.some((fact) => fact.stageEligible);

    let action;
    if (!pendingFacts.length) action = matchedTag ? "remove" : "ok";
    else if (eligibleNow) action = matchedTag ? "ok" : "add";
    else action = "waiting";

    return {
      name,
      isRequired: facts.some((fact) => fact.isRequired),
      isSeniorGroup: facts[0].isSeniorGroup,
      matchedTag,
      action,
      waitingOn: action === "waiting" ? pendingFacts[0].waitingOn : "",
      prs: facts.map((fact) => ({ prTitle: fact.prTitle, prUrl: fact.prUrl, vote: fact.vote }))
    };
  });
}

function isApprovedVote(vote) {
  const value = Number(vote) || 0;
  return value === 10 || value === 5;
}

// Exact match first, but Azure DevOps sometimes prefixes a team's display name with
// the project (e.g. "[My Project]\Senior Developers"), so a plain === check could miss
// the configured group and silently treat it as just another unrecognized team -
// which is exactly what made a PR with Senior Developers still pending look "fully
// approved". A loose substring match in either direction catches that without needing
// the Sync options field to be typed exactly byte-for-byte.
function isSeniorReviewerGroup(reviewer, seniorReviewerGroup) {
  if (!reviewer.isContainer) return false;
  const name = String(reviewer.displayName || "").trim().toLowerCase();
  const configured = String(seniorReviewerGroup || DEFAULT_SENIOR_REVIEWER_GROUP).trim().toLowerCase();
  if (!name || !configured) return false;
  return name === configured || name.includes(configured) || configured.includes(name);
}

function splitDevopsTags(raw) {
  return String(raw || "").split(";").map((tag) => tag.trim()).filter(Boolean);
}

// Display names in this org don't match the tags people actually type (nicknames,
// first names only), so this is a best-effort heuristic, not a reliable match: a tag
// counts as "this reviewer" if the tag text appears inside their full name, or their
// first name appears inside the tag text. Nicknames unrelated to the first name (e.g.
// "Chip" for "Charles") won't be caught - the modal always shows the matched tag text
// next to the full name so it stays visible for a human to double-check.
function findMatchingTag(tags, displayName) {
  const fullName = String(displayName || "").trim().toLowerCase();
  if (!fullName) return "";
  const firstName = fullName.split(/\s+/)[0] || "";

  return tags.find((tag) => {
    const normalizedTag = tag.toLowerCase();
    if (!normalizedTag) return false;
    return fullName.includes(normalizedTag) || (firstName && normalizedTag.includes(firstName));
  }) || "";
}

// Work item relations use the same ArtifactLink shape as any other linked artifact;
// PR links are identified by the vstfs:///Git/PullRequestId/ URL prefix, which encodes
// "{projectId}/{repositoryId}/{pullRequestId}" (the path separators are %2F-encoded).
function getDevopsPullRequestRefs(workItem) {
  return (workItem.relations || [])
    .filter((relation) => relation.rel === "ArtifactLink" && /PullRequestId\//i.test(relation.url || ""))
    .map((relation) => parseDevopsPullRequestArtifactUrl(relation.url))
    .filter(Boolean);
}

function parseDevopsPullRequestArtifactUrl(url) {
  const match = /PullRequestId\/([^/]+)$/i.exec(url || "");
  if (!match) return null;
  const segments = decodeURIComponent(match[1]).split("/");
  const pullRequestId = segments.at(-1);
  if (!pullRequestId || !/^\d+$/.test(pullRequestId)) return null;
  return { pullRequestId };
}

// Organization-scoped "get PR by id" endpoint - no need to resolve the repository GUID
// from the artifact link first.
async function fetchDevopsPullRequest(config, token, pullRequestId) {
  const url = `${getDevopsOrgUrl(config.org)}/_apis/git/pullrequests/${pullRequestId}?api-version=7.1`;
  return fetchDevopsJson(url, { headers: devopsHeaders(token) });
}

// pr._links.web.href is the correct, preferred source, but PR objects embedded inside
// a batch/aggregated response don't always carry it (and the nested repository.project
// object usually has no _links at all, so that was never a reliable fallback - it's
// what was producing a work item link instead of the PR link). The deterministic
// fallback below only needs the org (already known) and repo/project names, both of
// which are reliably present directly on the PR response.
function getDevopsPullRequestUrl(pr, config) {
  if (pr._links?.web?.href) return pr._links.web.href;

  const orgUrl = config?.org ? getDevopsOrgUrl(config.org) : "";
  const projectName = pr.repository?.project?.name || config?.project || "";
  const repoName = pr.repository?.name || "";
  if (orgUrl && projectName && repoName && pr.pullRequestId) {
    return `${orgUrl}/${encodeURIComponent(projectName)}/_git/${encodeURIComponent(repoName)}/pullrequest/${pr.pullRequestId}`;
  }
  return "";
}

function renderReviewTagsSummary(summary) {
  reviewTagsContent.textContent = "";

  if (!summary.tasks.length) {
    const empty = document.createElement("p");
    empty.className = "review-tags-empty";
    empty.textContent = "No Azure DevOps-synced tasks in this plan yet.";
    reviewTagsContent.append(empty);
    return;
  }

  const toAdd = [];
  const toRemove = [];
  const waiting = [];
  const ok = [];
  const taskErrors = [];

  summary.tasks.forEach((task) => {
    if (task.prErrors.length) taskErrors.push(task);
    task.reviewers.forEach((reviewer) => {
      const row = { task, reviewer };
      if (reviewer.action === "add") toAdd.push(row);
      else if (reviewer.action === "remove") toRemove.push(row);
      else if (reviewer.action === "waiting") waiting.push(row);
      else ok.push(row);
    });
  });

  reviewTagsContent.append(
    reviewTagsSection(
      "Tags to add",
      `${toAdd.length} reviewer${toAdd.length === 1 ? "" : "s"} whose turn it is now and aren't tagged yet - add their name.`,
      toAdd,
      "add"
    ),
    reviewTagsSection(
      "Tags to remove",
      `${toRemove.length} reviewer${toRemove.length === 1 ? "" : "s"} already reviewed but ${toRemove.length === 1 ? "is" : "are"} still tagged - remove the tag.`,
      toRemove,
      "remove"
    )
  );

  if (waiting.length) {
    reviewTagsContent.append(reviewTagsSection(
      "Not their turn yet",
      `${waiting.length} reviewer${waiting.length === 1 ? "" : "s"} still waiting on earlier reviewers - don't tag them yet.`,
      waiting,
      "waiting",
      true
    ));
  }

  if (ok.length) {
    reviewTagsContent.append(reviewTagsSection(
      "Already OK",
      `${ok.length} reviewer${ok.length === 1 ? "" : "s"} correctly tagged or correctly untagged - nothing to do.`,
      ok,
      "ok",
      true
    ));
  }

  if (taskErrors.length) {
    const errorBlock = document.createElement("div");
    errorBlock.className = "review-tags-errors";
    const heading = document.createElement("h3");
    heading.textContent = "Couldn't load some pull requests";
    errorBlock.append(heading);
    taskErrors.forEach((task) => {
      const p = document.createElement("p");
      p.textContent = `#${task.taskExternalId} ${task.taskName}: ${task.prErrors.join("; ")}`;
      errorBlock.append(p);
    });
    reviewTagsContent.append(errorBlock);
  }

  const tasksWithNoLinkedPr = summary.tasks.filter((task) => !task.linkedPrCount);
  const tasksWithNoActivePr = summary.tasks.filter((task) => task.linkedPrCount && !task.activePrCount && !task.prErrors.length);
  if (tasksWithNoLinkedPr.length || tasksWithNoActivePr.length) {
    const note = document.createElement("p");
    note.className = "review-tags-note";
    const noLink = tasksWithNoLinkedPr.length ? `${tasksWithNoLinkedPr.length} task${tasksWithNoLinkedPr.length === 1 ? "" : "s"} with no linked pull request` : "";
    const noActive = tasksWithNoActivePr.length ? `${tasksWithNoActivePr.length} task${tasksWithNoActivePr.length === 1 ? "" : "s"} with only completed/abandoned pull requests` : "";
    note.textContent = ["Not shown above -", [noLink, noActive].filter(Boolean).join(", ")].join(" ");
    reviewTagsContent.append(note);
  }
}

function reviewTagsSection(title, description, rows, kind, collapsedByDefault = false) {
  const section = document.createElement("details");
  section.className = `review-tags-section ${kind}`;
  section.open = !collapsedByDefault;

  const summaryEl = document.createElement("summary");
  summaryEl.textContent = `${title} (${rows.length})`;
  section.append(summaryEl);

  const desc = document.createElement("p");
  desc.className = "review-tags-section-desc";
  desc.textContent = description;
  section.append(desc);

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "review-tags-empty";
    empty.textContent = "Nothing here.";
    section.append(empty);
    return section;
  }

  const list = document.createElement("ul");
  list.className = "review-tags-list";
  rows.forEach(({ task, reviewer }) => list.append(reviewTagsRow(task, reviewer, kind)));
  section.append(list);
  return section;
}

function reviewTagsRow(task, reviewer, kind) {
  const item = document.createElement("li");
  item.className = "review-tags-row";

  const head = document.createElement("div");
  head.className = "review-tags-row-head";
  const name = document.createElement("strong");
  name.textContent = reviewer.name;
  head.append(name);

  if (reviewer.isSeniorGroup) {
    head.append(reviewTagsPill("senior - reviews last"));
  } else if (!reviewer.isRequired) {
    head.append(reviewTagsPill("optional"));
  } else {
    head.append(reviewTagsPill("required"));
  }
  item.append(head);

  const detail = document.createElement("p");
  const multiplePrs = reviewer.prs.length > 1;
  const prStatusParts = reviewer.prs.map((pr) => multiplePrs
    ? `${pr.prTitle}: ${getReviewVoteLabel(pr.vote)}`
    : `${pr.prTitle} | ${getReviewVoteLabel(pr.vote)}`);
  const parts = [`#${task.taskExternalId} ${task.taskName}`, ...prStatusParts];
  if (kind === "remove") parts.push(`current tag: "${reviewer.matchedTag}"`);
  if (kind === "ok" && reviewer.matchedTag) parts.push(`tagged as "${reviewer.matchedTag}"`);
  if (kind === "waiting") parts.push(`waiting on: ${reviewer.waitingOn}`);
  detail.textContent = parts.filter(Boolean).join(" | ");
  item.append(detail);

  const links = document.createElement("div");
  links.className = "review-tags-row-links";
  reviewer.prs.forEach((pr, index) => {
    if (pr.prUrl) links.append(reviewTagsLink(pr.prUrl, multiplePrs ? `Open PR ${index + 1}` : "Open PR"));
  });
  if (task.taskUrl) links.append(reviewTagsLink(task.taskUrl, "Open work item"));
  if (links.childElementCount) item.append(links);

  return item;
}

function reviewTagsPill(text) {
  const pill = document.createElement("span");
  pill.className = "review-tags-pill";
  pill.textContent = text;
  return pill;
}

function reviewTagsLink(href, label) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  link.className = "review-tags-link";
  return link;
}

function getReviewVoteLabel(vote) {
  if (vote === 10) return "Approved";
  if (vote === 5) return "Approved with suggestions";
  if (vote === -5) return "Waiting for author";
  if (vote === -10) return "Rejected";
  return "No vote yet";
}
