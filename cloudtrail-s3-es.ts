

// v1.1.2
import https = require('https');
import zlib = require('zlib');
import crypto = require('crypto');
import AWS = require('aws-sdk');

var endpoint = 'vpc-loghub-poaml2l2lbh6ssqbzadioh4gri.us-east-1.es.amazonaws.com';

// Set this to true if you want to debug why data isn't making it to
// your Elasticsearch cluster. This will enable logging of failed items
// to CloudWatch Logs.
var logFailedResponses = true;

const handler = async function (event:any, context:any) {
    const S3 = new AWS.S3({ region: process.env.AWS_REGION, apiVersion: '2006-03-01' });
    // Get the object from the event and show its content type
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    const params = {
        Bucket: bucket,
        Key: key,
    }; 

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
            // console.log('gzip log: ', awslogsData);

            var elasticsearchBulkData = transform(awslogsData);
            // console.log('bulkdata:' + JSON.stringify(elasticsearchBulkData));

            // post documents to the Amazon Elasticsearch Service
            post(elasticsearchBulkData, function (error: any, success: any, statusCode: any, failedItems: any) {
                console.log('Response: ' + JSON.stringify({
                    "statusCode": statusCode
                }));
                console.log('error', JSON.stringify(error))

                console.log('failedItems', JSON.stringify(failedItems));

                if (error) {
                    logFailure(error, failedItems);
                    context.fail(JSON.stringify(error));
                } else {
                    console.log('Success: ' + JSON.stringify(success));
                    context.succeed('Success');
                }
            });
        });
    }).promise();
};

function transform(payload: any) {
    if (payload === null) {
        return null;
    }

    var bulkRequestBody = '';

    payload.Records.forEach(function (Record: any) {
        // index name format: cwl-YYYY.MM.DD
        var indexName = [
            'cloudtrail-' + Record.eventTime.substring(0, 4),    // year
            Record.eventTime.substring(5, 7),                    // month
            Record.eventTime.substring(8, 10)                    // day
        ].join('.');

        var source = buildSource(Record);

        source['@timestamp'] = Record.eventTime;
        source['@message'] = JSON.stringify(Record);
        source['@owner'] = payload.owner;

        //Using ElasticSearch created _id.
        var action = {
            "index": {
                "_index": "",
                "_type": "",
            }
        };
        action.index._index = indexName;
        action.index._type = "cloudtrail-s3";

        bulkRequestBody += [
            JSON.stringify(action),
            JSON.stringify(source),
        ].join('\n') + '\n';
    });
    return bulkRequestBody;
}

function buildSource(message: any) {
    var jsonSubString = extractJson(message);
    if (jsonSubString !== null) {
        return JSON.parse(jsonSubString);
    }

    return {};
}

function extractJson(message: any) {
    message = JSON.stringify(message);
    try {
        var jsonStart = message.indexOf('{');
    } catch (e) {
        console.log('extractJson error:', e);
        return null;
    }

    if (jsonStart < 0) return null;
    var jsonSubString = message.substring(jsonStart);
    return isValidJson(jsonSubString) ? jsonSubString : null;
}

function isValidJson(message: any) {
    try {
        JSON.parse(message);
    } catch (e) { return false; }
    return true;
}

function post(body: any, callback: any) {
    var requestParams = buildRequest(endpoint, body);

    var request = https.request(requestParams, function (response) {
        var responseBody = '';
        response.on('data', function (chunk) {
            responseBody += chunk;
        });

        response.on('end', function () {
            var info = JSON.parse(responseBody);
            var failedItems: any;
            var success: any;
            var error: any;

            if (response.statusCode! >= 200 && response.statusCode! < 299) {
                failedItems = info.items.filter(function (x: { index: { status: number; }; }) {
                    return x.index.status >= 300;
                });

                success = {
                    "attemptedItems": info.items.length,
                    "successfulItems": info.items.length - failedItems.length,
                    "failedItems": failedItems.length
                };
            }

            if (response.statusCode !== 200 || info.errors === true) {
                // prevents logging of failed entries, but allows logging
                // of other errors such as access restrictions
                delete info.items;
                error = {
                    statusCode: response.statusCode,
                    responseBody: info
                };
            }

            callback(error, success, response.statusCode, failedItems);
        });
    }).on('error', function (e) {
        callback(e);
    });
    request.end(requestParams.body);
}

function buildRequest(endpoint: any, body: any) {
    var endpointParts = endpoint.match(/^([^\.]+)\.?([^\.]*)\.?([^\.]*)\.amazonaws\.com$/);
    var region = endpointParts[2];
    var service = endpointParts[3];
    var datetime = (new Date()).toISOString().replace(/[:\-]|\.\d{3}/g, '');
    var date = datetime.substr(0, 8);
    var kDate = hmac('AWS4' + process.env.AWS_SECRET_ACCESS_KEY, date);
    console.log('AWS_SECRET_ACCESS_KEY', process.env.AWS_SECRET_ACCESS_KEY);
    var kRegion = hmac(kDate, region);
    var kService = hmac(kRegion, service);
    var kSigning = hmac(kService, 'aws4_request');

    var request = {
        host: endpoint,
        method: 'POST',
        path: '/_bulk',
        body: body,
        headers: {
            'Content-Type': 'application/json',
            'Host': endpoint,
            'Content-Length': Buffer.byteLength(body),
            'X-Amz-Security-Token': process.env.AWS_SESSION_TOKEN,
            'X-Amz-Date': datetime
        }
    };

    interface IRequestHeader {
        [key: string]: any
    }

    interface IRequestHeaderAuthorization {
        [key: string]: any
    }

    var canonicalHeaders = Object.keys(request.headers)
        .sort(function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1; })
        .map(function (k) { return k.toLowerCase() + ':' + (<IRequestHeader>request.headers)[k]; })
        .join('\n');

    var signedHeaders = Object.keys(request.headers)
        .map(function (k) { return k.toLowerCase(); })
        .sort()
        .join(';');

    var canonicalString = [
        request.method,
        request.path, '',
        canonicalHeaders, '',
        signedHeaders,
        hash(request.body, 'hex'),
    ].join('\n');

    var credentialString = [date, region, service, 'aws4_request'].join('/');

    var stringToSign = [
        'AWS4-HMAC-SHA256',
        datetime,
        credentialString,
        hash(canonicalString, 'hex')
    ].join('\n');

    (<IRequestHeaderAuthorization>request.headers).Authorization = [
        'AWS4-HMAC-SHA256 Credential=' + process.env.AWS_ACCESS_KEY_ID + '/' + credentialString,
        'SignedHeaders=' + signedHeaders,
        'Signature=' + hmac(kSigning, stringToSign, 'hex')
    ].join(', ');

    return request;
}

function hmac(key: any, str: any, encoding: any = null) {
    return crypto.createHmac('sha256', key).update(str, 'utf8').digest(encoding);
}

function hash(str: any, encoding: any) {
    return crypto.createHash('sha256').update(str, 'utf8').digest(encoding);
}

function logFailure(error: any, failedItems: any) {
    if (logFailedResponses) {
        console.log('Error::::---------- ' + JSON.stringify(error, null, 2));

        if (failedItems && failedItems.length > 0) {
            console.log("Failed Items: " +
                JSON.stringify(failedItems, null, 2));
        }
    }
}

export { handler }