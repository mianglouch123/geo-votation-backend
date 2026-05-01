import 'dotenv/config';
import mongoose from 'mongoose';



export class MongooseDb {

static #instance = null;


static getInstance() {
  if(!this.#instance) {
	this.#instance = Object.freeze(new MongooseDb());
  }	
 return this.#instance;
}

async getConnectionString() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB conectado correctamente");
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error);
    throw error;
  }
}




}