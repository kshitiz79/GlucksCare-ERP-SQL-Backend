// src/salesTarget/salesTargetSync.js

/**
 * Recalculates and updates SalesTarget.achieved_amount for a given head office, month and year
 * based on all non-cancelled stockist invoices (taxable_amount - discount_amount).
 */
const syncHeadOfficeSalesTarget = async (headOfficeId, targetMonth, targetYear, db) => {
  if (!headOfficeId || !targetMonth || !targetYear || !db) return null;

  try {
    const sequelize = db.sequelize || db;
    const SalesTarget = db.SalesTarget;
    if (!sequelize) return null;

    // Calculate sum of (taxable_amount - discount_amount) from invoice_tracking
    const result = await sequelize.query(`
      SELECT 
        COALESCE(SUM(
          GREATEST(0, COALESCE(it.taxable_amount, it.amount, 0) - COALESCE(it.discount_amount, 0))
        ), 0) AS total_achieved
      FROM invoice_tracking it
      JOIN stockists s ON it.stockist_id = s.id
      WHERE s.head_office_id = :headOfficeId
        AND EXTRACT(MONTH FROM it.invoice_date)::int = :targetMonth
        AND EXTRACT(YEAR FROM it.invoice_date)::int = :targetYear
        AND it.status != 'cancelled'
    `, {
      replacements: {
        headOfficeId,
        targetMonth: parseInt(targetMonth),
        targetYear: parseInt(targetYear)
      },
      type: sequelize.QueryTypes.SELECT
    });

    const totalAchieved = parseFloat(result?.[0]?.total_achieved || 0);

    if (SalesTarget) {
      // Find if a sales target exists for this head office, month and year
      const target = await SalesTarget.findOne({
        where: {
          head_office_id: headOfficeId,
          target_month: parseInt(targetMonth),
          target_year: parseInt(targetYear),
          user_id: null
        }
      });

      if (target) {
        target.achieved_amount = totalAchieved;
        const targetAmt = parseFloat(target.target_amount) || 0;
        target.achievement_percentage = targetAmt > 0 ? Math.round((totalAchieved / targetAmt) * 100) : 0;
        if (totalAchieved >= targetAmt && targetAmt > 0) {
          target.status = 'Completed';
        } else if (totalAchieved > 0 && target.status !== 'Overdue') {
          target.status = 'Active';
        }
        await target.save();
        return target;
      }
    }

    return { headOfficeId, targetMonth, targetYear, totalAchieved };
  } catch (error) {
    console.error('Error in syncHeadOfficeSalesTarget:', error);
    return null;
  }
};

module.exports = {
  syncHeadOfficeSalesTarget
};
