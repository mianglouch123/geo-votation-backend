import mongoose, { Schema } from "mongoose";

const RefreshTokenSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  token: { 
    type: String, 
    required: true,
    unique: true  // ← ÚNICO ÍNDICE para token
  },
  expiresAt: { 
    type: Date, 
    required: true,
    default: () => new Date(+new Date() + 7*24*60*60*1000)
  },
  revoked: { 
    type: Boolean, 
    default: false 
  }
}, { 
  timestamps: { createdAt: 'created_at' } 
});

// ✅ Solo índices que NO están en los campos
RefreshTokenSchema.index({ userId: 1 }); // ← Este sí hace falta
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = mongoose.model('RefreshToken', RefreshTokenSchema);