// Fetch all dashboard data and save to JSON
import { promises as fs } from "fs";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const DB = {
  deliverables: "23fc239d-6afc-80e2-9636-d30852777d90",
  aiDeliverables: "291c239d-6afc-80ed-aaab-eae0a318a1f8",
  checkIn: "305c239d-6afc-8008-b0b2-dd5211d75e91",
  podLeader: "306c239d-6afc-80df-9257-f749d6bfd56d",
  pm: "306c239d-6afc-80db-a1cc-c4c9a599a1d0",
  headEditing: "307c239d-6afc-804e-b711-f711c797fedd",
  headCS: "307c239d-6afc-80b3-b643-d93fb4a8da21",
  opsTracker: "30ac239d-6afc-81f4-bd84-ce91fb66c464",
};

function getTitle(page) {
  for (const v of Object.values(page.properties)) {
    if (v.type === "title" && v.title?.length) return v.title.map(t => t.plain_text).join("");
  }
  return "";
}
function getSelect(page, name) {
  const p = page.properties[name];
  if (p?.type === "select") return p.select?.name || null;
  if (p?.type === "status") return p.status?.name || null;
  return null;
}
function getDate(page, name) {
  const p = page.properties[name];
  return p?.type === "date" ? p.date?.start || null : null;
}
function getPeople(page, name) {
  const p = page.properties[name];
  return p?.type === "people" ? p.people?.map(u => u.name || "Unknown") : [];
}
function getRichText(page, name) {
  const p = page.properties[name];
  if (p?.type === "rich_text") return p.rich_text?.map(t => t.plain_text).join("") || "";
  return "";
}

async function queryAll(dbId) {
  try {
    let results = [], cursor;
    do {
      const args = { database_id: dbId, page_size: 100 };
      if (cursor) args.start_cursor = cursor;
      const r = await notion.databases.query(args);
      results.push(...r.results);
      cursor = r.has_more ? r.next_cursor : null;
    } while (cursor);
    return results;
  } catch (e) {
    console.error(`Error ${dbId}:`, e.message);
    return [];
  }
}

async function fetchAllData() {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  console.log("Fetching Notion data...");
  const [deliverables, aiDeliverables, checkIns, podLeaderForms, pmForms, headEditingForms, headCSForms, opsTasks] = await Promise.all([
    queryAll(DB.deliverables),
    queryAll(DB.aiDeliverables),
    queryAll(DB.checkIn),
    queryAll(DB.podLeader),
    queryAll(DB.pm),
    queryAll(DB.headEditing),
    queryAll(DB.headCS),
    queryAll(DB.opsTracker),
  ]);

  // Filter active deliverables
  const DONE = ["Delivered", "Killed", "Archived"];
  const activeDeliverables = deliverables.filter(d => !DONE.includes(getSelect(d, "Status")));
  const overdue = activeDeliverables.filter(d => {
    const dates = ["Edit Due Date", "Script Due Date", "Content Due Date"].map(n => getDate(d, n)).filter(Boolean);
    return dates.some(dt => dt < today);
  });

  const editorSet = new Set();
  activeDeliverables.forEach(d => getPeople(d, "Editor").forEach(e => editorSet.add(e)));

  // Delayed people
  const personOverdue = {};
  overdue.forEach(d => {
    const people = [...getPeople(d, "Editor"), ...getPeople(d, "Strategist")];
    people.forEach(name => {
      if (!personOverdue[name]) personOverdue[name] = { name, count: 0 };
      personOverdue[name].count++;
    });
  });
  const delayedPeople = Object.values(personOverdue).sort((a, b) => b.count - a.count).slice(0, 20);

  // Pod health by brand code
  const pods = {
    "Pod 1 (North Coast)": { active: 0, overdue: 0, editors: new Set() },
    "Pod 2 (East Coast)": { active: 0, overdue: 0, editors: new Set() },
    "Pod 3 (West Coast)": { active: 0, overdue: 0, editors: new Set() },
    "Pod 4 (South Coast)": { active: 0, overdue: 0, editors: new Set() },
  };
  const brandPodMap = {
    PQ: "Pod 1 (North Coast)", UD: "Pod 1 (North Coast)", AU: "Pod 1 (North Coast)",
    TEV: "Pod 2 (East Coast)", TC: "Pod 2 (East Coast)", LL: "Pod 2 (East Coast)", DT: "Pod 2 (East Coast)",
    MN: "Pod 3 (West Coast)", BR: "Pod 3 (West Coast)", NX: "Pod 3 (West Coast)", NB: "Pod 3 (West Coast)",
    DNC: "Pod 4 (South Coast)", DNH: "Pod 4 (South Coast)", YH: "Pod 4 (South Coast)", BB: "Pod 4 (South Coast)", TP: "Pod 4 (South Coast)", ME: "Pod 4 (South Coast)",
  };
  activeDeliverables.forEach(d => {
    const name = getTitle(d);
    const match = name.match(/MTRX_([A-Z]+)/);
    if (match) {
      const podName = brandPodMap[match[1]];
      if (podName && pods[podName]) {
        pods[podName].active++;
        getPeople(d, "Editor").forEach(e => pods[podName].editors.add(e));
        const dates = ["Edit Due Date", "Script Due Date", "Content Due Date"].map(n => getDate(d, n)).filter(Boolean);
        if (dates.some(dt => dt < today)) pods[podName].overdue++;
      }
    }
  });
  const podHealth = Object.entries(pods).map(([name, data]) => ({
    name, active: data.active, overdue: data.overdue, editors: data.editors.size,
    health: data.overdue === 0 ? "green" : data.overdue <= 5 ? "yellow" : "red",
  }));

  // AI Branch
  const activeAI = aiDeliverables.filter(d => !DONE.includes(getSelect(d, "Status")));
  const overdueAI = activeAI.filter(d => {
    const due = getDate(d, "Due Date");
    return due && due < today;
  });
  const aiStatusMap = {};
  activeAI.forEach(d => { const s = getSelect(d, "Status") || "Unknown"; aiStatusMap[s] = (aiStatusMap[s] || 0) + 1; });

  // Forms
  const formsData = [
    { name: "Check In Tracker", data: checkIns },
    { name: "Pod Leader", data: podLeaderForms },
    { name: "Project Manager", data: pmForms },
    { name: "Head of Editing", data: headEditingForms },
    { name: "Head of CS", data: headCSForms },
  ];
  const forms = formsData.map(({ name, data }) => {
    const recent = data.filter(d => d.created_time >= weekAgo);
    const submitters = recent.map(d => getTitle(d) || getRichText(d, "Full Name") || getRichText(d, "Team Member") || "Unknown");
    return { name, total: recent.length, submitters: [...new Set(submitters)] };
  });

  // Ops Tracker
  const opsTaskList = opsTasks.slice(0, 20).map(t => ({
    task: getTitle(t),
    status: getSelect(t, "Status"),
    date: getDate(t, "Date"),
    hours: t.properties["Hours Spent"]?.number || 0,
  }));

  const result = {
    overview: {
      activeDeliverables: activeDeliverables.length,
      overdue: overdue.length,
      formCompliance: forms.reduce((s, f) => s + f.total, 0),
      activeEditors: editorSet.size,
    },
    podHealth,
    delayedPeople,
    ai: { active: activeAI.length, overdue: overdueAI.length, statuses: aiStatusMap },
    forms,
    opsTracker: opsTaskList,
    timestamp: new Date().toISOString(),
  };

  // Save to JSON
  await fs.writeFile("public/dashboard-data.json", JSON.stringify(result, null, 2));
  console.log("✅ Saved to public/dashboard-data.json");
  console.log(`Overview: ${result.overview.activeDeliverables} active, ${result.overview.overdue} overdue`);
  return result;
}

fetchAllData().catch(console.error);
