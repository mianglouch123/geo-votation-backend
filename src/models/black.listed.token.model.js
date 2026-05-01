// models/blacklisted.token.model.js
import mongoose, { Schema } from 'mongoose';

const BlacklistedTokenSchema = new Schema({
  token: { 
    type: String, 
    required: true,
    unique: true 
  },
  expiresAt: { 
    type: Date, 
    required: true 
  }
}, { 
  timestamps: { createdAt: 'created_at' } 
});

// Índice TTL para limpieza automática
BlacklistedTokenSchema.index(
  { expiresAt: 1 }, 
  { expireAfterSeconds: 0 }
);



export const BlacklistedTokenModel = mongoose.model('BlacklistedToken', BlacklistedTokenSchema);