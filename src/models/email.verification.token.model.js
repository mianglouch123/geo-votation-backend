import mongoose, { Schema } from 'mongoose';
const EmailVerificationTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  token: { type: String, required: true },
  expires: { type: Date, default : () => +new Date() + 9 * 60 * 1000 }
}, { timestamps: { createdAt: 'created_at' } });


//INDICE PARA ELIMINAR PASADO 9 MINUTOS

EmailVerificationTokenSchema.index({ created_at: 1 }, { expireAfterSeconds: 900 });


export const EmailVerificationTokenModel = mongoose.model('EmailVerificationToken', EmailVerificationTokenSchema);