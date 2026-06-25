const { sequelize, ForwardingNote, InvoiceTracking } = require('../src/config/database');

const runSync = async () => {
  try {
    console.log('Fetching all forwarding notes...');
    const notes = await ForwardingNote.findAll({
      include: [{ model: InvoiceTracking, as: 'invoiceTracking' }]
    });

    console.log(`Found ${notes.length} forwarding notes. Checking for mismatches...`);
    let updateCount = 0;

    for (const note of notes) {
      if (note.invoiceTracking) {
        const expectedNo = note.invoiceTracking.invoice_number;
        const expectedDate = note.invoiceTracking.invoice_date;
        const expectedAmount = note.invoiceTracking.amount;

        const needsUpdate = 
          note.invoice_no !== expectedNo ||
          note.invoice_date !== expectedDate ||
          parseFloat(note.amount || 0) !== parseFloat(expectedAmount || 0);

        if (needsUpdate) {
          console.log(`Mismatch found for Serial #${note.serial_no}:`);
          console.log(`  Current: No=${note.invoice_no}, Date=${note.invoice_date}, Amount=${note.amount}`);
          console.log(`  Expected: No=${expectedNo}, Date=${expectedDate}, Amount=${expectedAmount}`);
          
          await note.update({
            invoice_no: expectedNo,
            invoice_date: expectedDate,
            amount: expectedAmount
          });
          updateCount++;
        }
      }
    }

    console.log(`Sync complete! Updated ${updateCount} mismatched forwarding notes.`);
  } catch (error) {
    console.error('Error syncing existing forwarding notes:', error);
  } finally {
    process.exit(0);
  }
};

runSync();
