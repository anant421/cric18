import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { asyncHandler } from '../asyncHandler.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Buffered in memory, not written to local disk - the app server's own
// filesystem is ephemeral on Render's free tier (wiped on every
// redeploy/restart/sleep-wake), so photos must live in Cloudinary instead.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG or WEBP images are allowed'));
    }
    cb(null, true);
  },
});

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'scorexi/players', resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

const router = Router();

// Deliberately public (no requireAdmin): players self-register with their
// own photo, same trust level as the rest of the registration form.
router.post('/photo', upload.single('photo'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'photo file is required' });
  const result = await uploadToCloudinary(req.file.buffer);
  res.status(201).json({ url: result.secure_url });
}));

export default router;
