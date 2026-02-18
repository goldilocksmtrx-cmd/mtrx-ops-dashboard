"use client";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expandedForm, setExpandedForm] = useState(null);

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

  const toggleForm = (formName) => {
    setExpandedForm(expandedForm === formName ? null : formName);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚙️</div>
          <div className="text-xl">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              MTRX AI & Forms
            </h1>
            {lastUpdated && (
              <p className="text-gray-400 text-sm mt-1">
                Last updated: {lastUpdated.toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition disabled:opacity-50"
          >
            {loading ? "Loading..." : "🔄 Refresh"}
          </button>
        </div>

        {/* AI Branch */}
        <h2 className="text-xl font-bold mb-4">🤖 AI Branch</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#1a1a2e] p-4 rounded-xl border border-purple-500/30">
            <div className="text-gray-400 text-sm">Active</div>
            <div className="text-3xl font-bold text-purple-400">{data?.ai?.active || 0}</div>
          </div>
          <div className="bg-[#1a1a2e] p-4 rounded-xl border border-red-500/30">
            <div className="text-gray-400 text-sm">Overdue</div>
            <div className="text-3xl font-bold text-red-400">{data?.ai?.overdue || 0}</div>
          </div>
          <div className="bg-[#1a1a2e] p-4 rounded-xl border border-yellow-500/30 col-span-2">
            <div className="text-gray-400 text-sm mb-2">By Status</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data?.ai?.statuses || {}).map(([status, count]) => (
                <span key={status} className="px-2 py-1 bg-gray-700 rounded text-sm">
                  {status}: <span className="text-purple-400 font-bold">{count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Forms Breakdown */}
        <h2 className="text-xl font-bold mb-4">📋 Forms (Last 7 Days)</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          {data?.forms?.map((form) => (
            <div 
              key={form.name} 
              onClick={() => toggleForm(form.name)}
              className={`bg-[#1a1a2e] p-4 rounded-xl border cursor-pointer transition hover:bg-[#252540] ${
                expandedForm === form.name ? "border-green-400" : "border-green-500/30"
              }`}
            >
              <div className="font-bold mb-2">{form.name}</div>
              <div className="text-4xl font-bold text-green-400">{form.total}</div>
              <div className="text-gray-400 text-sm">submissions</div>
              {form.submitters?.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  {form.submitters.slice(0, 3).join(", ")}
                  {form.submitters.length > 3 && ` +${form.submitters.length - 3}`}
                </div>
              )}
              <div className="mt-2 text-xs text-purple-400">
                {expandedForm === form.name ? "▼ Click to close" : "▶ Click for details"}
              </div>
            </div>
          ))}
        </div>

        {/* Expanded Form Details */}
        {expandedForm && (
          <div className="bg-[#1a1a2e] rounded-xl border border-green-400 p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-green-400">{expandedForm}</h3>
              <button 
                onClick={() => setExpandedForm(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            {data?.forms?.filter(f => f.name === expandedForm).map((form) => (
              <div key={form.name}>
                <div className="mb-4">
                  <span className="text-gray-400">Total submissions: </span>
                  <span className="text-green-400 font-bold text-xl">{form.total}</span>
                </div>
                
                {form.submitters?.length > 0 ? (
                  <div>
                    <h4 className="text-sm text-gray-400 mb-2">Who submitted:</h4>
                    <div className="flex flex-wrap gap-2">
                      {form.submitters.map((submitter, i) => (
                        <span 
                          key={i} 
                          className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm"
                        >
                          {submitter}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">No submissions this week</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
