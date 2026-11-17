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
            to_mobile,
            cases,
            amount,
            eway_bill_no,
            weight,
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
            origin_address: origin_address || '',
            destination: destination || (invoiceTracking.Stockist ? invoiceTracking.Stockist.registered_office_address : ''),
            to_mobile: to_mobile || (invoiceTracking.Stockist ? invoiceTracking.Stockist.mobile_number : ''),
            invoice_no: invoiceTracking.invoice_number,
            invoice_date: invoiceTracking.invoice_date,
            cases,
            amount: amount || invoiceTracking.amount,
            eway_bill_no,
            weight,
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

// SEND forwarding note / dispatch notification email
const sendForwardingNoteEmail = async (req, res) => {
    try {
        const { ForwardingNote, InvoiceTracking, Stockist } = req.app.get('models');
        const { id } = req.params;

        // Find by ForwardingNote ID or InvoiceTracking ID
        let forwardingNote = await ForwardingNote.findByPk(id, {
            include: [
                {
                    model: InvoiceTracking,
                    as: 'invoiceTracking',
                    include: [{ model: Stockist }]
                }
            ]
        });

        let invoice = null;
        if (forwardingNote) {
            invoice = forwardingNote.invoiceTracking;
        } else {
            invoice = await InvoiceTracking.findByPk(id, {
                include: [
                    { model: Stockist },
                    { model: ForwardingNote, as: 'forwardingNotes' }
                ]
            });
            if (invoice && invoice.forwardingNotes && invoice.forwardingNotes.length > 0) {
                forwardingNote = invoice.forwardingNotes[0];
            }
        }

        if (!invoice && !forwardingNote) {
            return res.status(404).json({ success: false, message: 'Forwarding note or invoice not found' });
        }

        const recipientEmail = req.body?.recipientEmail || invoice?.Stockist?.email_address;
        if (!recipientEmail) {
            return res.status(400).json({ success: false, message: 'Stockist email not found. Please provide an email address.' });
        }

        const EmailService = require('../services/email.service');
        const { transporter, config } = await EmailService.getTransporter(req.app.get('models'));

        // Customer and invoice details
        const customerName = forwardingNote?.customer_name || invoice?.Stockist?.firm_name || 'Valued Customer';
        const invoiceNumber = forwardingNote?.invoice_no || invoice?.invoice_number || 'N/A';
        const invoiceDate = forwardingNote?.invoice_date
            ? new Date(forwardingNote.invoice_date).toLocaleDateString('en-IN')
            : (invoice?.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-IN') : 'N/A');
        const dispatchDate = invoice?.receipt_date
            ? new Date(invoice.receipt_date).toLocaleDateString('en-IN')
            : (forwardingNote?.created_at ? new Date(forwardingNote.created_at).toLocaleDateString('en-IN') : invoiceDate);
        const transporterName = forwardingNote?.transport_courier_name || invoice?.courier_company_name || 'N/A';
        const casesCount = forwardingNote?.cases ? `${forwardingNote.cases} Box(es)` : 'Goods Dispatched';
        const awbNumber = invoice?.awb_number || forwardingNote?.eway_bill_no || 'N/A';
        const weight = forwardingNote?.weight ? `${forwardingNote.weight} kg` : null;
        const destination = forwardingNote?.destination || invoice?.Stockist?.registered_office_address || null;

        // Public Tracking Link
        const originUrl = req.headers.origin || process.env.FRONTEND_URL || 'https://gluckscare.com';
        const publicFNoteUrl = forwardingNote?.id ? `${originUrl}/forwarding-note/${forwardingNote.id}` : '';
        const trackingUrl = invoice?.tracking_link || publicFNoteUrl || `${originUrl}/login/admin-dashboard/forwarding-notes`;

        // Optional invoice PDF attachment
        let attachments = [];
        if (invoice?.invoice_image_public_id) {
            try {
                const { GetObjectCommand } = require('@aws-sdk/client-s3');
                const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
                const s3Client = require('../config/b2Config');

                const getObjectParams = {
                    Bucket: process.env.B2_S3_BUCKET_NAME,
                    Key: invoice.invoice_image_public_id
                };
                const command = new GetObjectCommand(getObjectParams);
                const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

                attachments.push({
                    filename: `Invoice_${invoiceNumber}.pdf`,
                    path: signedUrl
                });
            } catch (attErr) {
                console.warn('Could not attach invoice image to dispatch email:', attErr.message);
            }
        }

        const mailOptions = {
            from: `"${config.fromName}" <${config.fromEmail || config.user}>`,
            to: recipientEmail,
            subject: `Dispatch Notification - Invoice No: ${invoiceNumber} | ${casesCount}`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
                  <p>Dear ${customerName},</p>
                  <p>Greetings from <strong>Gluckscare Pharmaceuticals</strong>.</p>
                  <p>We are pleased to inform you that your goods for <strong>Invoice No: ${invoiceNumber}</strong> containing <strong>${casesCount}</strong> have been dispatched via <strong>${transporterName}</strong> on <strong>${dispatchDate}</strong>.</p>
                  <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Invoice No:</strong> ${invoiceNumber}</p>
                    <p style="margin: 5px 0 0 0;"><strong>Invoice Date:</strong> ${invoiceDate}</p>
                    <p style="margin: 5px 0 0 0;"><strong>Dispatch Date:</strong> ${dispatchDate}</p>
                    <p style="margin: 5px 0 0 0;"><strong>Transporter / Courier:</strong> ${transporterName}</p>
                    <p style="margin: 5px 0 0 0;"><strong>Boxes / Quantity:</strong> ${casesCount}</p>
                    ${weight ? `<p style="margin: 5px 0 0 0;"><strong>Weight:</strong> ${weight}</p>` : ''}
                    <p style="margin: 5px 0 0 0;"><strong>AWB / Docket No:</strong> ${awbNumber}</p>
                    ${destination ? `<p style="margin: 5px 0 0 0;"><strong>Destination:</strong> ${destination}</p>` : ''}
                  </div>
                  <div style="margin: 25px 0; text-align: center;">
                    <a href="${trackingUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
                      Click Here to Track the Shipment
                    </a>
                  </div>
                  <p>Kindly verify the details and let us know if any clarification is required.</p>
                  <p>Thank you for your continued association with Gluckscare Pharmaceuticals.</p>
                  <p style="margin-top: 30px;">
                    Warm regards,<br>
                    <strong>Logistics & Dispatch Team</strong><br>
                    Gluckscare Pharmaceuticals
                  </p>
                </div>
            `,
            attachments
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('📧 Forwarding note dispatch email sent:', info.response);

        res.json({
            success: true,
            message: `Dispatch details sent to ${recipientEmail} successfully`
        });
    } catch (error) {
        console.error('Error sending dispatch email:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to send email' });
    }
};

module.exports = {
    getAllForwardingNotes,
    getForwardingNoteById,
    createForwardingNote,
    updateForwardingNote,
    deleteForwardingNote,
    sendForwardingNoteEmail
};
