const db = require('../config/database');
const PartyExpense = db.PartyExpense;
const Doctor = db.Doctor;
const Chemist = db.Chemist;
const Stockist = db.Stockist;

// Create and Save a new Expense
exports.create = async (req, res) => {
    try {
        const { party_type, party_id, expense_type, amount, date, notes } = req.body;

        if (!party_type || !party_id || !expense_type || !amount) {
            return res.status(400).json({ message: "Missing required fields!" });
        }

        // Fetch party name
        let party_name = 'Unknown';
        if (party_type.toLowerCase() === 'doctor') {
            const doctor = await Doctor.findByPk(party_id);
            if (doctor) party_name = doctor.name;
        } else if (party_type.toLowerCase() === 'chemist') {
            const chemist = await Chemist.findByPk(party_id);
            if (chemist) party_name = chemist.contact_person || chemist.shop_name || 'Chemist';
        } else if (party_type.toLowerCase() === 'stockist') {
            const stockist = await Stockist.findByPk(party_id);
            if (stockist) party_name = stockist.contact_person || stockist.agency_name || 'Stockist';
        }

        const expense = await PartyExpense.create({
            party_type,
            party_id,
            party_name,
            expense_type,
            amount,
            date: date || new Date(),
            notes
        });

        res.status(201).json({
            message: "Expense saved successfully",
            expense
        });
    } catch (error) {
        console.error("Error creating Party Expense:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Retrieve all Party Expenses
exports.findAll = async (req, res) => {
    try {
        const expenses = await PartyExpense.findAll({
            order: [['created_at', 'DESC']]
        });
        res.status(200).json(expenses);
    } catch (error) {
        console.error("Error fetching Party Expenses:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
