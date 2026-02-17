import { Client } from "@notionhq/client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

const DONE = ["Delivered", "Killed", "Archived"];

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

async function queryFiltered(dbId, filter, pageSize = 100) {
  try {
    const args = { database_id: dbId, page_size: pageSize };
    if (filter) args.filter = filter;
    const r = await notion.databases.query(args);
    return r.results;
  } catch (e) {
    console.error(`Error querying ${dbId}:`, e.message);
    return [];
  }
}

export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

    // Only fetch ACTIVE deliverables (not done) — much smaller dataset
    const activeFilter = {
      and: [
        { property: "Status", select: { does_not_equal: "Delivered" } },
        { property: "Status", select: { does_not_equal: "Killed" } },
        { property: "Status", select: { does_not_equal: "Archived" } },
        { property: "Status", select: { is_not_empty: true } },
      ],
    };

    // Fetch in parallel but with filters
    const [deliverables, aiDeliverables, checkIns, podLeaderForms, pmForms, headEditingForms, headCSForms, opsTasks] = await Promise.all([
      queryFiltered(DB.deliverables, activeFilter),
      queryFiltered(DB.aiDeliverables, activeFilter),
      queryFiltered(DB.checkIn),
      queryFiltered(DB.podLeader),
      queryFiltered(DB.pm),
      queryFiltered(DB.headEditing),
      queryFiltered(DB.headCS),
      queryFiltered(DB.opsTracker),
    ]);

    // --- Overview ---
    const overdue = deliverables.filter(d => {
      const dates = ["Edit Due Date", "Script Due Date", "Content Due Date"].map(n => getDate(d, n)).filter(Boolean);
      return dates.some(dt => dt < today);
    });

    const editorSet = new Set();
    deliverables.forEach(d => getPeople(d, "Editor").forEach(e => editorSet.add(e)));

    // --- Delayed People ---
    const personOverdue = {};
    overdue.forEach(d => {
      const people = [...getPeople(d, "Editor"), ...getPeople(d, "Strategist")];
      people.forEach(name => {
        if (!personOverdue[name]) personOverdue[name] = { name, count: 0 };
        personOverdue[name].count++;
      });
    });
    const delayedPeople = Object.values(personOverdue).sort((a, b) => b.count - a.count).slice(0, 15);

    // --- Pod Health (from concept name patterns) ---
    const pods = {
      "Pod 1 (North Coast)": { active: 0, overdue: 0, editors: new Set() },
      "Pod 2 (East Coast)": { active: 0, overdue: 0, editors: new Set() },
      "Pod 3 (West Coast)": { active: 0, overdue: 0, editors: new Set() },
      "Pod 4 (South Coast)": { active: 0, overdue: 0, editors: new Set() },
    };

    // Map brands to pods by code
    const brandPodMap = {
      PQ: "Pod 1 (North Coast)", UD: "Pod 1 (North Coast)", AU: "Pod 1 (North Coast)",
      TEV: "Pod 2 (East Coast)", TC: "Pod 2 (East Coast)", LL: "Pod 2 (East Coast)", DT: "Pod 2 (East Coast)",
      MN: "Pod 3 (West Coast)", BR: "Pod 3 (West Coast)", NX: "Pod 3 (West Coast)", NB: "Pod 3 (West Coast)",
      DNC: "Pod 4 (South Coast)", DNH: "Pod 4 (South Coast)", YH: "Pod 4 (South Coast)", BB: "Pod 4 (South Coast)", TP: "Pod 4 (South Coast)", ME: "Pod 4 (South Coast)",
    };

    deliverables.forEach(d => {
      const name = getTitle(d);
      const match = name.match(/MTRX_([A-Z]+)/);
      if (match) {
        const code = match[1];
        const podName = brandPodMap[code];
        if (podName && pods[podName]) {
          pods[podName].active++;
          getPeople(d, "Editor").forEach(e => pods[podName].editors.add(e));
          const dates = ["Edit Due Date", "Script Due Date", "Content Due Date"].map(n => getDate(d, n)).filter(Boolean);
          if (dates.some(dt => dt < today)) pods[podName].overdue++;
        }
      }
    });

    const podHealth = Object.entries(pods).map(([name, data]) => ({
      name,
      active: data.active,
      overdue: data.overdue,
      editors: data.editors.size,
      health: data.overdue === 0 ? "green" : data.overdue <= 5 ? "yellow" : "red",
    }));

    // --- AI Branch ---
    const overdueAI = aiDeliverables.filter(d => {
      const due = getDate(d, "Due Date");
      return due && due < today;
    });
    const aiStatusMap = {};
    aiDeliverables.forEach(d => {
      const s = getSelect(d, "Status") || "Unknown";
      aiStatusMap[s] = (aiStatusMap[s] || 0) + 1;
    });

    // --- Forms (last 7 days by created_time) ---
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

    const totalSubmitted = forms.reduce((s, f) => s + f.total, 0);

    // --- Ops Tracker ---
    const opsTaskList = opsTasks.slice(0, 15).map(t => ({
      task: getTitle(t),
      status: getSelect(t, "Status"),
      date: getDate(t, "Date"),
      hours: t.properties["Hours Spent"]?.number || 0,
    }));

    return NextResponse.json({
      overview: {
        activeDeliverables: deliverables.length,
        overdue: overdue.length,
        formCompliance: totalSubmitted,
        activeEditors: editorSet.size,
      },
      podHealth,
      delayedPeople,
      ai: {
        active: aiDeliverables.length,
        overdue: overdueAI.length,
        statuses: aiStatusMap,
      },
      forms,
      opsTracker: opsTaskList,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
