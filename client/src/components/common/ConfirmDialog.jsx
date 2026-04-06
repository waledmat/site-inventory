export default function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-5">
          <h3 className="text-base font-semibold text-gray-800 mb-2">{title}</h3>
          {message && <p className="text-sm text-gray-600">{message}</p>}
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button
            onClick={onConfirm}
            className={`flex-1 py-2 rounded-lg text-sm font-medium text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {confirmLabel}
          </button>
          <button onClick={onCancel} className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}
