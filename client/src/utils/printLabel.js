const SIZE_CONFIG = {
  a6:   { page: 'A6 landscape', width: 148, height: 105, qr: 150, layout: 'row' },
  '4x6': { page: '4in 6in',     width: 152, height: 102, qr: 140, layout: 'row' },
  '62mm': { page: '62mm 62mm',  width: 62,  height: 62,  qr: 80,  layout: 'col' },
};

function openPrintWindow(html) {
  const w = window.open('', '_blank', 'width=680,height=520');
  w.document.write(html);
  w.document.close();
}

export function printBinLabel(imgData, bin, size = 'a6') {
  const cfg = SIZE_CONFIG[size] || SIZE_CONFIG['a6'];
  const isCol = cfg.layout === 'col';

  openPrintWindow(`<!DOCTYPE html>
<html>
<head>
  <title>Bin — ${bin.full_code}</title>
  <style>
    @page { size: ${cfg.page}; margin: ${isCol ? '4mm' : '8mm'}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', monospace;
      display: flex;
      flex-direction: ${isCol ? 'column' : 'row'};
      align-items: center;
      ${isCol ? 'justify-content: center;' : 'gap: 14px;'}
      height: 100vh;
      padding: ${isCol ? '4px' : '10px'};
    }
    img { width: ${cfg.qr}px; height: ${cfg.qr}px; flex-shrink: 0; }
    .info { ${isCol ? 'text-align: center; margin-top: 4px;' : 'flex: 1;'} }
    .code { font-size: ${isCol ? '14px' : '26px'}; font-weight: 900; letter-spacing: 1px; }
    .meta { font-size: ${isCol ? '9px' : '12px'}; color: #555; margin-top: ${isCol ? '2px' : '4px'}; }
    .hint { font-size: ${isCol ? '8px' : '10px'}; color: #999; margin-top: ${isCol ? '2px' : '8px'}; }
  </style>
</head>
<body>
  <img src="${imgData}" alt="QR" />
  <div class="info">
    <div class="code">${bin.full_code}</div>
    ${bin.zone_name ? `<div class="meta">Zone: ${bin.zone_name}</div>` : ''}
    <div class="hint">BIN:${bin.full_code}</div>
  </div>
  <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 800); }<\/script>
</body>
</html>`);
}

export function printItemLabel(imgData, item, size = 'a6') {
  const cfg = SIZE_CONFIG[size] || SIZE_CONFIG['a6'];
  const isCol = cfg.layout === 'col';

  openPrintWindow(`<!DOCTYPE html>
<html>
<head>
  <title>Item — ${item.item_number}</title>
  <style>
    @page { size: ${cfg.page}; margin: ${isCol ? '4mm' : '8mm'}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', monospace;
      display: flex;
      flex-direction: ${isCol ? 'column' : 'row'};
      align-items: center;
      ${isCol ? 'justify-content: center;' : 'gap: 14px;'}
      height: 100vh;
      padding: ${isCol ? '4px' : '10px'};
    }
    img { width: ${cfg.qr}px; height: ${cfg.qr}px; flex-shrink: 0; }
    .info { ${isCol ? 'text-align: center; margin-top: 4px;' : 'flex: 1;'} }
    .code { font-size: ${isCol ? '12px' : '22px'}; font-weight: 900; }
    .desc { font-size: ${isCol ? '9px' : '13px'}; margin-top: ${isCol ? '2px' : '5px'}; color: #222; font-family: sans-serif; }
    .desc2 { font-size: ${isCol ? '8px' : '11px'}; color: #555; margin-top: 2px; font-family: sans-serif; }
    .meta { font-size: ${isCol ? '8px' : '11px'}; color: #777; margin-top: ${isCol ? '2px' : '6px'}; }
    .hint { font-size: ${isCol ? '7px' : '10px'}; color: #999; margin-top: ${isCol ? '2px' : '6px'}; }
  </style>
</head>
<body>
  <img src="${imgData}" alt="QR" />
  <div class="info">
    <div class="code">${item.item_number}</div>
    <div class="desc">${item.description_1}</div>
    ${item.description_2 ? `<div class="desc2">${item.description_2}</div>` : ''}
    <div class="meta">${item.category} · ${item.uom}${item.reorder_point ? ` · ROP: ${item.reorder_point}` : ''}</div>
    <div class="hint">ITEM:${item.item_number}</div>
  </div>
  <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 800); }<\/script>
</body>
</html>`);
}
