import { Client } from "@notionhq/client";
import { NextResponse } from "next/server";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const DB = {
  deliverables: "23fc239d-6afc-80e2-9636-d30852777d90",
  team: "305c239d-6afc-80a4-87d6-eb84e123a3dd",
  aiDeliverables: "291c239d-6afc-80ed-aaab-eae0a318a1f8",
  aiBrands: "291c239d-6afc-8072-8e43-f87787ac6831",
  checkIn: "305c239d-6afc-8008-b0b2-dd5211d75e91",
  podLeader: "306c239d-6afc-80df-9257-f749d6bfd56d",
  pm: "306c239d-6afc-80db-a1cc-c4c9a599a1d0",
  headEditing: "307c239d-6afc-804e-b711-f711c797fedd",
  headCS: "307c239d-6afc-80b3-b643-d93fb4a8da21",
  opsTracker: "30ac239d-6afc-81f4-bd84-ce91fb66c464",
};

const DONE_STATUSES = ["Delivered", "Killed", "Archived"];
const EXEMPT = ["Hamza Shah", "Aaron Bains", "Aneesha", "Cam"];

async function queryAll(dbId, filter) {
  let results = [];
  let cursor;
  do {
    const r = await notion.databases.query({
      database_id: dbId,
      filter,
      start_cursor: cursor,
      page_size: 100,
    });
    results.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return results;
}

function getTitle(page) {
  for (const v of Object.values(page.properties)) {
    if (v.type === "title" && v.title?.length) return v.title.map(t => t.plain_text).join("");
  }
  return "";
}

function getRichText(page, name) {
  const p = page.properties[name];
  if (!p) return "";
  if (p.type === "rich_text") return p.rich_text?.map(t => t.plain_text).join("") || "";
  if (p.type === "title") return p.title?.map(t => t.plain_text).join("") || "";
  return "";
}

function getSelect(page, name) {
  const p = page.properties[name];
  if (!p) return null;
  if (p.type === "select") return p.select?.name || null;
  if (p.type === "status") return p.status?.name || null;
  return null;
}

function getMultiSelect(page, name) {
  const p = page.properties[name];
  if (p?.type === "multi_select") return p.multi_select?.map(o => o.name) || [];
  return [];
}

function getDate(page, name) {
  const p = page.properties[name];
  if (p?.type === "date") return p.date?.start || null;
  return null;
}

function getPeople(page, name) {
  const p = page.properties[name];
  if (p?.type === "people") return p.people?.map(u => u.name || u.id) || [];
  return [];
}

function getRollup(page, name) {
  const p = page.properties[name];
  if (p?.type === "rollup") {
    if (p.rollup?.type === "array") return p.rollup.array;
    return p.rollup;
  }
  return null;
}

export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

    // Fetch all data in parallel
    const [deliverables, aiDeliverables, team, checkIns, podLeaderForms, pmForms, headEditingForms, headCSForms, opsTasks, aiBrands] = await Promise.all([
      queryAll(DB.deliverables),
      queryAll(DB.aiDeliverables),
      queryAll(DB.team),
      queryAll(DB.checkIn),
      queryAll(DB.podLeader),
      queryAll(DB.pm),
      queryAll(DB.headEditing),
      queryAll(DB.headCS),
      queryAll(DB.opsTracker),
      queryAll(DB.aiBrands),
    ]);

    // --- Team Directory ---
    const teamMembers = team.map(p => ({
      name: getTitle(p) || getRichText(p, "Full Name"),
      fullName: getRichText(p, "Full Name") || getTitle(p),
      role: getSelect(p, "Role"),
      pods: getMultiSelect(p, "Pod"),
      podLead: p.properties["Pod Lead"]?.checkbox || false,
    }));

    // --- Deliverables ---
    const activeDeliverables = deliverables.filter(d => {
      const status = getSelect(d, "Status");
      return status && !DONE_STATUSES.includes(status);
    });

    const overdueDeliverables = deliverables.filter(d => {
      const status = getSelect(d, "Status");
      if (!status || DONE_STATUSES.includes(status)) return false;
      // Check multiple date fields for overdue
      const dates = ["Edit Due Date", "Script Due Date", "Content Due Date"].map(n => getDate(d, n)).filter(Boolean);
      return dates.some(dt => dt < today);
    });

    // Active editors (people assigned to active deliverables)
    const editorSet = new Set();
    activeDeliverables.forEach(d => {
      getPeople(d, "Editor").forEach(e => editorSet.add(e));
    });

    // --- Pod Health ---
    // Pod is a relation in deliverables, so we need to use Pod (Inherited) rollup
    const podMap = { "North Coast": [], "East Coast": [], "West Coast": [], "South Coast": [] };

    activeDeliverables.forEach(d => {
      const podRollup = getRollup(d, "Pod (Inherited)");
      let podNames = [];
      if (podRollup && Array.isArray(podRollup)) {
        podRollup.forEach(item => {
          if (item.type === "array") {
            item.array?.forEach(a => {
              if (a.type === "rich_text") podNames.push(...a.rich_text.map(t => t.plain_text));
              if (a.type === "select") podNames.push(a.select?.name);
            });
          } else if (item.type === "rich_text") {
            podNames.push(...item.rich_text.map(t => t.plain_text));
          } else if (item.type === "select") {
            podNames.push(item.select?.name);
          }
        });
      }
      podNames.forEach(pn => {
        if (podMap[pn] !== undefined) podMap[pn].push(d);
      });
    });

    const podHealth = Object.entries(podMap).map(([name, items]) => {
      const overdue = items.filter(d => {
        const dates = ["Edit Due Date", "Script Due Date", "Content Due Date"].map(n => getDate(d, n)).filter(Boolean);
        return dates.some(dt => dt < today);
      });
      const editors = new Set();
      items.forEach(d => getPeople(d, "Editor").forEach(e => editors.add(e)));
      return {
        name,
        active: items.length,
        overdue: overdue.length,
        editors: [...editors],
        health: overdue.length === 0 ? "green" : overdue.length <= 3 ? "yellow" : "red",
      };
    });

    // --- Delayed People ---
    const personOverdue = {};
    overdueDeliverables.forEach(d => {
      const people = [...getPeople(d, "Editor"), ...getPeople(d, "Strategist")];
      people.forEach(name => {
        if (!personOverdue[name]) {
          const member = teamMembers.find(m => m.name === name || m.fullName === name);
          personOverdue[name] = {
            name,
            role: member?.role || "Unknown",
            pod: member?.pods?.[0] || "Unknown",
            count: 0,
          };
        }
        personOverdue[name].count++;
      });
    });
    const delayedPeople = Object.values(personOverdue).sort((a, b) => b.count - a.count);

    // --- AI Branch ---
    const activeAI = aiDeliverables.filter(d => {
      const status = getSelect(d, "Status");
      return status && !DONE_STATUSES.includes(status);
    });
    const overdueAI = aiDeliverables.filter(d => {
      const status = getSelect(d, "Status");
      if (!status || DONE_STATUSES.includes(status)) return false;
      const due = getDate(d, "Due Date");
      return due && due < today;
    });
    const aiStatusMap = {};
    activeAI.forEach(d => {
      const s = getSelect(d, "Status") || "Unknown";
      aiStatusMap[s] = (aiStatusMap[s] || 0) + 1;
    });
    const aiBrandNames = aiBrands.map(b => getTitle(b));

    // --- Forms Breakdown ---
    const formDbs = [
      { name: "Check In Tracker", data: checkIns, dateField: "Week", nameField: "Team Member", nameType: "rich_text" },
      { name: "Pod Leader", data: podLeaderForms, dateField: "Week", nameField: null, nameType: "title" },
      { name: "PM", data: pmForms, dateField: "Week", nameField: null, nameType: "title" },
      { name: "Head of Editing", data: headEditingForms, dateField: "Week", nameField: null, nameType: "title" },
      { name: "Head of CS", data: headCSForms, dateField: "Week", nameField: null, nameType: "title" },
    ];

    const formsBreakdown = formDbs.map(({ name, data, dateField, nameField, nameType }) => {
      const recent = data.filter(d => {
        const dt = getDate(d, dateField);
        return dt && dt >= weekAgo;
      });
      const submitters = recent.map(d => {
        if (nameField && nameType === "rich_text") return getRichText(d, nameField);
        return getTitle(d);
      }).filter(Boolean);
      return { name, total: recent.length, submitters: [...new Set(submitters)] };
    });

    // Expected submitters per form (from team directory, minus exempt)
    const nonExemptTeam = teamMembers.filter(m => !EXEMPT.some(e => m.name?.includes(e) || m.fullName?.includes(e)));

    // --- Form Compliance ---
    const totalExpected = formsBreakdown.reduce((sum, f) => {
      if (f.name === "Check In Tracker") return sum + nonExemptTeam.filter(m => m.role === "Editor" || m.role === "Creative Strategist").length;
      return sum + 1; // leadership forms expect 1 submission
    }, 0);
    const totalSubmitted = formsBreakdown.reduce((sum, f) => sum + f.total, 0);
    const formCompliance = totalExpected > 0 ? Math.round((totalSubmitted / totalExpected) * 100) : 0;

    // --- Ops Tracker ---
    const opsTaskList = opsTasks.map(t => ({
      task: getTitle(t),
      status: getSelect(t, "Status"),
      date: getDate(t, "Date"),
      pod: getSelect(t, "Pod"),
      brand: getSelect(t, "Brand"),
      hours: t.properties["Hours Spent"]?.number || 0,
      completed: getRichText(t, "What I Completed") || getTitle(t),
      pending: getRichText(t, "What's Pending & Why"),
    })).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    return NextResponse.json({
      overview: {
        activeDeliverables: activeDeliverables.length,
        overdue: overdueDeliverables.length,
        formCompliance,
        activeEditors: editorSet.size,
      },
      podHealth,
      delayedPeople: delayedPeople.slice(0, 20),
      ai: {
        active: activeAI.length,
        overdue: overdueAI.length,
        statuses: aiStatusMap,
        brands: aiBrandNames,
      },
      forms: formsBreakdown,
      opsTracker: opsTaskList.slice(0, 30),
      teamMembers: nonExemptTeam.map(m => ({ name: m.name || m.fullName, role: m.role, pods: m.pods })),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
