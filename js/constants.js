const STORAGE_KEY = "simple-gantt-planner-v1";
const CHECKS_VISIBLE_KEY = "simple-gantt-checks-visible-v1";
const DEVOPS_TOKEN_KEY = "simple-gantt-devops-token-v1";
const BOARD_SPLIT_KEY = "simple-gantt-board-split-v1";
const COLLAPSED_GROUPS_KEY = "simple-gantt-collapsed-groups-v1";
const COLUMN_SETTINGS_KEY = "simple-gantt-column-settings-v1";
const DEVOPS_COLLAPSED_GROUPS_KEY = "simple-gantt-devops-collapsed-groups-v1";
const VIEW_KEY = "simple-gantt-view-v1";
const GANTT_ZOOM_KEY = "simple-gantt-zoom-v1";
const GANTT_ZOOM_LEVELS = { day: 34, week: 12, month: 4 };
const PLANNING_MONTH_COUNT_KEY = "simple-gantt-planning-month-count-v1";
const DEFAULT_PLANNING_MONTH_COUNT = 4;
const DEFAULT_DEVOPS_ORG = "insolut";
const DEFAULT_DEVOPS_PROJECT = "Insurance Solutions";
const DEFAULT_WIQL = [
  "SELECT [System.Id]",
  "FROM WorkItems",
  "WHERE [System.TeamProject] = @project",
  "AND [System.Title] CONTAINS 'Kanguro'",
  "AND [System.State] <> 'Closed'",
  "AND [System.State] <> 'Removed'",
  "ORDER BY [System.ChangedDate] DESC"
].join("\n");

const statusOptions = [
  ["not-started", "Not started"],
  ["in-progress", "In progress"],
  ["done", "Done"]
];

const typeOptions = [
  ["task", "Task"],
  ["milestone", "Milestone"],
  ["Bug", "Bug"],
  ["Epic", "Epic"],
  ["Feature", "Feature"],
  ["Issue", "Issue"],
  ["Product Backlog Item", "Product Backlog Item"],
  ["Requirement", "Requirement"],
  ["User Story", "User Story"],
  ["Test Case", "Test Case"],
  ["Test Plan", "Test Plan"],
  ["Test Suite", "Test Suite"],
  ["Impediment", "Impediment"],
  ["Change Request", "Change Request"],
  ["Risk", "Risk"],
  ["Review", "Review"],
  ["Feedback Request", "Feedback Request"],
  ["Feedback Response", "Feedback Response"],
  ["Code Review Request", "Code Review Request"],
  ["Code Review Response", "Code Review Response"],
  ["Shared Steps", "Shared Steps"]
];

const taskColumns = [
  { key: "id", label: "ID", width: 78, min: 54 },
  { key: "title", label: "Task", width: 300, min: 160 },
  { key: "group", label: "Group", width: 120, min: 90 },
  { key: "type", label: "Type", width: 122, min: 100 },
  { key: "owner", label: "Owner", width: 96, min: 80 },
  { key: "start", label: "Start", width: 140, min: 110 },
  { key: "duration", label: "Days", width: 78, min: 64 },
  { key: "finish", label: "Finish", width: 118, min: 100 },
  { key: "dependsOn", label: "Depends on", width: 156, min: 110 },
  { key: "due", label: "Due", width: 140, min: 110 },
  { key: "status", label: "Status", width: 120, min: 100 },
  { key: "notes", label: "Notes", width: 148, min: 100 },
  { key: "actions", label: "Actions", width: 58, min: 48 }
];

const sampleTasks = [
  {
    id: makeId(),
    taskId: "1",
    name: "Project kickoff",
    group: "Planning",
    type: "milestone",
    owner: "",
    startDate: toIsoDate(new Date()),
    planningMonth: toIsoDate(new Date()).slice(0, 7),
    duration: 1,
    dependsOn: "",
    dueDate: "",
    status: "done",
    notes: ""
  },
  {
    id: makeId(),
    taskId: "2",
    name: "Define requirements",
    group: "Planning",
    type: "task",
    owner: "",
    startDate: addBusinessDays(toIsoDate(new Date()), 1),
    planningMonth: toIsoDate(new Date()).slice(0, 7),
    duration: 3,
    dependsOn: "",
    dueDate: "",
    status: "in-progress",
    notes: ""
  },
  {
    id: makeId(),
    taskId: "3",
    name: "Build first version",
    group: "Delivery",
    type: "task",
    owner: "",
    startDate: addBusinessDays(toIsoDate(new Date()), 4),
    planningMonth: toIsoDate(new Date()).slice(0, 7),
    duration: 5,
    dependsOn: "",
    dueDate: "",
    status: "not-started",
    notes: ""
  }
];

sampleTasks[1].dependsOn = sampleTasks[0].taskId;
sampleTasks[2].dependsOn = sampleTasks[1].taskId;

