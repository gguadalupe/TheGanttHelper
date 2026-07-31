function loadGanttZoom() {
  const saved = localStorage.getItem(GANTT_ZOOM_KEY);
  return GANTT_ZOOM_LEVELS[saved] ? saved : "day";
}

function renderGantt(analysis) {
  gantt.textContent = "";

  if (!state.tasks.length || !analysis.range) {
    gantt.append(emptyStateTemplate.content.cloneNode(true));
    return;
  }

  const days = enumerateDays(analysis.range.start, analysis.range.end);
  const dayWidth = GANTT_ZOOM_LEVELS[currentZoom] || GANTT_ZOOM_LEVELS.day;
  const columnsTemplate = `repeat(${days.length}, minmax(${dayWidth}px, 1fr))`;
  const inner = document.createElement("div");
  inner.className = "gantt-inner";
  inner.style.width = `${days.length * dayWidth}px`;
  inner.style.setProperty("--gantt-col-w", `${dayWidth}px`);

  const header = document.createElement("div");
  header.className = "gantt-header";
  header.append(labelCell("Task", ""));

  const axis = document.createElement("div");
  axis.className = "axis";
  axis.style.gridTemplateColumns = columnsTemplate;

  getMonthSpans(days).forEach((month) => {
    const cell = document.createElement("div");
    cell.className = "month-cell";
    cell.style.gridColumn = `${month.startIndex + 1} / span ${month.dayCount}`;
    cell.textContent = month.label;
    axis.append(cell);
  });

  if (currentZoom === "day") {
    days.forEach((day, index) => {
      const cell = document.createElement("div");
      cell.className = dayCellClass(day, "axis-cell");
      cell.style.gridColumn = `${index + 1}`;
      cell.innerHTML = `<strong>${day.slice(8, 10)}</strong><br>${weekdayLabel(day)}`;
      axis.append(cell);
    });
  } else {
    getWeekSpans(days).forEach((week) => {
      const cell = document.createElement("div");
      cell.className = "axis-cell week-cell";
      cell.style.gridColumn = `${week.startIndex + 1} / span ${week.dayCount}`;
      cell.textContent = week.label;
      axis.append(cell);
    });
  }

  header.append(axis);
  inner.append(header);

  const warningTasks = groupWarningsByTask(analysis.warnings);

  getTaskGroups().forEach((group) => {
    const collapsed = isGroupCollapsed(group.name);
    const rollup = getGroupRollup(group.tasks);
    const row = document.createElement("div");
    row.className = "gantt-group-row";
    row.append(labelCell(group.name, rollup.totalCount ? `${rollup.doneCount}/${rollup.totalCount} done` : "0 tasks"));

    const track = document.createElement("div");
    track.className = "track group-track";
    track.style.gridTemplateColumns = columnsTemplate;
    const groupRange = rollup.range;
    if (groupRange) {
      const startIndex = days.indexOf(groupRange.start);
      const endIndex = days.indexOf(groupRange.end);
      if (startIndex >= 0 && endIndex >= 0) {
        const summary = document.createElement("div");
        summary.className = "group-summary-bar";
        summary.dataset.groupName = group.name;
        summary.style.gridColumn = `${startIndex + 1} / span ${endIndex - startIndex + 1}`;
        summary.title = `${group.name}: ${formatShortDate(groupRange.start)} to ${formatShortDate(groupRange.end)} (drag to reschedule)`;

        const fill = document.createElement("div");
        fill.className = "group-summary-fill";
        fill.style.width = `${rollup.totalCount ? Math.round((rollup.doneCount / rollup.totalCount) * 100) : 0}%`;
        summary.append(fill);

        track.append(summary);
      }
    }
    row.append(track);
    inner.append(row);

    if (collapsed) return;

    group.tasks.forEach((task) => {
      const taskRow = document.createElement("div");
      taskRow.className = "gantt-row";
      taskRow.append(labelCell(task.name || "Untitled task", isMilestoneType(task.type) ? "Milestone" : `${task.duration}d`));

      const taskTrack = document.createElement("div");
      taskTrack.className = "track";
      taskTrack.style.gridTemplateColumns = columnsTemplate;

      days.forEach((day, index) => {
        const cell = document.createElement("div");
        cell.className = dayCellClass(day, "day-cell");
        cell.style.gridColumn = `${index + 1}`;
        taskTrack.append(cell);
      });

      const startIndex = days.indexOf(task.startDate);
      const finishDate = getFinishDate(task);
      const finishIndex = days.indexOf(finishDate);
      if (startIndex >= 0 && finishIndex >= 0) {
        if (isMilestoneType(task.type)) {
          const milestone = document.createElement("div");
          milestone.className = [
            "milestone",
            isDoneStatus(task.status) ? "done" : "",
            warningTasks.has(task.id) ? "warning" : ""
          ].filter(Boolean).join(" ");
          milestone.style.gridColumn = `${startIndex + 1}`;
          milestone.title = `${task.name || "Untitled milestone"}: ${formatShortDate(task.startDate)}`;
          milestone.setAttribute("aria-label", milestone.title);
          taskTrack.append(milestone);
        } else {
          const bar = document.createElement("div");
          bar.className = [
            "bar",
            isInProgressStatus(task.status) ? "in-progress" : "",
            isDoneStatus(task.status) ? "done" : "",
            warningTasks.has(task.id) ? "warning" : ""
          ].filter(Boolean).join(" ");
          bar.style.gridColumn = `${startIndex + 1} / span ${finishIndex - startIndex + 1}`;
          bar.textContent = task.name || "Untitled task";
          bar.title = `${task.name || "Untitled task"}: ${formatShortDate(task.startDate)} to ${formatShortDate(finishDate)}`;
          taskTrack.append(bar);
        }
      }

      taskRow.append(taskTrack);
      inner.append(taskRow);
    });
  });

  const todayIndex = days.indexOf(toIsoDate(new Date()));
  if (todayIndex >= 0) {
    const todayLine = document.createElement("div");
    todayLine.className = "gantt-today-line";
    todayLine.style.left = `${todayIndex * dayWidth}px`;
    inner.append(todayLine);
  }

  gantt.append(inner);
}

function getMonthSpans(days) {
  const months = [];
  days.forEach((day, index) => {
    const monthKey = day.slice(0, 7);
    const current = months.at(-1);
    if (current?.key === monthKey) {
      current.dayCount += 1;
      return;
    }

    months.push({
      key: monthKey,
      startIndex: index,
      dayCount: 1,
      label: formatMonthLabel(day)
    });
  });
  return months;
}

function getWeekSpans(days) {
  const weeks = [];
  days.forEach((day, index) => {
    const weekKey = getWeekStart(day);
    const current = weeks.at(-1);
    if (current?.key === weekKey) {
      current.dayCount += 1;
      return;
    }

    weeks.push({
      key: weekKey,
      startIndex: index,
      dayCount: 1,
      label: formatDayMonthLabel(weekKey)
    });
  });
  return weeks;
}

function getWeekStart(isoDate) {
  const date = parseIsoDate(isoDate);
  const weekday = date.getUTCDay();
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + offsetToMonday);
  return toIsoDate(date);
}

function formatDayMonthLabel(isoDate) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(parseIsoDate(isoDate));
}

function labelCell(title, detail) {
  const cell = document.createElement("div");
  cell.className = "gantt-label";
  const strong = document.createElement("strong");
  strong.textContent = title;
  cell.append(strong);
  if (detail) {
    const span = document.createElement("span");
    span.textContent = detail;
    cell.append(span);
  }
  return cell;
}

function dayCellClass(day, base) {
  return [
    base,
    isWeekendIso(day) ? "weekend" : "",
    day === toIsoDate(new Date()) ? "today" : ""
  ].filter(Boolean).join(" ");
}

