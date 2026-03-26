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
