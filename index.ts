

// v1.1.3
import zlib = require('zlib');

import AWS = require('aws-sdk');
import * as CloudTrailWorker from './CloudTrailWorker';
import * as S3AccessWorker from './S3AccessWorker';
import { httpsRequest, buildRequest } from './common'

const _region = process.env.AWS_REGION;
const _workType = process.env.LOG_TYPE;
const endpoint = process.env.ES_ENDPOINT;

const handler = async function (event: any, context: any) {
    // Get the object from the event and show its content type
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    const params = {
        Bucket: bucket,
        Key: key,
    };
    switch (_workType) {
        case 'CLOUDTRAIL': {
            await sendCloudtrail(params, context);
            break;
        }
        case 'S3ACCESS': {
            await sendS3Access(params, context);
            break;
        }
        default:
            throw new Error('Unknown work type, unable to resolve ' + _workType);
    }
};

/**
 * Worker for sending Amazon S3 Access logs to Amazon ES
 * @param params 
 * @param context 
 */
async function sendS3Access(params: any, context: any) {
    const S3 = new AWS.S3({ region: _region, apiVersion: '2006-03-01' });

    const data = await S3.getObject(params).promise();
    const s3AccessData = data.Body!.toString('ascii');

    var elasticsearchBulkData = await S3AccessWorker.transform(s3AccessData);

    var requestParams = await buildRequest(endpoint, elasticsearchBulkData, _region!);

    try {
        await httpsRequest(requestParams, s3AccessData, params.Key );
        context.succeed('Success');
    } catch (err) {
        console.error('POST request failed, error:', err);
        console.log('Failed transfer the log file: ', params);
        context.fail(JSON.stringify(err));
    }
    context.succeed('Success');
}

/**
 * Worker for sending Amazon CloudTrail logs which stored in S3 to Amazon ES
 * @param params 
 * @param context 
 */
async function sendCloudtrail(params: any, context: any) {
    if (params.Key.indexOf("CloudTrail/") != -1) {
        const S3 = new AWS.S3({ region: _region, apiVersion: '2006-03-01' });
        const data = await S3.getObject(params).promise();

        var zippedInput = await Buffer.from(data.Body as string, 'base64');

        const awslogsData = JSON.parse(await zlib.gunzipSync(zippedInput).toString('utf8'));

        var elasticsearchBulkData = await CloudTrailWorker.transform(awslogsData);

        var requestParams = await buildRequest(endpoint, elasticsearchBulkData, _region!);

        try {
            await httpsRequest(requestParams, awslogsData, params.Key);
            context.succeed('Success');
        } catch (err) {
            console.error('POST request failed, error:', err);
            console.log('Failed transfer the log file: ', params);
            context.fail(JSON.stringify(err));
        }
        context.succeed('Success');

    } else {
        console.log('Skip: The S3 object\'s key does not match CloudTrail/ formate, the key is: ', params.Key);
        context.succeed('Success');
    }
}

export { handler }