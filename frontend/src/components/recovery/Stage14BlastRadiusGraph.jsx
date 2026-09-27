import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  GitBranch,
  ArrowRight,
  Plane,
  Car,
  Building2,
  Compass,
  Calendar,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';

/**
 * Stage14BlastRadiusGraph.jsx — Directed Dependency Graph & Blast Radius Visualizer
 *
 * Renders the normalized NetworkX backend dependency graph output:
 * - Nodes with impact classification (DIRECTLY_AFFECTED, DOWNSTREAM_AFFECTED, AT_RISK, PRESERVED, NOT_AFFECTED)
 * - Directed edge connections and transfer buffers
 * - Transparent explainability reasons and severity metrics
 */
export default function Stage14BlastRadiusGraph({ blastRadius, loading = false, onRefresh }) {
  const [filter, setFilter] = useState('all');
  const [expandedNodeId, setExpandedNodeId] = useState(null);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm flex items-center justify-center space-x-3 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin text-sky-600" />
        <span className="text-sm font-medium">Computing NetworkX Blast Radius Graph...</span>
      </div>
    );
  }

  if (!blastRadius || !blastRadius.nodes || blastRadius.nodes.length === 0) {
    return null;
  }

  const { nodes = [], edges = [], summary = {} } = blastRadius;

  const filteredNodes = nodes.filter((n) => {
    if (filter === 'affected') {
      return n.impact_type === 'direct' || n.impact_type === 'downstream' || n.impact_type === 'at_risk';
    }
    if (filter === 'preserved') {
      return n.impact_type === 'preserved' || n.impact_type === 'not_affected';
    }
    return true;
  });

  const getItemIcon = (type) => {
    const t = (type || '').toLowerCase();
    if (t === 'flight') return <Plane className="w-4 h-4 text-sky-600" />;
    if (t === 'transfer' || t === 'cab' || t === 'bus' || t === 'train') return <Car className="w-4 h-4 text-amber-600" />;
    if (t === 'hotel') return <Building2 className="w-4 h-4 text-purple-600" />;
    if (t === 'activity') return <Compass className="w-4 h-4 text-emerald-600" />;
    return <Calendar className="w-4 h-4 text-slate-500" />;
  };

  const getStatusBadge = (impactType, status) => {
    switch (impactType) {
      case 'direct':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            DIRECTLY AFFECTED
          </span>
        );
      case 'downstream':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            DOWNSTREAM AFFECTED
          </span>
        );
      case 'at_risk':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
            <AlertTriangle className="w-3 h-3 text-yellow-600" />
            AT RISK
          </span>
        );
      case 'preserved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            PRESERVED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <ShieldCheck className="w-3 h-3 text-slate-500" />
            NOT AFFECTED
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-50 text-sky-700">
              <GitBranch className="w-5 h-5 text-sky-600" />
            </span>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              NetworkX Dependency Graph & Blast Radius
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Engine evaluates directional dependencies, connection buffers, and feasibility to predict exact disruption reach.
          </p>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
            title="Recalculate NetworkX blast radius"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recalculate
          </button>
        )}
      </div>

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 my-5">
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center">
          <div className="text-xs font-medium text-rose-700">Direct Impact</div>
          <div className="text-2xl font-black text-rose-800 mt-0.5">{summary.direct ?? 0}</div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
          <div className="text-xs font-medium text-amber-700">Downstream Broken</div>
          <div className="text-2xl font-black text-amber-800 mt-0.5">{summary.downstream ?? 0}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-center">
          <div className="text-xs font-medium text-yellow-700">At Risk</div>
          <div className="text-2xl font-black text-yellow-800 mt-0.5">{summary.at_risk ?? 0}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <div className="text-xs font-medium text-emerald-700">Preserved</div>
          <div className="text-2xl font-black text-emerald-800 mt-0.5">{summary.preserved ?? 0}</div>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <div className="text-xs font-medium text-slate-600">Unaffected</div>
          <div className="text-2xl font-black text-slate-700 mt-0.5">{summary.not_affected ?? 0}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4 text-xs font-medium">
        <span className="text-slate-400">Filter nodes:</span>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-full transition ${
            filter === 'all'
              ? 'bg-slate-900 text-white font-semibold shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All ({nodes.length})
        </button>
        <button
          onClick={() => setFilter('affected')}
          className={`px-3 py-1 rounded-full transition ${
            filter === 'affected'
              ? 'bg-rose-700 text-white font-semibold shadow-xs'
              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
          }`}
        >
          Affected / At-Risk ({(summary.direct || 0) + (summary.downstream || 0) + (summary.at_risk || 0)})
        </button>
        <button
          onClick={() => setFilter('preserved')}
          className={`px-3 py-1 rounded-full transition ${
            filter === 'preserved'
              ? 'bg-emerald-700 text-white font-semibold shadow-xs'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
          }`}
        >
          Preserved & Unaffected ({(summary.preserved || 0) + (summary.not_affected || 0)})
        </button>
      </div>

      {/* Dependency Graph Nodes List */}
      <div className="space-y-3">
        {filteredNodes.map((node, idx) => {
          const isExpanded = expandedNodeId === node.item_id;
          const isDirect = node.impact_type === 'direct';
          const isDownstream = node.impact_type === 'downstream';
          const isAtRisk = node.impact_type === 'at_risk';
          const isPreserved = node.impact_type === 'preserved';

          let cardBorder = 'border-slate-200 hover:border-slate-300';
          let cardBg = 'bg-white';
          if (isDirect) {
            cardBorder = 'border-rose-300 ring-1 ring-rose-300';
            cardBg = 'bg-rose-50/40';
          } else if (isDownstream) {
            cardBorder = 'border-amber-300';
            cardBg = 'bg-amber-50/30';
          } else if (isAtRisk) {
            cardBorder = 'border-yellow-300';
            cardBg = 'bg-yellow-50/30';
          } else if (isPreserved) {
            cardBorder = 'border-emerald-200';
            cardBg = 'bg-emerald-50/20';
          }

          return (
            <div
              key={node.item_id || idx}
              className={`border rounded-xl p-4 transition ${cardBorder} ${cardBg}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs mt-0.5">
                    {getItemIcon(node.item_type)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">{node.title}</h4>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        {node.item_type}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 mt-1 font-medium">
                      {node.reason}
                    </div>

                    {node.location && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        📍 {typeof node.location === 'string' ? node.location : JSON.stringify(node.location)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {getStatusBadge(node.impact_type, node.status)}
                  {node.severity && node.severity !== 'none' && (
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Severity: <span className={isDirect || isDownstream ? 'text-rose-600' : isAtRisk ? 'text-amber-600' : 'text-slate-500'}>{node.severity}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Edge Connections Info if any */}
              {edges.some((e) => e.from === node.item_id || e.to === node.item_id) && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="font-semibold text-slate-400">Dependency links:</span>
                  {edges
                    .filter((e) => e.from === node.item_id)
                    .map((e, eIdx) => (
                      <span key={eIdx} className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                        <span>Propagates to</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="font-medium">{e.to}</span>
                        <span className="text-[10px] text-slate-400">({e.relationship})</span>
                      </span>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
