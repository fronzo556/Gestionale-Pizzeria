import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Sostituisci questa stringa se usi MongoDB Atlas online, 
    // altrimenti questa va bene per quello locale
    await mongoose.connect('mongodb://localhost:27017/freepizza');
    console.log('✅ MongoDB Connesso!');
  } catch (error) {
    console.error('❌ Errore connessione MongoDB:', error);
    process.exit(1);
  }
};

export default connectDB;
