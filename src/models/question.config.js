import mongoose, { Schema } from 'mongoose';

const QuestionConfigSchema = new Schema({
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
  config: { 
    type: Schema.Types.Mixed // JSON
  }
});

// Index Unique
QuestionConfigSchema.index({ questionId: 1, questionVersion: 1 }, { unique: true });

export const QuestionConfigModel = mongoose.model('QuestionConfig', QuestionConfigSchema);