import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Modal from './Modal';

/**
 * TransactionHistoryModal
 * Opens when the user clicks any REQ / DN / RET reference badge.
 * Fetches GET /api/transactions/:ref and displays the full chain.
 *
 * Props:
 *   refNumber  string | null  — the ref number clicked (e.g. "REQ-2026-0001")
 *   onClose    () => void
 */
export default function TransactionHistoryModal({ refNumber, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Allow navigating to linked refs without closing the modal
  const [currentRef, setCurrentRef] = useState(refNumber);

  useEffect(() => {
    setCurrentRef(refNumber);
  }, [refNumber]);

  useEffect(() => {
    if (!currentRef) return;
    setLoading(true);
    setData(null);
    setError('');
    api.get(`/transactions/${encodeURIComponent(currentRef)}`)
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [currentRef]);

  const navigate = ref => setCurrentRef(ref);

  const RefBadge = ({ value, color = 'blue' }) => {
    if (!value) return null;
    const colors = {
      blue:   'bg-blue-100 text-blue-700 hover:bg-blue-200',
      green:  'bg-green-100 text-green-700 hover:bg-green-200',
      orange: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
    };
    return (
      <button onClick={() => navigate(value)}
        className={`inline-block font-mono text-xs px-2 py-0.5 rounded cursor-pointer ${colors[color]}`}>
        {value}
      </button>
    );
  };

  const fmt = d => d ? String(d).slice(0, 10) : '—';

  return (
    <Modal isOpen={!!refNumber} onClose={onClose} title={`Transaction History — ${currentRef}`} wide>
      {loading && <p className="text-sm text-gray-500 py-4 text-center">Loading…</p>}
      {error  && <p className="text-sm text-red-500 py-4 text-center">{error}</p>}
      {!loading && !error && data && (
        <div className="space-y-4 text-sm">
          {/* ── REQ ── */}
          {data.type === 'REQ' && <ReqView data={data} RefBadge={RefBadge} fmt={fmt} navigate={navigate} />}
          {/* ── DN ── */}
          {data.type === 'DN'  && <DnView  data={data} RefBadge={RefBadge} fmt={fmt} navigate={navigate} />}
          {/* ── RET ── */}
          {data.type === 'RET' && <RetView data={data} RefBadge={RefBadge} fmt={fmt} navigate={navigate} />}
        </div>
      )}
      {!loading && !error && !data && currentRef && (
        <p className="text-sm text-gray-500 py-4 text-center">No record found for {currentRef}</p>
      )}
    </Modal>
  );
}

// ─── REQ view ────────────────────────────────────────────────────────────────

function ReqView({ data, RefBadge, fmt, navigate }) {
  const { request, issues } = data;
  return (
    <div className="space-y-4">
      <Section title="Request" color="blue">
        <Row label="Ref"       value={<RefBadge value={request.request_number} color="blue" />} />
        <Row label="Project"   value={request.project_name} />
        <Row label="Requester" value={`${request.requester_name}${request.requester_position ? ` · ${request.requester_position}` : ''}`} />
        <Row label="Status"    value={<StatusBadge status={request.status} />} />
        <Row label="Created"   value={fmt(request.created_at)} />
        {request.notes && <Row label="Notes" value={request.notes} />}
      </Section>

      {request.items?.length > 0 && (
        <Section title="Requested Items" color="blue">
          <ItemTable items={request.items} qtyKey="quantity_requested" qtyLabel="Qty Requested" />
        </Section>
      )}

      {issues.length === 0 && (
        <p className="text-gray-400 text-xs italic">Not yet issued.</p>
      )}

      {issues.map((iss, i) => (
        <Section key={i} title={`Issued →`} color="green"
          header={<RefBadge value={iss.delivery_note_id} color="green" />}>
          <Row label="DN"         value={<RefBadge value={iss.delivery_note_id} color="green" />} />
          <Row label="Date"       value={fmt(iss.issue_date)} />
          <Row label="Storekeeper" value={iss.storekeeper_name} />
          {iss.receiver_name && <Row label="Receiver" value={iss.receiver_name} />}
          {iss.items?.length > 0 && <ItemTable items={iss.items} qtyKey="quantity_issued" qtyLabel="Qty Issued" />}
          <ReturnsList returns={iss.returns} />
        </Section>
      ))}
    </div>
  );
}

// ─── DN view ─────────────────────────────────────────────────────────────────

function DnView({ data, RefBadge, fmt, navigate }) {
  const { issue, request, returns } = data;
  return (
    <div className="space-y-4">
      {request && (
        <Section title="From Request" color="blue">
          <Row label="Ref"       value={<RefBadge value={request.request_number} color="blue" />} />
          <Row label="Requester" value={request.requester_name} />
          <Row label="Status"    value={<StatusBadge status={request.status} />} />
          <Row label="Date"      value={fmt(request.created_at)} />
        </Section>
      )}

      <Section title="Delivery Note" color="green">
        <Row label="DN"          value={<RefBadge value={issue.delivery_note_id} color="green" />} />
        <Row label="Project"     value={issue.project_name} />
        <Row label="Date"        value={fmt(issue.issue_date)} />
        <Row label="Storekeeper" value={issue.storekeeper_name} />
        {issue.receiver_name && <Row label="Receiver" value={`${issue.receiver_name}${issue.receiver_position ? ` · ${issue.receiver_position}` : ''}`} />}
      </Section>

      {issue.items?.length > 0 && (
        <Section title="Issued Items" color="green">
          <ItemTable items={issue.items} qtyKey="quantity_issued" qtyLabel="Qty Issued" showBatch />
        </Section>
      )}

      <ReturnsList returns={returns} />
    </div>
  );
}

// ─── RET view ────────────────────────────────────────────────────────────────

function RetView({ data, RefBadge, fmt, navigate }) {
  const { return: ret, linked_dn, linked_req } = data;
  return (
    <div className="space-y-4">
      <Section title="Return" color="orange">
        <Row label="Ref"         value={<RefBadge value={ret.return_number} color="orange" />} />
        <Row label="Project"     value={ret.project_name} />
        <Row label="Logged By"   value={ret.logged_by_name} />
        <Row label="Date"        value={fmt(ret.return_date)} />
        <Row label="Item"        value={`${ret.item_number ? ret.item_number + ' · ' : ''}${ret.description_1}`} />
        <Row label="Qty"         value={ret.quantity_returned} />
        <Row label="UOM"         value={ret.uom} />
        <Row label="Condition"   value={<ConditionBadge c={ret.condition} />} />
        {ret.notes && <Row label="Notes" value={ret.notes} />}
      </Section>

      <Section title="Linked Transactions" color="blue">
        {linked_dn  && <Row label="Delivery Note" value={<RefBadge value={linked_dn}  color="green" />} />}
        {linked_req && <Row label="Request"       value={<RefBadge value={linked_req} color="blue" />} />}
      </Section>
    </div>
  );
}

// ─── shared sub-components ───────────────────────────────────────────────────

function Section({ title, color, header, children }) {
  const border = { blue: 'border-blue-200', green: 'border-green-200', orange: 'border-orange-200' };
  const bg     = { blue: 'bg-blue-50',      green: 'bg-green-50',      orange: 'bg-orange-50' };
  const text   = { blue: 'text-blue-800',   green: 'text-green-800',   orange: 'text-orange-800' };
  return (
    <div className={`border rounded-lg overflow-hidden ${border[color]}`}>
      <div className={`px-3 py-2 flex items-center justify-between ${bg[color]}`}>
        <span className={`text-xs font-semibold uppercase tracking-wide ${text[color]}`}>{title}</span>
        {header}
      </div>
      <div className="px-3 py-2 space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-500 min-w-24 shrink-0">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}

function ItemTable({ items, qtyKey, qtyLabel, showBatch }) {
  return (
    <div className="mt-1 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="pb-1 text-left font-medium">Item No.</th>
            <th className="pb-1 text-left font-medium">Description</th>
            <th className="pb-1 text-right font-medium">{qtyLabel}</th>
            <th className="pb-1 text-left font-medium pl-2">UOM</th>
            {showBatch && <th className="pb-1 text-left font-medium pl-2">Batch</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-1 pr-2">{it.item_number || '—'}</td>
              <td className="py-1 pr-2">{it.description_1}{it.description_2 ? ` / ${it.description_2}` : ''}</td>
              <td className="py-1 text-right">{it[qtyKey]}</td>
              <td className="py-1 pl-2">{it.uom}</td>
              {showBatch && <td className="py-1 pl-2">{it.batch_number || '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReturnsList({ returns }) {
  if (!returns?.length) return null;
  return (
    <div className="mt-1">
      <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">Returns</p>
      <div className="space-y-1">
        {returns.map((r, i) => (
          <div key={i} className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs bg-orange-50 px-2 py-1 rounded">
            <span className="font-mono text-orange-700">{r.return_number || '—'}</span>
            <span className="text-gray-600">{String(r.return_date).slice(0, 10)}</span>
            <span>{r.item_number ? `${r.item_number} · ` : ''}{r.description_1}</span>
            <span className="font-medium">{r.quantity_returned} {r.uom}</span>
            <ConditionBadge c={r.condition} />
            <span className="text-gray-500">{r.logged_by_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending:   'bg-yellow-100 text-yellow-700',
    issued:    'bg-green-100 text-green-700',
    rejected:  'bg-red-100 text-red-700',
    escalated: 'bg-purple-100 text-purple-700',
  };
  return <span className={`inline-block text-xs px-2 py-0.5 rounded capitalize ${map[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
}

function ConditionBadge({ c }) {
  const map = {
    good:    'bg-green-100 text-green-700',
    damaged: 'bg-yellow-100 text-yellow-700',
    lost:    'bg-red-100 text-red-700',
  };
  return <span className={`inline-block text-xs px-2 py-0.5 rounded capitalize ${map[c] || 'bg-gray-100 text-gray-600'}`}>{c}</span>;
}
