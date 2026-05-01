import mongoose, { Schema } from 'mongoose';

const TokenSchemaDefinition = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  token: { 
    type: String, 
    required: true,
  },
  expires: { 
    type: Date, 
    default: () => new Date(+new Date() + 9*60*1000) 
  }
}, { 
  timestamps: { createdAt: 'created_at', updatedAt: false } 
});

// Index Unique
TokenSchemaDefinition.index({ userId: 1 }, { unique: true });


//Índice para eliminar tokens expirados automáticamente después de 10 minutos
TokenSchemaDefinition.index(
  { created_at: 1 },
  { expireAfterSeconds: 900 } // 15 minutos
);
	
export const TokenSchemaModel = mongoose.model('TokenSchema', TokenSchemaDefinition);