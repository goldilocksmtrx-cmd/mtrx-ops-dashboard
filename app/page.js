"use client";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expandedForm, setExpandedForm] = useState(null);
  const [expandedBrand, setExpandedBrand] = useState(null);

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

  const toggleBrand = (brandName) => {
    setExpandedBrand(expandedBrand === brandName ? null : brandName);
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

  const activeBrands = data?.ai?.brands?.filter(b => b.active > 0) || [];
  const inactiveBrands = data?.ai?.brands?.filter(b => b.active === 0).map(b => b.name).sort() || [];
  const completedBrands = data?.ai?.completed || [];

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

        {/* AI Branch - Active Brands */}
        <h2 className="text-xl font-bold mb-4">🤖 AI Branch</h2>
        
        {activeBrands.length > 0 && (
          <>
            <h3 className="text-sm text-gray-400 mb-3">Active Brands</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
              {activeBrands.map((brand) => (
                <div 
                  key={brand.name}
                  onClick={() => toggleBrand(brand.name)}
                  className={`bg-[#1a1a2e] p-4 rounded-xl border cursor-pointer transition hover:bg-[#252540] ${
                    expandedBrand === brand.name ? "border-purple-400" : "border-purple-500/30"
                  }`}
                >
                  <div className="font-bold mb-2 text-sm">{brand.name}</div>
                  <div className="text-3xl font-bold text-purple-400">{brand.active}</div>
                  <div className="text-gray-400 text-sm">active</div>
                  {brand.overdue > 0 && (
                    <div className="mt-2 text-xs text-red-400">⚠️ {brand.overdue} overdue</div>
                  )}
                  <div className="mt-2 text-xs text-purple-300">
                    {expandedBrand === brand.name ? "▼ Close" : "▶ Details"}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Inactive Brands - All in One Square */}
        {inactiveBrands.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm text-gray-400 mb-3">Not Started</h3>
            <div className="bg-[#1a1a2e] p-4 rounded-xl border border-gray-700">
              <div className="flex flex-wrap gap-2">
                {inactiveBrands.map((brand) => (
                  <span 
                    key={brand} 
                    className="px-3 py-1 bg-gray-700 text-gray-400 rounded-full text-sm"
                  >
                    {brand}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Completed Brands */}
        {completedBrands.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm text-gray-400 mb-3">Done</h3>
            <div className="bg-[#1a1a2e] p-4 rounded-xl border border-green-500/30">
              <div className="flex flex-wrap gap-2">
                {completedBrands.map((brand) => (
                  <span 
                    key={brand} 
                    className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm"
                  >
                    {brand}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Expanded Brand Details */}
        {expandedBrand && (
          <div className="bg-[#1a1a2e] rounded-xl border border-purple-400 p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-purple-400">{expandedBrand}</h3>
              <button 
                onClick={() => setExpandedBrand(null)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            {data?.ai?.brands?.filter(b => b.name === expandedBrand).map((brand) => (
              <div key={brand.name}>
                <div className="mb-4">
                  <span className="text-gray-400">Active: </span>
                  <span className="text-purple-400 font-bold text-xl">{brand.active}</span>
                  {brand.overdue > 0 && (
                    <span className="ml-4 text-red-400">• {brand.overdue} overdue</span>
                  )}
                </div>
                <div>
                  <h4 className="text-sm text-gray-400 mb-2">By Status:</h4>
                  <div className="space-y-3">
                    {Object.entries(brand.statuses || {}).map(([status, items]) => (
                      <div key={status} className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                        <div className="font-medium text-purple-300 mb-2">{status} ({items.length})</div>
                        <div className="space-y-1">
                          {items.map((item, i) => (
                            <div key={i} className="text-sm text-gray-300 flex justify-between">
                              <span className="truncate max-w-xs">{item.name}</span>
                              <span className={item.due ? (new Date(item.due) < new Date() ? "text-red-400" : "text-gray-400") : "text-gray-500"}>
                                {item.due || "No deadline"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

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
              <div className="font-bold mb-2 text-sm">{form.name}</div>
              <div className="text-4xl font-bold text-green-400">{form.total}</div>
              <div className="text-gray-400 text-sm">submissions</div>
              {form.wins?.length > 0 && (
                <div className="mt-2 text-xs text-green-300">✓ {form.wins.length} wins</div>
              )}
              {form.issues?.length > 0 && (
                <div className="mt-1 text-xs text-red-300">⚠ {form.issues.length} issues</div>
              )}
            </div>
          ))}
        </div>

        {/* Expanded Form Details */}
        {expandedForm && (
          <div className="bg-[#1a1a2e] rounded-xl border border-green-400 p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-green-400">{expandedForm}</h3>
              <button 
                onClick={() => setExpandedForm(null)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            
            {data?.forms?.filter(f => f.name === expandedForm).map((form) => (
              <div key={form.name}>
                {form.wins?.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-green-400 font-bold mb-3 flex items-center gap-2">
                      ✓ What's Going Well
                    </h4>
                    <div className="space-y-2">
                      {form.wins.map((win, i) => (
                        <div key={i} className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                          <div className="text-green-300 text-sm">{win.text}</div>
                          <div className="text-gray-500 text-xs mt-1">— {win.source}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {form.issues?.length > 0 && (
                  <div>
                    <h4 className="text-red-400 font-bold mb-3 flex items-center gap-2">
                      ⚠️ What's Going Wrong
                    </h4>
                    <div className="space-y-2">
                      {form.issues.map((issue, i) => (
                        <div key={i} className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                          <div className="text-red-300 text-sm">{issue.text}</div>
                          <div className="text-gray-500 text-xs mt-1">— {issue.source}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {form.wins?.length === 0 && form.issues?.length === 0 && (
                  <p className="text-gray-500">No detailed submissions this week</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
