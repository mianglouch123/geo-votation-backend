import mongoose, { Schema } from 'mongoose';

const VotationSchema = new Schema({
  ownerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  subject: { 
    type: String 
  },
  description: { 
    type: String 
  },
  closes_at: { 
    type: Date 
  }
}, { 
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
});

export const VotationModel = mongoose.model('Votation', VotationSchema);