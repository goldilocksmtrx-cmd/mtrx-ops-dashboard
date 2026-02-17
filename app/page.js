"use client";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getHealthColor = (health) => {
    if (health === "green") return "bg-green-500/20 border-green-500 text-green-400";
    if (health === "yellow") return "bg-yellow-500/20 border-yellow-500 text-yellow-400";
    return "bg-red-500/20 border-red-500 text-red-400";
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚙️</div>
          <div className="text-xl">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              MTRX Ops Dashboard
            </h1>
            {lastUpdated && (
              <p className="text-gray-400 text-sm mt-1">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "🔄 Refresh"}
          </button>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#1a1a2e] p-4 rounded-xl border border-gray-700">
            <div className="text-gray-400 text-sm">Active Deliverables</div>
            <div className="text-3xl font-bold text-blue-400">{data?.overview?.activeDeliverables || 0}</div>
          </div>
          <div className="bg-[#1a1a2e] p-4 rounded-xl border border-gray-700">
            <div className="text-gray-400 text-sm">Overdue</div>
            <div className="text-3xl font-bold text-red-400">{data?.overview?.overdue || 0}</div>
          </div>
          <div className="bg-[#1a1a2e] p-4 rounded-xl border border-gray-700">
            <div className="text-gray-400 text-sm">Form Compliance</div>
            <div className="text-3xl font-bold text-green-400">{data?.overview?.formCompliance || 0}%</div>
          </div>
          <div className="bg-[#1a1a2e] p-4 rounded-xl border border-gray-700">
            <div className="text-gray-400 text-sm">Active Editors</div>
            <div className="text-3xl font-bold text-purple-400">{data?.overview?.activeEditors || 0}</div>
          </div>
        </div>

        {/* Pod Health */}
        <h2 className="text-xl font-bold mb-4">Pod Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {data?.podHealth?.map((pod) => (
            <div key={pod.name} className={`p-4 rounded-xl border ${getHealthColor(pod.health)}`}>
              <div className="font-bold text-lg mb-2">{pod.name}</div>
              <div className="space-y-1 text-sm">
                <div>Active: {pod.active}</div>
                <div>Overdue: {pod.overdue}</div>
                <div>Editors: {pod.editors.length}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Delayed People */}
        <h2 className="text-xl font-bold mb-4">Delayed People</h2>
        <div className="bg-[#1a1a2e] rounded-xl border border-gray-700 overflow-hidden mb-8">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Role</th>
                <th className="text-left p-3">Pod</th>
                <th className="text-right p-3">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {data?.delayedPeople?.length > 0 ? (
                data.delayedPeople.map((person, i) => (
                  <tr key={i} className="border-t border-gray-700">
                    <td className="p-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      {person.name}
                    </td>
                    <td className="p-3 text-gray-400">{person.role}</td>
                    <td className="p-3 text-gray-400">{person.pod}</td>
                    <td className="p-3 text-right font-bold text-red-400">{person.count}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-400">No overdue items</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* AI Branch */}
        <h2 className="text-xl font-bold mb-4">AI Branch</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#1a1a2e] p-4 rounded-xl border border-gray-700">
            <div className="text-gray-400 text-sm">Active</div>
            <div className="text-2xl font-bold text-blue-400">{data?.ai?.active || 0}</div>
          </div>
          <div className="bg-[#1a1a2e] p-4 rounded-xl border border-gray-700">
            <div className="text-gray-400 text-sm">Overdue</div>
            <div className="text-2xl font-bold text-red-400">{data?.ai?.overdue || 0}</div>
          </div>
          <div className="bg-[#1a1a2e] p-4 rounded-xl border border-gray-700 col-span-2">
            <div className="text-gray-400 text-sm mb-2">Brands</div>
            <div className="flex flex-wrap gap-2">
              {data?.ai?.brands?.map((brand) => (
                <span key={brand} className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-sm">{brand}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Forms Breakdown */}
        <h2 className="text-xl font-bold mb-4">Forms Breakdown (Last 7 Days)</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          {data?.forms?.map((form) => (
            <div key={form.name} className="bg-[#1a1a2e] p-4 rounded-xl border border-gray-700">
              <div className="font-bold mb-2">{form.name}</div>
              <div className="text-3xl font-bold text-green-400">{form.total}</div>
              <div className="text-gray-400 text-sm">submissions</div>
            </div>
          ))}
        </div>

        {/* Ops Tracker */}
        <h2 className="text-xl font-bold mb-4">Ops Tasks (Lois)</h2>
        <div className="bg-[#1a1a2e] rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="text-left p-3">Task</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Hours</th>
              </tr>
            </thead>
            <tbody>
              {data?.opsTracker?.slice(0, 10).map((task, i) => (
                <tr key={i} className="border-t border-gray-700">
                  <td className="p-3">{task.task || task.completed?.slice(0, 50)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      task.status === "Done" ? "bg-green-500/20 text-green-400" : 
                      task.status === "In Progress" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-400">{task.date}</td>
                  <td className="p-3">{task.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
