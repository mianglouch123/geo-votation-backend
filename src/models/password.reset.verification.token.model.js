import mongoose, { Schema } from 'mongoose';

const PasswordResetTokenSchema = new Schema({
  email: { 
    type: String,  // ← CORREGIDO: debe ser String, no ObjectId
    required: true, 
    lowercase: true,
    trim: true
  },
  token: { 
    type: String, 
    required: true 
  },
  expires: { 
    type: Date, 
    default: () => new Date(+new Date() + 15*60*1000) // 15 min
  }
}, { 
  timestamps: { createdAt: 'created_at' } 
});

// ✅ Índice para búsquedas por email
PasswordResetTokenSchema.index({ email: 1 });

// Índice para TTL basado en expires
PasswordResetTokenSchema.index(
  { expires: 1 }, 
  { expireAfterSeconds: 0 }
);

export const PasswordResetTokenModel = mongoose.model('PasswordResetToken', PasswordResetTokenSchema);