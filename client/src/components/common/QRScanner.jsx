import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const SCANNER_ID = 'html5-qrcode-reader';

export default function QRScanner({ isOpen, onClose, onScan }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');

    const scanner = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        scanner.stop().catch(() => {});
        onScan(decodedText);
        onClose();
      },
      () => {}
    ).catch(() => {
      setError('Camera access denied or not available. Please allow camera permission and try again.');
    });

    return () => {
      if (scanner.isScanning) scanner.stop().catch(() => {});
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleClose = () => {
    if (scannerRef.current?.isScanning) scannerRef.current.stop().catch(() => {});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Scan QR Code</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-4">
          <div id={SCANNER_ID} className="w-full rounded-lg overflow-hidden" />
          {error
            ? <p className="text-red-500 text-sm mt-3 text-center">{error}</p>
            : <p className="text-center text-xs text-gray-400 mt-3">
                Point camera at a bin, item, GRN, or dispatch order QR code
              </p>
          }
          <button onClick={handleClose}
            className="mt-4 w-full border py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
