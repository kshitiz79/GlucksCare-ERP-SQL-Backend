// GET all stockists
const getAllStockists = async (req, res) => {
  try {
    const { Stockist, HeadOffice, StockistAnnualTurnover } = req.app.get('models');
    
    const stockists = await Stockist.findAll({
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: StockistAnnualTurnover,
          as: 'AnnualTurnovers',
          attributes: ['year', 'amount']
        }
      ]
    });
    
    // Transform the response to match the MongoDB format
    const transformedStockists = stockists.map(stockist => {
      const stockistObj = stockist.toJSON();
      return {
        ...stockistObj,
        // Convert annual_turnover to the format expected by the frontend
        annual_turnover: stockistObj.AnnualTurnovers ? stockistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        headOffice: stockistObj.HeadOffice || stockistObj.headOffice,
        _id: stockistObj.id,
        createdAt: stockistObj.created_at,
        updatedAt: stockistObj.updated_at,
        // Remove the nested objects
        AnnualTurnovers: undefined,
        HeadOffice: undefined
      };
    });
    
    res.json({
      success: true,
      count: transformedStockists.length,
      data: transformedStockists
    });
  } catch (error) {
    console.error('Error in getAllStockists:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET stockist by ID
const getStockistById = async (req, res) => {
  try {
    const { Stockist, HeadOffice, StockistAnnualTurnover } = req.app.get('models');
    
    const stockist = await Stockist.findByPk(req.params.id, {
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: StockistAnnualTurnover,
          as: 'AnnualTurnovers',
          attributes: ['year', 'amount']
        }
      ]
    });
    
    if (!stockist) {
      return res.status(404).json({
        success: false,
        message: 'Stockist not found'
      });
    }
    
    // Transform the response to match the MongoDB format
    const stockistObj = stockist.toJSON();
    const transformedStockist = {
      ...stockistObj,
      // Convert annual_turnover to the format expected by the frontend
      annual_turnover: stockistObj.AnnualTurnovers ? stockistObj.AnnualTurnovers.map(turnover => ({
        year: turnover.year,
        amount: parseFloat(turnover.amount)
      })) : [],
      headOffice: stockistObj.HeadOffice || stockistObj.headOffice,
      _id: stockistObj.id,
      createdAt: stockistObj.created_at,
      updatedAt: stockistObj.updated_at,
      // Remove the nested objects
      AnnualTurnovers: undefined,
      HeadOffice: undefined
    };
    
    res.json({
      success: true,
      data: transformedStockist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new stockist
const createStockist = async (req, res) => {
  try {
    const models = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    if (!models || !models.Stockist || !models.HeadOffice || !models.StockistAnnualTurnover || !sequelize) {
      throw new Error('Required models or Sequelize instance are not available');
    }
    const { Stockist, HeadOffice, StockistAnnualTurnover } = models;
    
    // Log the incoming request body for debugging
    console.log('Incoming stockist data:', JSON.stringify(req.body, null, 2));
    
    // Process the incoming data
    const stockistData = { ...req.body };
    
    // Handle head office ID field conversion
    // The frontend might send headOfficeId, head_office_id, or headOffice
    if (stockistData.headOfficeId) {
      // Keep as is for Sequelize model - this is the correct field name
      console.log('Using headOfficeId as is:', stockistData.headOfficeId);
    } else if (stockistData.head_office_id) {
      // Convert database column name to model field name
      stockistData.headOfficeId = stockistData.head_office_id;
      delete stockistData.head_office_id;
      console.log('Converted head_office_id to headOfficeId:', stockistData.headOfficeId);
    } else if (stockistData.headOffice) {
      // Convert alternative field name to model field name
      stockistData.headOfficeId = stockistData.headOffice;
      delete stockistData.headOffice;
      console.log('Converted headOffice to headOfficeId:', stockistData.headOfficeId);
    }
    
    // Handle field name conversions from camelCase to snake_case
    const fieldMappings = {
      firmName: 'firm_name',
      registeredBusinessName: 'registered_business_name',
      natureOfBusiness: 'nature_of_business',
      gstNumber: 'gst_number',
      drugLicenseNumber: 'drug_license_number',
      panNumber: 'pan_number',
      registeredOfficeAddress: 'registered_office_address',
      contactPerson: 'contact_person',
      mobileNumber: 'mobile_number',
      emailAddress: 'email_address',
      yearsInBusiness: 'years_in_business',
      areasOfOperation: 'areas_of_operation',
      currentPharmaDistributorships: 'current_pharma_distributorships',
      warehouseFacility: 'warehouse_facility',
      storageFacilitySize: 'storage_facility_size',
      coldStorageAvailable: 'cold_storage_available',
      numberOfSalesRepresentatives: 'number_of_sales_representatives',
      bankDetails: 'bank_details',
      headOfficeId: 'head_office_id'
    };
    
    // Convert field names and collect data for the main stockist record
    const stockistRecordData = {};
    Object.keys(stockistData).forEach(key => {
      // Skip annualTurnover as it will be handled separately
      if (key === 'annualTurnover') return;
      
      const dbFieldName = fieldMappings[key] || key;
      stockistRecordData[dbFieldName] = stockistData[key];
    });
    
    // Validate that headOfficeId is provided
    if (!stockistRecordData.head_office_id) {
      return res.status(400).json({
        success: false,
        message: 'Head Office ID is required'
      });
    }
    
    // Validate that firmName is provided
    if (!stockistRecordData.firm_name) {
      return res.status(400).json({
        success: false,
        message: 'Firm Name is required'
      });
    }
    
    // Start a transaction
    const transaction = await sequelize.transaction();
    
    try {
      console.log('Creating stockist with data:', stockistRecordData);
      const stockist = await Stockist.create(stockistRecordData, { transaction });
      console.log('Stockist created successfully:', stockist.id);
      
      // Handle annual turnover data if provided
      if (stockistData.annualTurnover && Array.isArray(stockistData.annualTurnover) && stockistData.annualTurnover.length > 0) {
        // Create annual turnover records
        const annualTurnoverRecords = stockistData.annualTurnover.map(turnover => ({
          stockist_id: stockist.id,
          year: parseInt(turnover.year, 10),
          amount: parseFloat(turnover.amount)
        })).filter(turnover => !isNaN(turnover.year) && !isNaN(turnover.amount));
        
        if (annualTurnoverRecords.length > 0) {
          await StockistAnnualTurnover.bulkCreate(annualTurnoverRecords, { transaction });
        }
      }
      
      // Fetch the created stockist with associations
      const createdStockist = await Stockist.findByPk(stockist.id, {
        include: [
          {
            model: HeadOffice,
            as: 'HeadOffice',
            attributes: ['id', 'name']
          },
          {
            model: StockistAnnualTurnover,
            as: 'AnnualTurnovers',
            attributes: ['year', 'amount']
          }
        ],
        transaction
      });
      
      // Commit the transaction
      await transaction.commit();
      
      // Transform the response to match the MongoDB format
      const stockistObj = createdStockist.toJSON();
      const transformedStockist = {
        ...stockistObj,
        // Convert annual_turnover to the format expected by the frontend
        annual_turnover: stockistObj.AnnualTurnovers ? stockistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        annualTurnover: stockistObj.AnnualTurnovers ? stockistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        headOffice: stockistObj.HeadOffice || stockistObj.headOffice,
        _id: stockistObj.id,
        createdAt: stockistObj.created_at,
        updatedAt: stockistObj.updated_at,
        // Remove the nested objects
        AnnualTurnovers: undefined,
        HeadOffice: undefined
      };
      
      res.status(201).json({
        success: true,
        data: transformedStockist
      });
    } catch (error) {
      // Rollback the transaction in case of error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Create stockist error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a stockist
const updateStockist = async (req, res) => {
  try {
    const models = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    if (!models || !models.Stockist || !models.HeadOffice || !models.StockistAnnualTurnover || !sequelize) {
      throw new Error('Required models or Sequelize instance are not available');
    }
    const { Stockist, HeadOffice, StockistAnnualTurnover } = models;
    
    const stockist = await Stockist.findByPk(req.params.id);
    if (!stockist) {
      return res.status(404).json({
        success: false,
        message: 'Stockist not found'
      });
    }
    
    // Start a transaction
    const transaction = await sequelize.transaction();
    
    try {
      // Map headOffice to head_office_id if needed
      const stockistData = { ...req.body };
      if (stockistData.headOffice && !stockistData.head_office_id) {
        stockistData.head_office_id = stockistData.headOffice;
        delete stockistData.headOffice;
      }
      
      // Handle field name conversions from camelCase to snake_case
      const fieldMappings = {
        firmName: 'firm_name',
        registeredBusinessName: 'registered_business_name',
        natureOfBusiness: 'nature_of_business',
        gstNumber: 'gst_number',
        drugLicenseNumber: 'drug_license_number',
        panNumber: 'pan_number',
        registeredOfficeAddress: 'registered_office_address',
        contactPerson: 'contact_person',
        mobileNumber: 'mobile_number',
        emailAddress: 'email_address',
        yearsInBusiness: 'years_in_business',
        areasOfOperation: 'areas_of_operation',
        currentPharmaDistributorships: 'current_pharma_distributorships',
        warehouseFacility: 'warehouse_facility',
        storageFacilitySize: 'storage_facility_size',
        coldStorageAvailable: 'cold_storage_available',
        numberOfSalesRepresentatives: 'number_of_sales_representatives',
        bankDetails: 'bank_details',
        headOfficeId: 'head_office_id'
      };
      
      // Convert field names and collect data for the main stockist record
      const stockistUpdateData = {};
      Object.keys(stockistData).forEach(key => {
        // Skip annualTurnover as it will be handled separately
        if (key === 'annualTurnover') return;
        
        const dbFieldName = fieldMappings[key] || key;
        stockistUpdateData[dbFieldName] = stockistData[key];
      });
      
      await stockist.update(stockistUpdateData, { transaction });
      
      // Handle annual turnover data if provided
      if ('annualTurnover' in stockistData) {
        // Delete existing annual turnover records
        await StockistAnnualTurnover.destroy({
          where: { stockist_id: stockist.id },
          transaction
        });
        
        // Create new annual turnover records if provided
        if (stockistData.annualTurnover && Array.isArray(stockistData.annualTurnover) && stockistData.annualTurnover.length > 0) {
          const annualTurnoverRecords = stockistData.annualTurnover.map(turnover => ({
            stockist_id: stockist.id,
            year: parseInt(turnover.year, 10),
            amount: parseFloat(turnover.amount)
          })).filter(turnover => !isNaN(turnover.year) && !isNaN(turnover.amount));
          
          if (annualTurnoverRecords.length > 0) {
            await StockistAnnualTurnover.bulkCreate(annualTurnoverRecords, { transaction });
          }
        }
      }
      
      // Fetch the updated stockist with associations
      const updatedStockist = await Stockist.findByPk(stockist.id, {
        include: [
          {
            model: HeadOffice,
            as: 'HeadOffice',
            attributes: ['id', 'name']
          },
          {
            model: StockistAnnualTurnover,
            as: 'AnnualTurnovers',
            attributes: ['year', 'amount']
          }
        ],
        transaction
      });
      
      // Commit the transaction
      await transaction.commit();
      
      // Transform the response to match the MongoDB format
      const stockistObj = updatedStockist.toJSON();
      const transformedStockist = {
        ...stockistObj,
        // Convert annual_turnover to the format expected by the frontend
        annual_turnover: stockistObj.AnnualTurnovers ? stockistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        annualTurnover: stockistObj.AnnualTurnovers ? stockistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        headOffice: stockistObj.HeadOffice || stockistObj.headOffice,
        _id: stockistObj.id,
        createdAt: stockistObj.created_at,
        updatedAt: stockistObj.updated_at,
        // Remove the nested objects
        AnnualTurnovers: undefined,
        HeadOffice: undefined
      };
      
      res.json({
        success: true,
        data: transformedStockist
      });
    } catch (error) {
      // Rollback the transaction in case of error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Update stockist error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a stockist
const deleteStockist = async (req, res) => {
  try {
    const { Stockist } = req.app.get('models');
    const stockist = await Stockist.findByPk(req.params.id);
    if (!stockist) {
      return res.status(404).json({
        success: false,
        message: 'Stockist not found'
      });
    }
    
    await stockist.destroy();
    res.json({
      success: true,
      message: 'Stockist deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET stockists by head office ID
const getStockistsByHeadOffice = async (req, res) => {
  try {
    const { Stockist } = req.app.get('models');
    const { headOfficeId } = req.params;
    const stockists = await Stockist.findAll({
      where: {
        head_office_id: headOfficeId
      }
    });
    res.json(stockists);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET stockists for current user's head offices
const getMyStockists = async (req, res) => {
  try {
    const { Stockist, HeadOffice, User } = req.app.get('models');
    
    // Get the current user with their head offices
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: HeadOffice,
          as: 'headOffices',
          through: { attributes: [] } // Don't include junction table attributes
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all user's head office IDs
    let headOfficeIds = [];
    
    if (user.headOffices && user.headOffices.length > 0) {
      headOfficeIds = user.headOffices.map(office => office.id);
    } else if (user.head_office_id) {
      headOfficeIds = [user.head_office_id];
    }

    if (headOfficeIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No head office assigned to your account. Please contact an administrator.'
      });
    }

    // Find all stockists assigned to user's head offices
    const stockists = await Stockist.findAll({
      where: {
        head_office_id: { [require('sequelize').Op.in]: headOfficeIds }
      },
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        }
      ]
    });
    
    // Transform the response to match the MongoDB format
    const transformedStockists = stockists.map(stockist => {
      const stockistObj = stockist.toJSON();
      return {
        ...stockistObj,
        headOffice: stockistObj.HeadOffice || stockistObj.headOffice,
        _id: stockistObj.id,
        createdAt: stockistObj.created_at,
        updatedAt: stockistObj.updated_at,
        // Remove the nested objects
        HeadOffice: undefined
      };
    });
    
    res.json({
      success: true,
      count: transformedStockists.length,
      data: transformedStockists
    });
  } catch (error) {
    console.error('Get my stockists error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = {
  getAllStockists,
  getStockistById,
  createStockist,
  updateStockist,
  deleteStockist,
  getStockistsByHeadOffice,
  getMyStockists
};