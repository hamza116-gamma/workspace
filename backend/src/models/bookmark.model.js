const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true },
  },
  { timestamps: true },
);

bookmarkSchema.index({ user: 1, message: 1 }, { unique: true });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
