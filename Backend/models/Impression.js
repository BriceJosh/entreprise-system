const mongoose = required('mongoose');
const impressionSchema = new mongoose.Schema({
    designation: { type: String, required: true},
    quantite:{ type: Number, required: true},
    prix_unitaire: { type: Number, required: true},
    montant_total: { type: Number, required: true},
    site_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true},
    user_id: { type: mongoose.Schema.Type.ObjectId, ref: 'User',required: true}
}, { timestamps: true}

);

module.exports = mongoose.model('Impression', impressionSchema)