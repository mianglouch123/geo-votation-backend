import mongoose, { Schema } from 'mongoose';

const AdminMemberByVotationSchema = new Schema({
  votationid: { 
    type: Schema.Types.ObjectId, 
    ref: 'Votation', 
    required: true 
  },
  invitedEmail: {  // ← Email de la persona invitada (único identificador)
    type: String, 
    required: true,
    lowercase: true,
    trim: true
  },
  invitedUserId: {  // ← Opcional: si el usuario ya está registrado
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: false,
    default: null
  },
  invitedByUserId: {  // ← Quién envía la invitación (del token)
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  ROLES: { 
    type: String, 
    enum: ['ONLYREAD', 'EDIT'],
    required: true
  },
  status: { 
    type: String, 
    enum: ['PENDING', 'ACCEPTED', 'REJECTED'], 
    default: 'PENDING' 
  }
}, { 
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
});

// Índice único: una invitación por email por votación
AdminMemberByVotationSchema.index({ votationid: 1, invitedEmail: 1 }, { unique: true });

// Índice para buscar invitaciones por email (útil para el usuario)
AdminMemberByVotationSchema.index({ invitedEmail: 1, status: 1 });

export const AdminMemberByVotationModel = mongoose.model('AdminMemberByVotation', AdminMemberByVotationSchema);