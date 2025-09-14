// config/b2Config.js
const { S3Client } = require('@aws-sdk/client-s3');

const endpoint = process.env.B2_S3_ENDPOINT;
const accessKey = process.env.B2_S3_ACCESS_KEY;
const secretKey = process.env.B2_S3_SECRET_KEY;
const region = process.env.B2_S3_REGION || 'us-east-005';

if (!endpoint) console.error('B2 config error: B2_S3_ENDPOINT not set');
if (!/^https?:\/\//i.test(endpoint)) console.warn('B2_S3_ENDPOINT should include protocol (https://)');

const s3Client = new S3Client({
  endpoint,
  region,
  credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  forcePathStyle: true,
});

module.exports = s3Client;
