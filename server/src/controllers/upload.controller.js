const XLSX = require('xlsx');
const excelService = require('../services/excel.service');

exports.validate = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const overrideProjectId = req.body.project_id || null;
    const result = await excelService.parsePackingList(req.file.buffer, overrideProjectId);
    res.json(result);
  } catch (err) { next(err); }
};

exports.confirm = async (req, res, next) => {
  try {
    const { valid_rows } = req.body;
    if (!valid_rows?.length) return res.status(400).json({ error: 'No valid rows to import' });
    await excelService.confirmImport(valid_rows);
    res.json({ message: `${valid_rows.length} rows imported successfully` });
  } catch (err) { next(err); }
};

exports.template = (req, res) => {
  const headers = [
    'PROJECT NAME', 'PROJECT NUMBER', 'Y3#', 'CATEGORY',
    'ITEM NUMBER', 'ITEM DESCRIPTION', 'DESCRIPTION LINE 2', 'UOM',
    'Project Onhand', 'Container No.', 'Issued Quantity',
    'Returned Quantity', 'Pending Return QTY'
  ];

  const sampleRows = [
    [
      'Jeddah Coastal Highway', 'PRJ-001', 'Y3-1001', 'CH',
      'CH-001', 'Steel Pipe 2 inch', 'ASTM A53 Grade B', 'PCS',
      100, 'CONT-001', 10, 5, 5
    ],
    [
      'Jeddah Coastal Highway', 'PRJ-001', 'Y3-1002', 'SPARE',
      'SP-001', 'Bearing 6205', 'Deep Groove Ball Bearing', 'PCS',
      50, '', 0, 0, 0
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  // Set column widths
  ws['!cols'] = headers.map((h, i) => ({ wch: [20,15,10,10,12,30,25,6,12,12,14,16,16][i] || 15 }));

  XLSX.utils.book_append_sheet(wb, ws, 'Packing List');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="packing-list-template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
};
