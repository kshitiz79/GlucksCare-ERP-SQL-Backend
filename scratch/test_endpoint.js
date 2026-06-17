const { sequelize, Area, HeadOffice } = require('../src/config/database');
const { getAreasByHeadOffice } = require('../src/area/areaControllers');

async function test() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Find the existing area to get its head office ID
    const existingArea = await Area.findOne();
    if (!existingArea) {
      console.log('No areas found in database to perform test.');
      return;
    }
    const headOfficeId = existingArea.head_office_id;

    console.log(`Found existing head office ID to test: ${headOfficeId}`);

    const mockApp = {
      get: (key) => {
        if (key === 'models') {
          return { Area, HeadOffice };
        }
      }
    };

    let statusCode = null;
    let responseData = null;

    const req = {
      app: mockApp,
      params: { headOfficeId }
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

    console.log('Testing getAreasByHeadOffice...');
    await getAreasByHeadOffice(req, res);

    console.log('Response Status:', statusCode || 200);
    console.log('Response Data:', JSON.stringify(responseData, null, 2));

    if (responseData && responseData.success === true && responseData.count > 0 && responseData.data[0].id === existingArea.id) {
      console.log('✅ Endpoint test passed for valid head office!');
    } else {
      console.error('❌ Endpoint test failed for valid head office!');
    }

    // Test with non-existent head office
    const dummyId = '00000000-0000-0000-0000-000000000000';
    req.params.headOfficeId = dummyId;
    responseData = null;
    statusCode = null;

    console.log('\nTesting getAreasByHeadOffice with non-existent head office ID...');
    await getAreasByHeadOffice(req, res);

    console.log('Response Status:', statusCode || 200);
    console.log('Response Data:', JSON.stringify(responseData, null, 2));

    if (responseData && responseData.success === true && responseData.count === 0 && responseData.data.length === 0) {
      console.log('✅ Endpoint test passed for non-existent head office!');
    } else {
      console.error('❌ Endpoint test failed for non-existent head office!');
    }

  } catch (error) {
    console.error('Test threw an error:', error);
  } finally {
    await sequelize.close();
  }
}

test();
