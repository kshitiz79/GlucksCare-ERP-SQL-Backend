const { Op } = require('sequelize');

/**
 * Automatically schedules visits for a user for a date range based on their approved tour plan.
 * @param {Object} sequelize - Sequelize instance
 * @param {Object} models - Sequelize models object
 * @param {string} userId - UUID of the user
 * @param {string} startDate - start date (YYYY-MM-DD)
 * @param {string} endDate - end date (YYYY-MM-DD)
 * @param {string} type - 'doctor', 'chemist', 'stockist', or 'all'
 */
async function autoScheduleVisits(sequelize, models, userId, startDate, endDate, type = 'all') {
  try {
    const { TourPlan, TourPlanDay, BeatArea, Doctor, Chemist, Stockist, DoctorVisit, ChemistVisit, StockistVisit } = models;
    
    // Find all tour plan days for approved tour plans of this user in the date range
    const planDays = await TourPlanDay.findAll({
      include: [{
        model: TourPlan,
        as: 'tourPlan',
        where: {
          user_id: userId,
          status: 'Approved'
        },
        required: true
      }],
      where: {
        date: {
          [Op.between]: [startDate, endDate]
        }
      }
    });

    if (planDays.length === 0) {
      return;
    }

    // Collect all beat IDs
    const beatIds = [];
    planDays.forEach(pd => {
      if (pd.beat_id_1) beatIds.push(pd.beat_id_1);
      if (pd.beat_id_2) beatIds.push(pd.beat_id_2);
    });

    const uniqueBeatIds = [...new Set(beatIds)];
    if (uniqueBeatIds.length === 0) {
      return;
    }

    // Fetch all areas for these beats
    const beatAreas = await BeatArea.findAll({
      where: {
        beat_id: uniqueBeatIds
      }
    });

    // Map beat_id to list of area_ids
    const beatToAreas = {};
    beatAreas.forEach(ba => {
      if (!beatToAreas[ba.beat_id]) {
        beatToAreas[ba.beat_id] = [];
      }
      beatToAreas[ba.beat_id].push(ba.area_id);
    });

    // Collect all unique area IDs
    const uniqueAreaIds = [...new Set(beatAreas.map(ba => ba.area_id))];
    if (uniqueAreaIds.length === 0) {
      return;
    }

    // Fetch all doctors, chemists, and stockists in these areas
    let doctors = [];
    let chemists = [];
    let stockists = [];

    if (type === 'doctor' || type === 'all') {
      doctors = await Doctor.findAll({
        where: {
          areaId: uniqueAreaIds
        }
      });
    }

    if (type === 'chemist' || type === 'all') {
      chemists = await Chemist.findAll({
        where: {
          area_id: uniqueAreaIds
        }
      });
    }

    if (type === 'stockist' || type === 'all') {
      stockists = await Stockist.findAll({
        where: {
          area_id: uniqueAreaIds
        }
      });
    }

    // Fetch existing visits in this date range for this user
    let existingDoctorVisits = [];
    let existingChemistVisits = [];
    let existingStockistVisits = [];

    if (type === 'doctor' || type === 'all') {
      existingDoctorVisits = await DoctorVisit.findAll({
        where: {
          user_id: userId,
          date: { [Op.between]: [startDate, endDate] }
        }
      });
    }

    if (type === 'chemist' || type === 'all') {
      existingChemistVisits = await ChemistVisit.findAll({
        where: {
          user_id: userId,
          date: { [Op.between]: [startDate, endDate] }
        }
      });
    }

    if (type === 'stockist' || type === 'all') {
      existingStockistVisits = await StockistVisit.findAll({
        where: {
          user_id: userId,
          date: { [Op.between]: [startDate, endDate] }
        }
      });
    }

    // Create lookup sets for existing visits: "date_entityId"
    const existingDoctorVisitsSet = new Set(existingDoctorVisits.map(v => `${v.date}_${v.doctor_id}`));
    const existingChemistVisitsSet = new Set(existingChemistVisits.map(v => `${v.date}_${v.chemist_id}`));
    const existingStockistVisitsSet = new Set(existingStockistVisits.map(v => `${v.date}_${v.stockist_id}`));

    // Prepare arrays for bulk creation
    const doctorVisitsToCreate = [];
    const chemistVisitsToCreate = [];
    const stockistVisitsToCreate = [];

    // Loop through each plan day to associate beats -> areas -> entities
    planDays.forEach(pd => {
      const dateStr = pd.date;
      const dayBeatIds = [pd.beat_id_1, pd.beat_id_2].filter(Boolean);
      
      // Get all unique areas for today's beats
      const dayAreaIds = [];
      dayBeatIds.forEach(bid => {
        const aids = beatToAreas[bid] || [];
        dayAreaIds.push(...aids);
      });
      const uniqueDayAreaIds = [...new Set(dayAreaIds)];

      if (uniqueDayAreaIds.length === 0) return;

      // 1. Doctors
      if (type === 'doctor' || type === 'all') {
        const dayDoctors = doctors.filter(doc => uniqueDayAreaIds.includes(doc.areaId));
        dayDoctors.forEach(doc => {
          const lookupKey = `${dateStr}_${doc.id}`;
          if (!existingDoctorVisitsSet.has(lookupKey)) {
            doctorVisitsToCreate.push({
              user_id: userId,
              doctor_id: doc.id,
              date: dateStr,
              confirmed: false,
              notes: 'Auto-scheduled from Tour Plan'
            });
            // Add to set to prevent duplicates
            existingDoctorVisitsSet.add(lookupKey);
          }
        });
      }

      // 2. Chemists
      if (type === 'chemist' || type === 'all') {
        const dayChemists = chemists.filter(chem => uniqueDayAreaIds.includes(chem.area_id));
        dayChemists.forEach(chem => {
          const lookupKey = `${dateStr}_${chem.id}`;
          if (!existingChemistVisitsSet.has(lookupKey)) {
            chemistVisitsToCreate.push({
              user_id: userId,
              chemist_id: chem.id,
              date: dateStr,
              confirmed: false,
              notes: 'Auto-scheduled from Tour Plan'
            });
            existingChemistVisitsSet.add(lookupKey);
          }
        });
      }

      // 3. Stockists
      if (type === 'stockist' || type === 'all') {
        const dayStockists = stockists.filter(st => uniqueDayAreaIds.includes(st.area_id));
        dayStockists.forEach(st => {
          const lookupKey = `${dateStr}_${st.id}`;
          if (!existingStockistVisitsSet.has(lookupKey)) {
            stockistVisitsToCreate.push({
              user_id: userId,
              stockist_id: st.id,
              date: dateStr,
              confirmed: false,
              notes: 'Auto-scheduled from Tour Plan'
            });
            existingStockistVisitsSet.add(lookupKey);
          }
        });
      }
    });

    // Bulk create
    if (doctorVisitsToCreate.length > 0) {
      console.log(`🚀 Auto-scheduling ${doctorVisitsToCreate.length} doctor visits for user ${userId}`);
      await DoctorVisit.bulkCreate(doctorVisitsToCreate);
    }
    if (chemistVisitsToCreate.length > 0) {
      console.log(`🚀 Auto-scheduling ${chemistVisitsToCreate.length} chemist visits for user ${userId}`);
      await ChemistVisit.bulkCreate(chemistVisitsToCreate);
    }
    if (stockistVisitsToCreate.length > 0) {
      console.log(`🚀 Auto-scheduling ${stockistVisitsToCreate.length} stockist visits for user ${userId}`);
      await StockistVisit.bulkCreate(stockistVisitsToCreate);
    }

  } catch (error) {
    console.error('❌ Error in autoScheduleVisits:', error);
  }
}

/**
 * Auto-schedules all visits for an entire tour plan once it's approved.
 * @param {Object} sequelize - Sequelize instance
 * @param {Object} models - Sequelize models object
 * @param {Object} tourPlan - TourPlan instance
 */
async function autoScheduleForApprovedPlan(sequelize, models, tourPlan) {
  try {
    const { TourPlanDay } = models;
    
    // Find all days for this plan
    const planDays = await TourPlanDay.findAll({
      where: {
        tour_plan_id: tourPlan.id
      }
    });

    if (planDays.length === 0) return;

    // Get date range (min date and max date)
    const dates = planDays.map(pd => pd.date).sort();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    await autoScheduleVisits(sequelize, models, tourPlan.user_id, startDate, endDate, 'all');
  } catch (error) {
    console.error('❌ Error auto-scheduling for approved plan:', error);
  }
}

module.exports = {
  autoScheduleVisits,
  autoScheduleForApprovedPlan
};
