const getTerritoryMaster = async (req, res) => {
  try {
    const { Area, Doctor, Chemist, Stockist, Beat, BeatArea, User } = req.app.get('models');

    // 1. Fetch all datasets
    const areas = await Area.findAll({
      order: [['name', 'ASC']]
    });

    const doctors = await Doctor.findAll({
      order: [['name', 'ASC']]
    });

    const chemists = await Chemist.findAll({
      order: [['firm_name', 'ASC']]
    });

    const stockists = await Stockist.findAll({
      order: [['firm_name', 'ASC']]
    });

    const beats = await Beat.findAll({
      include: [
        {
          model: Area,
          as: 'areas',
          attributes: ['id'],
          through: { attributes: [] }
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'head_office_id']
        }
      ],
      order: [['name', 'ASC']]
    });

    const beatAreas = await BeatArea.findAll();

    // 2. Count maps for Areas
    const doctorCountByArea = {};
    doctors.forEach(d => {
      if (d.areaId) {
        doctorCountByArea[d.areaId] = (doctorCountByArea[d.areaId] || 0) + 1;
      }
    });

    const chemistCountByArea = {};
    chemists.forEach(c => {
      if (c.area_id) {
        chemistCountByArea[c.area_id] = (chemistCountByArea[c.area_id] || 0) + 1;
      }
    });

    const stockistCountByArea = {};
    stockists.forEach(s => {
      if (s.area_id) {
        stockistCountByArea[s.area_id] = (stockistCountByArea[s.area_id] || 0) + 1;
      }
    });

    // Map of area ID to unique beat colors
    const colorsByArea = {};
    beats.forEach(beat => {
      const beatColor = beat.color || "#4F46E5";
      const assignedAreaIds = beat.areas ? beat.areas.map(a => a.id) : [];
      assignedAreaIds.forEach(areaId => {
        if (!colorsByArea[areaId]) {
          colorsByArea[areaId] = new Set();
        }
        colorsByArea[areaId].add(beatColor);
      });
    });

    // 3. Format Areas response
    const formattedAreas = areas.map(area => {
      const colorsSet = colorsByArea[area.id] || new Set();
      return {
        id: area.id,
        headquarterId: area.head_office_id,
        postOffice: area.post_office,
        pincode: area.pincode,
        latitude: parseFloat(area.latitude) || 0,
        longitude: parseFloat(area.longitude) || 0,
        radius: area.radius || 700,
        doctorCount: doctorCountByArea[area.id] || 0,
        chemistCount: chemistCountByArea[area.id] || 0,
        stockistCount: stockistCountByArea[area.id] || 0,
        visible: area.is_active !== false,
        colors: Array.from(colorsSet)
      };
    });

    // 4. Format Doctors response
    const formattedDoctors = doctors.map(doctor => {
      return {
        id: doctor.id,
        doctorCode: doctor.registration_number || "",
        doctorName: doctor.name,
        areaId: doctor.areaId || "",
        headquarterId: doctor.headOfficeId || "",
        clinicName: doctor.clinic_name || "",
        speciality: doctor.specialization || "",
        category: doctor.priority || "C",
        latitude: parseFloat(doctor.latitude) || 0,
        longitude: parseFloat(doctor.longitude) || 0,
        visitStatus: "Pending", // placeholder
        active: true
      };
    });

    // 5. Format Chemists response
    const formattedChemists = chemists.map(chemist => {
      return {
        id: chemist.id,
        chemistCode: chemist.drug_license_number || "",
        chemistName: chemist.contact_person_name || "",
        areaId: chemist.area_id || "",
        headquarterId: chemist.head_office_id || "",
        shopName: chemist.firm_name,
        category: "General",
        latitude: parseFloat(chemist.latitude) || 0,
        longitude: parseFloat(chemist.longitude) || 0,
        active: true
      };
    });

    // 6. Format Stockists response
    const formattedStockists = stockists.map(stockist => {
      return {
        id: stockist.id,
        stockistCode: stockist.drug_license_number || "",
        stockistName: stockist.contact_person || "",
        areaId: stockist.area_id || "",
        headquarterId: stockist.head_office_id || "",
        firmName: stockist.firm_name,
        category: "General",
        latitude: parseFloat(stockist.latitude) || 0,
        longitude: parseFloat(stockist.longitude) || 0,
        active: true
      };
    });

    // 7. Format Beats response
    const formattedBeats = beats.map(beat => {
      const assignedAreaIds = beat.areas ? beat.areas.map(a => a.id) : [];
      
      let beatDoctorCount = 0;
      let beatChemistCount = 0;
      let beatStockistCount = 0;

      assignedAreaIds.forEach(areaId => {
        beatDoctorCount += (doctorCountByArea[areaId] || 0);
        beatChemistCount += (chemistCountByArea[areaId] || 0);
        beatStockistCount += (stockistCountByArea[areaId] || 0);
      });

      return {
        id: beat.id,
        headquarterId: beat.creator?.head_office_id || (beat.areas?.[0]?.head_office_id) || "",
        beatName: beat.name,
        color: beat.color || "#4F46E5",
        doctorCount: beatDoctorCount,
        chemistCount: beatChemistCount,
        stockistCount: beatStockistCount,
        areaCount: assignedAreaIds.length,
        createdAt: beat.created_at || beat.createdAt,
        createdBy: beat.creator?.name || "System",
        active: beat.is_active !== false
      };
    });

    // 8. Format BeatAreas junction response (grouped by beatId, return areaIds in a list)
    const beatAreasMap = {};
    beatAreas.forEach(ba => {
      if (ba.beat_id) {
        if (!beatAreasMap[ba.beat_id]) {
          beatAreasMap[ba.beat_id] = [];
        }
        if (ba.area_id && !beatAreasMap[ba.beat_id].includes(ba.area_id)) {
          beatAreasMap[ba.beat_id].push(ba.area_id);
        }
      }
    });

    const formattedBeatAreas = Object.keys(beatAreasMap).map(beatId => {
      return {
        beatId: beatId,
        areaId: beatAreasMap[beatId]
      };
    });

    res.json({
      success: true,
      areas: formattedAreas,
      doctors: formattedDoctors,
      chemists: formattedChemists,
      stockists: formattedStockists,
      beats: formattedBeats,
      beatAreas: formattedBeatAreas
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getTerritoryMaster
};
