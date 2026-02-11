// src/forwardingNote/forwardingNoteController.js

// Helper to generate serial number
const generateSerialNumber = async (ForwardingNote) => {
    const lastRecord = await ForwardingNote.findOne({
        order: [['created_at', 'DESC']]
    });

    if (!lastRecord || !lastRecord.serial_no) {
        return '0001';
    }

    const lastSerial = parseInt(lastRecord.serial_no);
    if (isNaN(lastSerial)) {
        return '0001';
    }

    const nextSerial = lastSerial + 1;
    return nextSerial.toString().padStart(4, '0');
};

// GET all forwarding notes
const getAllForwardingNotes = async (req, res) => {
    try {
        const { ForwardingNote, InvoiceTracking, Stockist } = req.app.get('models');
        const { page = 1, limit = 10 } = req.query;

        const options = {
            include: [
                {
                    model: InvoiceTracking,
                    as: 'invoiceTracking',
                    include: [{ model: Stockist, attributes: ['id', 'firm_name'] }]
                }
            ],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit),
            order: [['created_at', 'DESC']]
        };

        const { count, rows } = await ForwardingNote.findAndCountAll(options);

        res.json({
            success: true,
            data: rows,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / parseInt(limit)),
                totalCount: count,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching forwarding notes:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// GET forwarding note by ID
const getForwardingNoteById = async (req, res) => {
    try {
        const { ForwardingNote, InvoiceTracking, Stockist } = req.app.get('models');
        const { id } = req.params;

        const forwardingNote = await ForwardingNote.findByPk(id, {
            include: [
                {
                    model: InvoiceTracking,
                    as: 'invoiceTracking',
                    include: [{ model: Stockist, attributes: ['id', 'firm_name'] }]
                }
            ]
        });

        if (!forwardingNote) {
            return res.status(404).json({
                success: false,
                message: 'Forwarding note not found'
            });
        }

        res.json({
            success: true,
            data: forwardingNote
        });
    } catch (error) {
        console.error('Error fetching forwarding note:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// CREATE new forwarding note
const createForwardingNote = async (req, res) => {
    try {
        const { ForwardingNote, InvoiceTracking, Stockist } = req.app.get('models');
        const {
            invoice_tracking_id,
            transport_courier_name,
            origin,
            origin_address,
            destination,
            to_city,
            to_pincode,
            to_state,
            to_mobile,
            cases,
            amount,
            permit_no,
            commodity,
            freight_note
        } = req.body;

        if (!invoice_tracking_id) {
            return res.status(400).json({
                success: false,
                message: 'Invoice Tracking ID is required'
            });
        }

        // Fetch invoice tracking details to auto-fill some fields
        const invoiceTracking = await InvoiceTracking.findByPk(invoice_tracking_id, {
            include: [{ model: Stockist }]
        });

        if (!invoiceTracking) {
            return res.status(404).json({
                success: false,
                message: 'Invoice tracking record not found'
            });
        }

        const serial_no = await generateSerialNumber(ForwardingNote);

        const forwardingNoteData = {
            invoice_tracking_id,
            serial_no,
            transport_courier_name: transport_courier_name || invoiceTracking.courier_company_name,
            customer_name: invoiceTracking.Stockist ? invoiceTracking.Stockist.firm_name : invoiceTracking.party_name,
            origin: origin || 'HEAD OFFICE',
            origin_address: origin_address || 'T3-236, GOLDEN I, TECHZONE IV, GREATER NOIDA WEST, U.P.',
            destination: destination || (invoiceTracking.Stockist ? invoiceTracking.Stockist.registered_office_address : ''),
            to_city: to_city || '',
            to_pincode: to_pincode || '',
            to_state: to_state || '',
            to_mobile: to_mobile || (invoiceTracking.Stockist ? invoiceTracking.Stockist.mobile_number : ''),
            invoice_no: invoiceTracking.invoice_number,
            invoice_date: invoiceTracking.invoice_date,
            cases,
            amount: amount || invoiceTracking.amount,
            permit_no,
            commodity,
            freight_note: freight_note || 'FREIGHT TO BE BILLED',
            created_by: req.user.id
        };

        const forwardingNote = await ForwardingNote.create(forwardingNoteData);

        res.status(201).json({
            success: true,
            data: forwardingNote,
            message: 'Forwarding note created successfully'
        });
    } catch (error) {
        console.error('Error creating forwarding note:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// UPDATE forwarding note
const updateForwardingNote = async (req, res) => {
    try {
        const { ForwardingNote } = req.app.get('models');
        const { id } = req.params;
        const updateData = req.body;

        const forwardingNote = await ForwardingNote.findByPk(id);
        if (!forwardingNote) {
            return res.status(404).json({
                success: false,
                message: 'Forwarding note not found'
            });
        }

        // Don't allow updating serial_no or invoice_tracking_id directly if not intended
        delete updateData.serial_no;
        delete updateData.invoice_tracking_id;

        updateData.updated_by = req.user.id;
        await forwardingNote.update(updateData);

        res.json({
            success: true,
            data: forwardingNote,
            message: 'Forwarding note updated successfully'
        });
    } catch (error) {
        console.error('Error updating forwarding note:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// DELETE forwarding note
const deleteForwardingNote = async (req, res) => {
    try {
        const { ForwardingNote } = req.app.get('models');
        const { id } = req.params;

        const forwardingNote = await ForwardingNote.findByPk(id);
        if (!forwardingNote) {
            return res.status(404).json({
                success: false,
                message: 'Forwarding note not found'
            });
        }

        await forwardingNote.destroy();

        res.json({
            success: true,
            message: 'Forwarding note deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting forwarding note:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getAllForwardingNotes,
    getForwardingNoteById,
    createForwardingNote,
    updateForwardingNote,
    deleteForwardingNote
};
