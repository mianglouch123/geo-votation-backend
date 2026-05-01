import mongoose, { Schema } from 'mongoose';

const NotificationSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  action: { 
    type: String, 
    required: true 
  },
  groupKey: { 
    type: String, 
    required: true 
  },
  count: { 
    type: Number, 
    default: 1 
  },
  last_message: { 
    type: String 
  },
  payload: { 
    type: Schema.Types.Mixed // JSON
  },
  read: { 
    type: Boolean, 
    default: false 
  }
}, { 
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
});

// 1. Índice Parcial ÚNICO (Digest)
NotificationSchema.index(
  { userId: 1, groupKey: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { read: false } 
  }
);

// 2. Índice TTL (Limpieza a los 30 días)
NotificationSchema.index(
  { created_at: 1 }, 
  { expireAfterSeconds: 2592000 } 
);

export const NotificationModel = mongoose.model('Notification', NotificationSchema);