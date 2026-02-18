// Fetch all dashboard data and save to JSON
import { promises as fs } from "fs";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const DB = {
  aiDeliverables: "291c239d-6afc-80ed-aaab-eae0a318a1f8",
  aiBrands: "291c239d-6afc-8072-8e43-f87787ac6831",
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
function getRelation(page, name) {
  const p = page.properties[name];
  if (!p || p.type !== "relation") return [];
  return p.relation?.map(r => r.id) || [];
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
    
    if (sum.win) wins.push({ source: name, text: sum.win });
    if (sum.blockers || sum.blockerDetail) issues.push({ source: name, text: sum.blockers || sum.blockerDetail });
    if (sum.keyTasks) wins.push({ source: name, text: `Completed: ${sum.keyTasks.slice(0, 100)}` });
    if (sum.mvp) wins.push({ source: name, text: `MVP: ${sum.mvp.slice(0, 150)}` });
    if (sum.blocker) issues.push({ source: name, text: `Blocker: ${sum.blocker.slice(0, 150)}` });
    if (sum.struggling) issues.push({ source: name, text: `Struggling: ${sum.struggling.slice(0, 150)}` });
    if (sum.brandsAtRisk) issues.push({ source: name, text: `At Risk: ${sum.brandsAtRisk.slice(0, 150)}` });
    if (sum.whoMissed) issues.push({ source: name, text: `Missed: ${sum.whoMissed.slice(0, 150)}` });
    if (sum.editorsDelivering) wins.push({ source: name, text: `Delivering: ${sum.editorsDelivering.slice(0, 150)}` });
    if (sum.editorsStruggling) issues.push({ source: name, text: `Struggling: ${sum.editorsStruggling.slice(0, 150)}` });
    if (sum.working) wins.push({ source: name, text: `Working: ${sum.working.slice(0, 150)}` });
    if (sum.notWorking) issues.push({ source: name, text: `Not Working: ${sum.notWorking.slice(0, 150)}` });
    if (sum.frictions) issues.push({ source: name, text: `Frictions: ${sum.frictions.slice(0, 150)}` });
    if (sum.needsAttention) issues.push({ source: name, text: `Needs Attention: ${sum.needsAttention.slice(0, 150)}` });
  });
  
  const uniqWins = [...new Map(wins.map(w => [w.text.substring(0, 50), w])).values()].slice(0, 8);
  const uniqIssues = [...new Map(issues.map(i => [i.text.substring(0, 50), i])).values()].slice(0, 8);
  
  return { wins: uniqWins, issues: uniqIssues };
}

function extractFormData(page, formType) {
  let name = "Unknown";
  
  if (formType === "Pod Leader") {
    name = getRichText(page, "Name") || getTitle(page) || getRichText(page, "Team Member");
  } else if (formType === "Project Manager") {
    name = getRichText(page, "Name") || getTitle(page);
  } else if (formType === "Head of Editing" || formType === "Head of CS") {
    name = getRichText(page, "Name") || getTitle(page);
  } else {
    name = getRichText(page, "Team Member") || getRichText(page, "Name") || getTitle(page);
  }
  
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
  
  Object.keys(summary).forEach(k => {
    if (!summary[k] || summary[k].trim() === "") delete summary[k];
  });
  
  return { name: name || "Unknown", date, summary };
}

async function fetchAllData() {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  console.log("Fetching Notion data...");
  const [aiDeliverables, aiBrands, checkIns, podLeaderForms, pmForms, headEditingForms, headCSForms] = await Promise.all([
    queryAll(DB.aiDeliverables),
    queryAll(DB.aiBrands),
    queryAll(DB.checkIn),
    queryAll(DB.podLeader),
    queryAll(DB.pm),
    queryAll(DB.headEditing),
    queryAll(DB.headCS),
  ]);

  // Build brand map - use Brand Name field
  const brandMap = {};
  const brandCreatedTimes = {};
  aiBrands.forEach(b => {
    // Try "Brand Name" first, then fall back to "Name"
    const name = b.properties["Brand Name"]?.rich_text?.[0]?.plain_text || getTitle(b);
    if (name) {
      brandMap[b.id] = name;
      brandCreatedTimes[name] = b.created_time?.split("T")[0];
    }
  });
  console.log("AI Brands:", Object.values(brandMap));
  console.log("Brand created times:", brandCreatedTimes);

  // AI Branch - by brand
  const DONE = ["Delivered", "Killed", "Archived"];
  const activeAI = aiDeliverables.filter(d => !DONE.includes(getSelect(d, "Status")));
  
  // Get ALL AI brands from the brands database
  const allBrands = aiBrands.map(b => getTitle(b)).filter(Boolean);
  
  // Add Sidekick manually since it's in deliverables but not in the brands DB
  if (!allBrands.some(b => b.toLowerCase().includes('sidekick'))) {
    allBrands.push('Sidekick');
  }
  
  console.log("All AI Brands:", allBrands);

  // AI Branch - by brand - track both active and completed
  const brandStats = {};
  const completedBrands = new Set();
  const brandStartDates = {};
  
  // Track when each brand was first started
  aiDeliverables.forEach(d => {
    const conceptName = getTitle(d);
    const created = d.created_time?.split("T")[0];
    const match = conceptName.match(/MTRX_([A-Z]+)_/);
    if (match) {
      const code = match[1];
      let brandName = "Unknown";
      if (code.startsWith("SK")) brandName = "Sidekick";
      else if (code.startsWith("VR")) brandName = "Verso";
      else if (code.startsWith("SE")) brandName = "Seora Skincare";
      else if (code.startsWith("CR")) brandName = "Crumb";
      else if (code.startsWith("SN")) brandName = "Seranova";
      else if (code.startsWith("TA")) brandName = "Try AI Ads";
      else if (code.startsWith("PFW")) brandName = "Peak Footwear";
      else if (code.startsWith("DT")) brandName = "Drem Team";
      else if (code.startsWith("MM")) brandName = "Mail Mend";
      else if (code.startsWith("EV")) brandName = "Evervision";
      else if (code.startsWith("LD")) brandName = "Ledisa";
      else if (code.startsWith("SM")) brandName = "Smootheskin";
      
      if (brandName !== "Unknown" && created) {
        if (!brandStartDates[brandName] || created < brandStartDates[brandName]) {
          brandStartDates[brandName] = created;
        }
      }
    }
  });
  
  // Get all delivered items to find completed brands
  const deliveredAI = aiDeliverables.filter(d => getSelect(d, "Status") === "Delivered");
  deliveredAI.forEach(d => {
    const conceptName = getTitle(d);
    const match = conceptName.match(/MTRX_([A-Z]+)_/);
    if (match) {
      const code = match[1];
      // Map codes properly - only recognized brands
      if (code.startsWith("SK") || code === "SK") completedBrands.add("Sidekick");
      else if (code.startsWith("VR") || code === "VR") completedBrands.add("Verso");
      else if (code.startsWith("SE") || code === "SE") completedBrands.add("Seora Skincare");
      else if (code.startsWith("CR") || code === "CR") completedBrands.add("Crumb");
      else if (code.startsWith("SN") || code === "SN") completedBrands.add("Seranova");
      else if (code.startsWith("TA") || code === "TA") completedBrands.add("Try AI Ads");
      else if (code.startsWith("PFW") || code === "PFW") completedBrands.add("Peak Footwear");
      else if (code.startsWith("DT") || code === "DT") completedBrands.add("Drem Team");
      else if (code.startsWith("MM") || code === "MM") completedBrands.add("Mail Mend");
      else if (code.startsWith("EV") || code === "EV") completedBrands.add("Evervision");
      else if (code.startsWith("LD") || code === "LD") completedBrands.add("Ledisa");
      else if (code.startsWith("SM") || code === "SM") completedBrands.add("Smootheskin");
    }
  });
  // Hardcode some completed brands that don't have deliverables with proper naming
  const manualCompleted = ["Ledisa", "Smootheskin"];
  manualCompleted.forEach(b => completedBrands.add(b));
  
  console.log("Completed brands:", [...completedBrands]);
  
  // Initialize all brands with 0
  allBrands.forEach(brand => {
    brandStats[brand.trim()] = { active: 0, overdue: 0, statuses: {} };
  });
  
  // Then count active deliverables
  activeAI.forEach(d => {
    const brandIds = getRelation(d, "Brand");
    const conceptName = getTitle(d);
    
    // Try to extract brand from concept name if no relation
    let brandName = "Unknown";
    if (brandIds.length > 0) {
      brandName = brandMap[brandIds[0]] || "Unknown";
    } else {
      // Extract from concept name like MTRX_SK_B1_...
      const match = conceptName.match(/MTRX_([A-Z]+)_/);
      if (match) {
        const code = match[1];
        // Map codes to brand names
        if (code.startsWith("SK")) brandName = "Sidekick";
        else if (code.startsWith("VR")) brandName = "Verso";
        else if (code.startsWith("SE")) brandName = "Seora";
        else if (code.startsWith("CR")) brandName = "Crumb";
        else if (code.startsWith("SN")) brandName = "Seranova";
        else if (code.startsWith("TA")) brandName = "Try AI Ads";
        else brandName = code;
      }
    }
    
    if (!brandStats[brandName]) {
      brandStats[brandName] = { active: 0, overdue: 0, statuses: {} };
    }
    
    brandStats[brandName].active++;
    
    const status = getSelect(d, "Status") || "Unknown";
    const due = getDate(d, "Due Date");
    
    // Store status with deadline
    if (!brandStats[brandName].statuses[status]) {
      brandStats[brandName].statuses[status] = [];
    }
    brandStats[brandName].statuses[status].push({ name: conceptName, due: due });
    
    if (due && due < today) {
      brandStats[brandName].overdue++;
    }
  });

  const aiBrandsList = Object.entries(brandStats).map(([name, data]) => ({
    name,
    active: data.active,
    overdue: data.overdue,
    statuses: data.statuses,
    startDate: brandStartDates[name] || brandCreatedTimes[name] || null
  }));

  const completedBrandsList = [...completedBrands].filter(b => 
    !aiBrandsList.some(brand => brand.name.toLowerCase() === b.toLowerCase() && brand.active > 0)
  ).sort();

  const totalAI = activeAI.length;
  const overdueAI = Object.values(brandStats).reduce((sum, b) => sum + b.overdue, 0);

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
      active: totalAI, 
      overdue: overdueAI, 
      brands: aiBrandsList,
      completed: completedBrandsList
    },
    forms,
    timestamp: new Date().toISOString(),
  };

  await fs.writeFile("public/dashboard-data.json", JSON.stringify(result, null, 2));
  console.log("✅ Saved to public/dashboard-data.json");
  console.log(`AI: ${totalAI} active, ${overdueAI} overdue`);
  aiBrandsList.forEach(b => console.log(`  ${b.name}: ${b.active} active, ${b.overdue} overdue`));
  return result;
}

fetchAllData().catch(console.error);
