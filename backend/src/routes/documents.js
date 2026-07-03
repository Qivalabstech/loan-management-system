const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const { logAudit } = require('../utils/audit');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../../uploads'),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random()*1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.jpg','.jpeg','.png','.doc','.docx'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('File type not allowed'));
  },
});

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { application_id, borrower_id } = req.query;
    const conditions = [];
    const params = [];
    if (application_id) conditions.push(`application_id=$${params.push(application_id)}`);
    if (borrower_id) conditions.push(`borrower_id=$${params.push(borrower_id)}`);
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await query(`SELECT * FROM documents ${where} ORDER BY uploaded_at DESC`, params);
    res.json({ documents: result.rows });
  } catch (err) { next(err); }
});

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { application_id, borrower_id, doc_type } = req.body;
    if (!doc_type) return res.status(400).json({ error: 'doc_type required' });

    const result = await query(
      `INSERT INTO documents (application_id,borrower_id,doc_type,file_name,file_path,file_size,mime_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [application_id || null, borrower_id || null, doc_type,
       req.file.originalname, `/uploads/${req.file.filename}`,
       req.file.size, req.file.mimetype]
    );
    await logAudit({ userId: req.user.id, action: 'UPLOAD_DOCUMENT', entityType: 'documents', entityId: result.rows[0].id, newValues: { doc_type, file_name: req.file.originalname }, ipAddress: req.ip });
    res.status(201).json({ document: result.rows[0] });
  } catch (err) { next(err); }
});

router.patch('/:id/verify', requireRoles('Admin','Credit Analyst'), async (req, res, next) => {
  try {
    const { status, rejection_reason } = req.body;
    if (!['Verified','Rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const result = await query(
      `UPDATE documents SET status=$1, rejection_reason=$2, verified_at=NOW(), verified_by=$3 WHERE id=$4 RETURNING *`,
      [status, rejection_reason || null, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Document not found' });
    res.json({ document: result.rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:id', requireRoles('Admin'), async (req, res, next) => {
  try {
    const result = await query('DELETE FROM documents WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Document not found' });
    res.json({ message: 'Document deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
