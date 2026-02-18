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

// Analyze form data to extract wins and issues
function analyzeFormData(submissions) {
  const wins = [];
  const issues = [];
  
  submissions.forEach(sub => {
    const sum = sub.summary || {};
    const name = sub.name || "Unknown";
    
    // Check In Tracker fields
    if (sum.win) wins.push({ source: name, text: sum.win });
    if (sum.blockers || sum.blockerDetail) issues.push({ source: name, text: sum.blockers || sum.blockerDetail });
    if (sum.keyTasks) wins.push({ source: name, text: `Completed: ${sum.keyTasks.slice(0, 100)}` });
    
    // Pod Leader fields
    if (sum.mvp) wins.push({ source: name, text: `MVP: ${sum.mvp.slice(0, 150)}` });
    if (sum.blocker) issues.push({ source: name, text: `Blocker: ${sum.blocker.slice(0, 150)}` });
    if (sum.struggling) issues.push({ source: name, text: `Struggling: ${sum.struggling.slice(0, 150)}` });
    
    // PM fields
    if (sum.brandsAtRisk) issues.push({ source: name, text: `At Risk: ${sum.brandsAtRisk.slice(0, 150)}` });
    if (sum.whoMissed) issues.push({ source: name, text: `Missed: ${sum.whoMissed.slice(0, 150)}` });
    
    // Head of Editing fields
    if (sum.editorsDelivering) wins.push({ source: name, text: `Delivering: ${sum.editorsDelivering.slice(0, 150)}` });
    if (sum.editorsStruggling) issues.push({ source: name, text: `Struggling: ${sum.editorsStruggling.slice(0, 150)}` });
    
    // Head of CS fields
    if (sum.working) wins.push({ source: name, text: `Working: ${sum.working.slice(0, 150)}` });
    if (sum.notWorking) issues.push({ source: name, text: `Not Working: ${sum.notWorking.slice(0, 150)}` });
    if (sum.frictions) issues.push({ source: name, text: `Frictions: ${sum.frictions.slice(0, 150)}` });
    if (sum.needsAttention) issues.push({ source: name, text: `Needs Attention: ${sum.needsAttention.slice(0, 150)}` });
  });
  
  // Dedupe and limit
  const uniqWins = [...new Map(wins.map(w => [w.text.substring(0, 50), w])).values()].slice(0, 8);
  const uniqIssues = [...new Map(issues.map(i => [i.text.substring(0, 50), i])).values()].slice(0, 8);
  
  return { wins: uniqWins, issues: uniqIssues };
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

  // Forms with analysis
  const formsData = [
    { name: "Check In Tracker", data: checkIns },
    { name: "Pod Leader", data: podLeaderForms },
    { name: "Project Manager", data: pmForms },
    { name: "Head of Editing", data: headEditingForms },
    { name: "Head of CS", data: headCSForms },
  ];
  
  const forms = formsData.map(({ name, data }) => {
    const recent = data.filter(d => d.created_time >= weekAgo);
    const submissions = recent.map(d => extractFormData(d, name)).filter(s => s.name !== "Unknown");
    const analysis = analyzeFormData(submissions);
    
    return { 
      name, 
      total: recent.length, 
      submissions,
      wins: analysis.wins,
      issues: analysis.issues,
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

  await fs.writeFile("public/dashboard-data.json", JSON.stringify(result, null, 2));
  console.log("✅ Saved to public/dashboard-data.json");
  forms.forEach(f => console.log(`${f.name}: ${f.wins.length} wins, ${f.issues.length} issues`));
  return result;
}

fetchAllData().catch(console.error);
