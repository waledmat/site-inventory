import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import QRCode from 'qrcode';

const QRCodeDisplay = forwardRef(function QRCodeDisplay({ value, size = 160 }, ref) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 1 }, () => {});
  }, [value, size]);

  useImperativeHandle(ref, () => ({
    getDataURL: () => canvasRef.current?.toDataURL('image/png'),
  }));

  return <canvas ref={canvasRef} />;
});

export default QRCodeDisplay;
