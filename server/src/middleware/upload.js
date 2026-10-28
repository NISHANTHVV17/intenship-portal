import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config.js';
import { badRequest } from '../utils/http.js';

export const resumeDir = path.join(config.uploadDir, 'resumes');
fs.mkdirSync(resumeDir, { recursive: true });

const storage = multer.diskStorage({
  destination: resumeDir,
  filename: (req, _file, cb) =>
    cb(null, `${req.user.id}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.pdf`),
});

const multerResume = multer({
  storage,
  limits: { fileSize: config.maxResumeBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    // Some browsers send a generic type for PDFs; the %PDF- signature is verified after upload.
    const pdfType = ['application/pdf', 'application/x-pdf', 'application/octet-stream'].includes(file.mimetype);
    const isPdf = pdfType && path.extname(file.originalname).toLowerCase() === '.pdf';
    cb(isPdf ? null : badRequest('Only PDF files are allowed'), isPdf);
  },
}).single('resume');

/** Accepts one PDF (max 5 MB) in field "resume" and verifies the %PDF- signature. */
export function uploadResume(req, res, next) {
  multerResume(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return next(
          badRequest(err.code === 'LIMIT_FILE_SIZE' ? 'Resume must be 5 MB or smaller' : err.message),
        );
      }
      return next(err);
    }
    if (!req.file) return next(badRequest('Attach a PDF file in the "resume" field'));

    const fd = fs.openSync(req.file.path, 'r');
    const header = Buffer.alloc(5);
    fs.readSync(fd, header, 0, 5, 0);
    fs.closeSync(fd);
    if (header.toString('latin1') !== '%PDF-') {
      fs.rmSync(req.file.path, { force: true });
      return next(badRequest('The uploaded file is not a valid PDF'));
    }
    next();
  });
}

/** Resolves a stored resume filename to a safe absolute path, or null. */
export function resumePath(fileName) {
  if (!fileName || path.basename(fileName) !== fileName) return null;
  const full = path.join(resumeDir, fileName);
  return fs.existsSync(full) ? full : null;
}

export const removeResumeFile = (fileName) => {
  const full = resumePath(fileName);
  if (full) fs.rmSync(full, { force: true });
};
