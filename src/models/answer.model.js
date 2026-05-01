import mongoose, { Schema } from 'mongoose';

const AnswerSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User' 
  },
  votationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Votation' 
  },
  questionId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Question' 
  },
  questionVersion: { 
    type: Number 
  },
  value: { 
    type: Schema.Types.Mixed // JSON
  }
}, { 
  timestamps: { createdAt: 'created_at', updatedAt: false } 
});

// Index Unique
AnswerSchema.index(
  { userId: 1, votationId: 1, questionId: 1, questionVersion: 1 }, 
  { unique: true }
);

export const AnswerModel = mongoose.model('Answer', AnswerSchema);