import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  email: { 
    type: String, 
    unique: true, 
    required: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  isVerfied: { // Respetando propiedad original
    type: Boolean, 
    default: false 
  }
}, { 
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
});

export const UserModel = mongoose.model('User', UserSchema);