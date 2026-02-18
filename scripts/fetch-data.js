// Fetch all dashboard data and save to JSON
import { promises as fs } from "fs";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const DB = {
  aiDeliverables: "291c239d-6afc-80ed-aaab-eae0a318a1f8",
  checkIn: "305c239d-6afc-8008-b0b2-dd5211d75e91",
  podLeader: "306c239d-6afc-80df-9257-f749d6bfd56d",
  pm: "306c239d-6afc-80db-a1cc-c4c9a599a1d0",
  headEditing: "307c239d-6afc-804e-b711-f711c797fedd",
  headCS: "307c239d-6afc-80b3-b643-d93fb4a8da21",
};

function getTitle(page) {
  for (const v of Object.values(page.properties)) {
    if (v.type === "title" && v.title?.length) return v.title.map(t => t.plain_text).join("");
  }
  return "";
}
function getRichText(page, name) {
  const p = page.properties[name];
  if (!p) return "";
  if (p.type === "rich_text") return p.rich_text?.map(t => t.plain_text).join(" ") || "";
  if (p.type === "title") return p.title?.map(t => t.plain_text).join(" ") || "";
  return "";
}
function getSelect(page, name) {
  const p = page.properties[name];
  if (!p) return null;
  if (p.type === "select") return p.select?.name || null;
  if (p.type === "status") return p.status?.name || null;
  return null;
}
function getDate(page, name) {
  const p = page.properties[name];
  return p?.type === "date" ? p.date?.start || null : null;
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

function extractFormData(page, formType) {
  const name = getTitle(page) || getRichText(page, "Name") || getRichText(page, "Team Member") || "Unknown";
  const date = getDate(page, "Week") || page.created_time?.split("T")[0];
  
  let summary = {};
  
  if (formType === "Check In Tracker") {
    summary = {
      keyTasks: getRichText(page, "Key Tasks Completed"),
      workDetail: getRichText(page, "Work Detail"),
      blockers: getRichText(page, "Blockers"),
      blockerDetail: getRichText(page, "Blocker Detail"),
      win: getRichText(page, "Win Of The Week "),
    };
  } else if (formType === "Pod Leader") {
    summary = {
      pod: getRichText(page, "Pod"),
      weeklyBreakdown: getRichText(page, "Weekly Breakdown"),
      mvp: getRichText(page, "MVP"),
      blocker: getRichText(page, "#1 Blocker"),
      support: getRichText(page, "Support Needed"),
      struggling: getRichText(page, "Struggling Team Members"),
    };
  } else if (formType === "Project Manager") {
    summary = {
      summary: getRichText(page, "Weekly Summary"),
      brandsAtRisk: getRichText(page, "Brands at Risk"),
      whoMissed: getRichText(page, "Who Missed & Why?"),
      capacity: getRichText(page, "Team Capacity"),
      pod1Deadlines: getRichText(page, "Pod 1 Deadlines"),
      pod2Deadlines: getRichText(page, "Pod 2 Deadlines "),
      pod3Deadlines: getRichText(page, "Pod 3 Deadlines"),
      pod4Deadlines: getRichText(page, "Pod 4 Deadlines"),
    };
  } else if (formType === "Head of Editing") {
    summary = {
      editorsDelivering: getRichText(page, "Editors Delivering "),
      editorsStruggling: getRichText(page, "Editors Struggling"),
      rootCause: getRichText(page, "Root Cause"),
      support: getRichText(page, "Support Needed"),
      qualityByPod: getRichText(page, "Quality Breakdown by Pod"),
      nextFocus: getRichText(page, "Next Week Focus"),
    };
  } else if (formType === "Head of CS") {
    summary = {
      working: getRichText(page, "What's Working?"),
      notWorking: getRichText(page, "What's Not Working?"),
      frictions: getRichText(page, "Frictions"),
      needsAttention: getRichText(page, "Who Needs Attention?"),
      standingOut: getRichText(page, "Who's Standing Out?"),
      nextPriority: getRichText(page, "Next Week's Priority"),
    };
  }
  
  // Clean up empty fields
  Object.keys(summary).forEach(k => {
    if (!summary[k] || summary[k].trim() === "") delete summary[k];
  });
  
  return { name, date, summary };
}

async function fetchAllData() {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  console.log("Fetching Notion data...");
  const [aiDeliverables, checkIns, podLeaderForms, pmForms, headEditingForms, headCSForms] = await Promise.all([
    queryAll(DB.aiDeliverables),
    queryAll(DB.checkIn),
    queryAll(DB.podLeader),
    queryAll(DB.pm),
    queryAll(DB.headEditing),
    queryAll(DB.headCS),
  ]);

  // AI Branch
  const DONE = ["Delivered", "Killed", "Archived"];
  const activeAI = aiDeliverables.filter(d => !DONE.includes(getSelect(d, "Status")));
  const overdueAI = activeAI.filter(d => {
    const due = getDate(d, "Due Date");
    return due && due < today;
  });
  const aiStatusMap = {};
  activeAI.forEach(d => { const s = getSelect(d, "Status") || "Unknown"; aiStatusMap[s] = (aiStatusMap[s] || 0) + 1; });

  // Forms with DETAILS
  const formsData = [
    { name: "Check In Tracker", data: checkIns },
    { name: "Pod Leader", data: podLeaderForms },
    { name: "Project Manager", data: pmForms },
    { name: "Head of Editing", data: headEditingForms },
    { name: "Head of CS", data: headCSForms },
  ];
  
  const forms = formsData.map(({ name, data }) => {
    const recent = data.filter(d => d.created_time >= weekAgo);
    const submitters = recent.map(d => extractFormData(d, name)).filter(s => s.name !== "Unknown");
    
    return { 
      name, 
      total: recent.length, 
      submissions: submitters
    };
  });

  const result = {
    ai: { 
      active: activeAI.length, 
      overdue: overdueAI.length, 
      statuses: aiStatusMap 
    },
    forms,
    timestamp: new Date().toISOString(),
  };

  // Save to JSON
  await fs.writeFile("public/dashboard-data.json", JSON.stringify(result, null, 2));
  console.log("✅ Saved to public/dashboard-data.json");
  console.log(`AI: ${result.ai.active} active, ${result.ai.overdue} overdue`);
  forms.forEach(f => console.log(`${f.name}: ${f.total} submissions`));
  return result;
}

fetchAllData().catch(console.error);
