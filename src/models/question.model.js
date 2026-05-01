import mongoose, { Schema } from 'mongoose';

const QuestionSchema = new Schema({
  votationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Votation', 
    required: true 
  },
  label: { 
    type: String 
  },
  code: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['DATE', 'HOUR', 'SHORTANSWER', 'LARGEANSWER', 'MULTI_OPTION'],
    required: true
  },
  isRequired: { 
    type: Boolean, 
    default: false 
  },
  version: { 
    type: Number, 
    required: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { 
  timestamps: { createdAt: 'created_at', updatedAt: false } 
});

// Index Unique
QuestionSchema.index({ _id: 1, votationId: 1, version: 1 }, { unique: true });

export const QuestionModel = mongoose.model('Question', QuestionSchema);