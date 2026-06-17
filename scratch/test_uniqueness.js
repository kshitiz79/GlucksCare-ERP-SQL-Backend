const { sequelize, Area, HeadOffice } = require('../src/config/database');
const { createArea } = require('../src/area/areaControllers');

async function test() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // 1. Get a valid head office ID
    const ho = await HeadOffice.findOne();
    if (!ho) {
      console.error('No HeadOffice found to perform test.');
      return;
    }
    const headOfficeId = ho.id;

    // 2. Mock req and res objects
    const mockApp = {
      get: (key) => {
        if (key === 'models') {
          return { Area, HeadOffice };
        }
      }
    };

    // We know '201016' is already in the database from inspect_areas.js
    const pincode = '201016'; 

    let statusCode = null;
    let responseData = null;

    const req = {
      app: mockApp,
      body: {
        name: 'Test Duplicate Area',
        pincode,
        post_office: 'Test Post Office',
        head_office_id: headOfficeId
      }
    };

    const res = {
      status: function(code) {
        statusCode = code;
        return this;
      },
      json: function(data) {
        responseData = data;
        return this;
      }
    };

    console.log('Testing createArea with duplicate pincode:', pincode);
    await createArea(req, res);

    console.log('Response Status Code:', statusCode || 200);
    console.log('Response Data:', responseData);

    if (statusCode === 400 && responseData && responseData.success === false && responseData.message === 'An area with this pincode already exists') {
      console.log('✅ Uniqueness check test passed!');
    } else {
      console.error('❌ Uniqueness check test failed!');
    }

  } catch (error) {
    console.error('Test threw an error:', error);
  } finally {
    await sequelize.close();
  }
}

test();
