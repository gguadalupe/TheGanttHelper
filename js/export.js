function toCsv() {
  const rows = [
    ["ID", "Task", "Group", "Type", "Owner", "Planning Month", "Start", "Duration", "Finish", "Depends On", "Due", "Status", "Notes", "Source", "External ID", "External URL"]
  ];
  state.tasks.forEach((task) => {
    rows.push([
      task.taskId,
      task.name,
      task.group,
      getTypeLabel(task.type),
      task.owner,
      task.planningMonth,
      task.startDate,
      String(task.duration),
      getFinishDate(task),
      task.dependsOn,
      task.dueDate,
      getStatusLabel(task.status),
      task.notes,
      task.source,
      task.externalId,
      task.externalUrl
    ]);
  });

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadFile(fileName, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
