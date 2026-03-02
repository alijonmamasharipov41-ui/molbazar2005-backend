const express = require("express");
const multer = require("multer");
const cloudinary = require("../lib/cloudinary");
const { auth } = require("../middleware/auth");

const router = express.Router();

/* =========================================
   MULTER CONFIG (Memory Storage)
========================================= */

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Invalid file type"));
    }
    cb(null, true);
  },
});

/* =========================================
   POST /uploads — folder: listings (default) | banners, avatars (admin only)
========================================= */

const allowedFolders = ["listings", "banners", "avatars"];

router.post("/", auth, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "No file provided",
      });
    }

    let folder = "listings";
    if (req.body.folder && allowedFolders.includes(req.body.folder)) {
      if (req.body.folder === "listings") {
        folder = "listings";
      } else {
        if (req.user.role !== "admin") {
          return res.status(403).json({
            ok: false,
            error: "Faqat admin yuklashi mumkin",
          });
        }
        folder = req.body.folder;
      }
    }

    const uploadToCloudinary = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `molbazar2005/${folder}`,
            resource_type: "image",
            transformation: [
              { width: 1200, crop: "limit" },
              { quality: "auto" },
              { fetch_format: "auto" },
            ],
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );

        stream.end(req.file.buffer);
      });

    const result = await uploadToCloudinary();

    res.json({
      ok: true,
      url: result.secure_url,
    });
  } catch (err) {
    if (err.message === "Invalid file type") {
      return res.status(400).json({
        ok: false,
        error: "Invalid file type",
      });
    }

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        ok: false,
        error: "File size exceeds 5MB",
      });
    }

    next(err);
  }
});

module.exports = router;
