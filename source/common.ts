import https = require('https');
import crypto = require('crypto');
import AWS = require('aws-sdk');

function httpsRequest(requestParams: any, logsData?: any, logFileKey?: any) {
    return new Promise((resolve, reject) => {
        var request = https.request(requestParams, (res: any) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error('statusCode=' + res.statusCode));
            }
            var responseBody = '';
            res.on('data', function (chunk: any) {
                responseBody += chunk;
            });
            res.on('end', async function () {
                try {
                    var info = JSON.parse(responseBody);
                    var failedItems: any;
                    var success: any;
                    var error: any;
                    var failedLogs = {
                        Records: [] as any
                    };
                    for (var i = 0; i < info.items.length; i++) {
                        if (info.items[i].index.status >= 300) {
                            if(process.env.LOG_TYPE == 'CloudTrail'){
                                failedLogs.Records.push(logsData.Records[i])
                            }else if(process.env.LOG_TYPE == 'S3Access'){
                                const dataArray = logsData.split("\n");
                                failedLogs.Records.push(dataArray[i])
                            }
                        }
                    }

                    if (res.statusCode! >= 200 && res.statusCode! < 299) {
                        failedItems = info.items.filter(function (x: { index: { status: number; }; }) {
                            return x.index.status >= 300;
                        });

                        success = {
                            "attemptedItems": info.items.length,
                            "successfulItems": info.items.length - failedItems.length,
                            "failedItems": failedItems.length
                        };
                        console.log(success);
                    }

                    if (res.statusCode !== 200 || info.errors === true) {
                        // prevents logging of failed entries, but allows logging
                        // of other errors such as access restrictions
                        delete info.items;
                        error = {
                            statusCode: res.statusCode,
                            failedItems: failedItems,
                            responseBody: info
                        };
                    }
                    if (failedItems.length > 0) {
                        logFailure(error, failedItems);
                        var failedLogsContent = JSON.stringify(failedLogs); 
                        var endIndex = logFileKey.length - 8;
                        const failedLogsKey = process.env.DOMAIN_NAME + '/' + process.env.LOG_TYPE + '/' 
                        + logFileKey.substr(0, endIndex) + '_' + failedItems.length.toString() + '_failed.json';
                        await putObjectToS3(failedLogsContent, process.env.FAILED_LOG_BUCKET_NAME, failedLogsKey)
                    }
                } catch (e) {
                    reject(e);
                }
                resolve(responseBody);
            });
        });

        request.on('error', (e) => {
            reject(e.message);
        });

        request.end(requestParams.body);
    });
}


function buildRequest(endpoint: any, body: any, _region: string) {

    if (_region == 'cn-north-1' || _region == 'cn-northwest-1') {
        var endpointParts = endpoint.match(/^([^\.]+)\.?([^\.]*)\.?([^\.]*)\.amazonaws\.com.cn$/);
    } else {
        var endpointParts = endpoint.match(/^([^\.]+)\.?([^\.]*)\.?([^\.]*)\.amazonaws\.com$/);
    }
    var region = endpointParts[2];
    var service = endpointParts[3];
    var datetime = (new Date()).toISOString().replace(/[:\-]|\.\d{3}/g, '');
    var date = datetime.substr(0, 8);
    var kDate = hmac('AWS4' + process.env.AWS_SECRET_ACCESS_KEY, date);
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


/**
 * This function used to write file to S3 bucket
 * @param data 
 * @param bucket 
 * @param key 
 */
 function putObjectToS3(data: any, bucket: any, key: any) {
    return new Promise<void>(async (resolve) => {
        var s3 = new AWS.S3();
        var params = {
            Bucket: bucket,
            Key: key,
            Body: data
        }
        await s3.putObject(params, function (err) {
            if (err) console.log(err, err.stack); 
            else console.log("Put failed injection logs to s3 Bucket:" + bucket + ":" + key);      
        }).promise();
        resolve();
    });
}

function hmac(key: any, str: any, encoding: any = null) {
    return crypto.createHmac('sha256', key).update(str, 'utf8').digest(encoding);
}

function hash(str: any, encoding: any) {
    return crypto.createHash('sha256').update(str, 'utf8').digest(encoding);
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

function logFailure(error: any, failedItems: any) {
    console.log('Error::::---------- ' + JSON.stringify(error, null, 2));

    if (failedItems && failedItems.length > 0) {
        console.log("Failed Items: " +
            JSON.stringify(failedItems, null, 2));
    }
}

export { httpsRequest, buildSource, buildRequest, logFailure }