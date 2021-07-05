import https = require('https');
import crypto = require('crypto');

function post(endpoint:string, body: any, _region: string, callback: any) {
    var requestParams = buildRequest(endpoint, body, _region);

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

export {post, buildSource, logFailure}