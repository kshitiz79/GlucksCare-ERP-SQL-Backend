const { sequelize, DoctorVisit, ChemistVisit, Doctor, Chemist, User, Product } = require('../src/config/database');

async function test() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Fetch one DoctorVisit with includes
    const doctorVisit = await DoctorVisit.findOne({
      include: [
        {
          model: Doctor,
          as: 'DoctorInfo',
          attributes: ['id', 'name', 'specialization', 'geo_image_url', 'areaId', 'headOfficeId'],
          required: false
        },
        {
          model: User,
          as: 'UserInfo',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: Product,
          as: 'ProductInfo',
          attributes: ['id', 'name'],
          required: false
        }
      ]
    });

    if (doctorVisit) {
      const visitObj = doctorVisit.toJSON();
      const transformed = {
        ...visitObj,
        doctor: visitObj.DoctorInfo ? {
          ...visitObj.DoctorInfo,
          geo_image_status: !!visitObj.DoctorInfo.geo_image_url,
          geo_image_url: undefined
        } : null,
        user: visitObj.UserInfo || null,
        product: visitObj.ProductInfo || null,
        DoctorInfo: undefined,
        UserInfo: undefined,
        ProductInfo: undefined
      };
      console.log('Transformed Doctor Visit Keys:', Object.keys(transformed));
      console.log('Transformed Doctor Visit:', JSON.stringify(transformed, null, 2));
    } else {
      console.log('No DoctorVisit found');
    }

    // Fetch one ChemistVisit with includes
    const chemistVisit = await ChemistVisit.findOne({
      include: [{
        model: Chemist,
        as: 'Chemist'
      }]
    });

    if (chemistVisit) {
      const visitObj = chemistVisit.toJSON();
      const transformed = {
        ...visitObj,
        Chemist: visitObj.Chemist ? {
          ...visitObj.Chemist,
          geo_image_status: !!visitObj.Chemist.geo_image_url,
          geo_image_url: undefined
        } : null
      };
      console.log('Transformed Chemist Visit Keys:', Object.keys(transformed));
      console.log('Transformed Chemist Visit:', JSON.stringify(transformed, null, 2));
    } else {
      console.log('No ChemistVisit found');
    }

  } catch (error) {
    console.error('Test threw an error:', error);
  } finally {
    await sequelize.close();
  }
}

test();
