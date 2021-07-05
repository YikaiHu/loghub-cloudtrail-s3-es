

// v1.1.3
import zlib = require('zlib');
import AWS = require('aws-sdk');
import * as CloudTrailWorker from './CloudTrailWorker';
import * as S3AccessWorker from './S3AccessWorker';
import { post, logFailure } from './common'

const _region = process.env.AWS_REGION;
let _workType = 'S3ACCESS';

var endpoint = 'vpc-loghub-poaml2l2lbh6ssqbzadioh4gri.us-east-1.es.amazonaws.com';

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
            console.log("Get CloudTrail Log sending job.");
            await sendCloudtrail(params, context);
            break;
        }
        case 'S3ACCESS': {
            console.log("Get S3 Access Log sending job.");
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
    await S3.getObject(params, async function (err, data) {
        if (err !== null) {
            console.error(err);
        }
        console.log("S3 Access body: ", data.Body!.toString('ascii'));
        const s3AccessData = data.Body!.toString('ascii');

        var elasticsearchBulkData = S3AccessWorker.transform(s3AccessData);

        // post documents to the Amazon Elasticsearch Service
        post(endpoint, elasticsearchBulkData, _region!, function (error: any, success: any, statusCode: any, failedItems: any) {
            console.log('Response: ' + JSON.stringify({
                "statusCode": statusCode
            }));

            if (error) {
                console.log('post failedItems: ', JSON.stringify(failedItems));
                logFailure(error, failedItems);
                context.fail(JSON.stringify(error));
            } else {
                console.log('Success: ' + JSON.stringify(success));
                context.succeed('Success');
            }
        });
        context.succeed('Success');
    }).promise();
}

/**
 * Worker for sending Amazon CloudTrail logs which stored in S3 to Amazon ES
 * @param params 
 * @param context 
 */
async function sendCloudtrail(params: any, context: any) {
    if (params.Key.indexOf("CloudTrail/") != -1) {
        const S3 = new AWS.S3({ region: _region, apiVersion: '2006-03-01' });
        await S3.getObject(params, async function (err, data) {
            if (err !== null) {
                console.error(err);
            }

            var zippedInput = Buffer.from(data.Body as string, 'base64');

            // decompress the input
            zlib.gunzip(zippedInput, function (error, buffer) {
                if (error) { console.log('gzip err:', error); return; }
                // parse the input from JSON
                var awslogsData = JSON.parse(buffer.toString('utf8'));

                var elasticsearchBulkData = CloudTrailWorker.transform(awslogsData);

                // post documents to the Amazon Elasticsearch Service
                post(endpoint, elasticsearchBulkData, _region!, function (error: any, success: any, statusCode: any, failedItems: any) {
                    console.log('Response: ' + JSON.stringify({
                        "statusCode": statusCode
                    }));

                    if (error) {
                        console.log('post failedItems: ', JSON.stringify(failedItems));
                        logFailure(error, failedItems);
                        context.fail(JSON.stringify(error));
                    } else {
                        console.log('Success: ' + JSON.stringify(success));
                        context.succeed('Success');
                    }
                });
            });
        }).promise();
    } else {
        console.log('Skip: The S3 object\'s key does not match CloudTrail/ formate, the key is: ', params.Key);
        context.succeed('Success');
    }
}

export { handler }