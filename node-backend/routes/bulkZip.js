const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const archiverLib = require('archiver');

// archiver v8 exports classes (ZipArchive); v7 and older export a factory function. Support both. 28-Oct-2026
function newZip() {
    if (typeof archiverLib === 'function') return archiverLib('zip', { zlib: { level: 9 } });
    return new archiverLib.ZipArchive({ zlib: { level: 9 } });
}

const UPLOADS = path.resolve(__dirname, '..', 'uploads');

// POST /api/bulk-zip  { files: ["/uploads/final_docs/x.pdf", ...], zipName }
router.post('/', (req, res) => {
    const { files, zipName } = req.body || {};
    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'No files provided for zipping' });
    }

    // only files inside the uploads folder (the old code zipped any path sent, e.g. "../.env")
    const found = [];
    for (const fileUrl of files) {
        const rel = String(fileUrl || '').replace(/^\/+/, '');
        const abs = path.resolve(__dirname, '..', rel);
        if (!abs.startsWith(UPLOADS + path.sep)) continue;
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) found.push(abs);
    }
    if (!found.length) return res.status(404).json({ error: 'None of the selected files were found on the server' });

    const outputName = String(zipName || 'bulk_download.zip').replace(/[^\w.\- ]/g, '_');
    let archive;
    try { archive = newZip(); } catch (e) { return res.status(500).json({ error: 'Zip library error: ' + e.message }); }

    archive.on('error', (err) => {
        if (!res.headersSent) res.status(500).json({ error: err.message });
        else res.end();
    });
    res.attachment(outputName);
    archive.pipe(res);
    const used = new Set();
    for (const abs of found) {
        let name = path.basename(abs);
        for (let i = 2; used.has(name); i++) name = path.basename(abs, path.extname(abs)) + '_' + i + path.extname(abs);
        used.add(name);
        archive.file(abs, { name });
    }
    archive.finalize();
});

module.exports = router;
