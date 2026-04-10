module.exports = (err, req, res, next) => {
  console.error(err);

  // Sanitize PostgreSQL errors to avoid leaking schema details
  if (err.code === '23503') return res.status(400).json({ error: 'Invalid reference: related record not found' });
  if (err.code === '23505') return res.status(409).json({ error: 'A record with this value already exists' });
  if (err.code === '23514') return res.status(400).json({ error: 'Value violates a data constraint (e.g. quantity must be greater than 0)' });
  if (err.code === '22P02') return res.status(400).json({ error: 'Invalid input format' });

  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message });
};
