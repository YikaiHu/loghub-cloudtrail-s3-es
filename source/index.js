"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
// v1.1.3
const zlib = require("zlib");
const AWS = require("aws-sdk");
const CloudTrailWorker = require("./CloudTrailWorker");
const S3AccessWorker = require("./S3AccessWorker");
const common_1 = require("./common");
const _region = process.env.AWS_REGION;
const _workType = process.env.LOG_TYPE;
const endpoint = process.env.ES_ENDPOINT;
const handler = async function (event, context) {
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
exports.handler = handler;
/**
 * Worker for sending Amazon S3 Access logs to Amazon ES
 * @param params
 * @param context
 */
async function sendS3Access(params, context) {
    const S3 = new AWS.S3({ region: _region, apiVersion: '2006-03-01' });
    const data = await S3.getObject(params).promise();
    const s3AccessData = data.Body.toString('ascii');
    var elasticsearchBulkData = await S3AccessWorker.transform(s3AccessData);
    var requestParams = await common_1.buildRequest(endpoint, elasticsearchBulkData, _region);
    try {
        await common_1.httpsRequest(requestParams, s3AccessData, params.Key);
        context.succeed('Success');
    }
    catch (err) {
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
async function sendCloudtrail(params, context) {
    if (params.Key.indexOf("CloudTrail/") != -1) {
        const S3 = new AWS.S3({ region: _region, apiVersion: '2006-03-01' });
        const data = await S3.getObject(params).promise();
        var zippedInput = await Buffer.from(data.Body, 'base64');
        const awslogsData = JSON.parse(await zlib.gunzipSync(zippedInput).toString('utf8'));
        var elasticsearchBulkData = await CloudTrailWorker.transform(awslogsData);
        var requestParams = await common_1.buildRequest(endpoint, elasticsearchBulkData, _region);
        try {
            await common_1.httpsRequest(requestParams, awslogsData, params.Key);
            context.succeed('Success');
        }
        catch (err) {
            console.error('POST request failed, error:', err);
            console.log('Failed transfer the log file: ', params);
            context.fail(JSON.stringify(err));
        }
        context.succeed('Success');
    }
    else {
        console.log('Skip: The S3 object\'s key does not match CloudTrail/ formate, the key is: ', params.Key);
        context.succeed('Success');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQSxTQUFTO0FBQ1QsNkJBQThCO0FBRTlCLCtCQUFnQztBQUNoQyx1REFBdUQ7QUFDdkQsbURBQW1EO0FBQ25ELHFDQUFxRDtBQUVyRCxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQztBQUN2QyxNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQztBQUN2QyxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQztBQUV6QyxNQUFNLE9BQU8sR0FBRyxLQUFLLFdBQVcsS0FBVSxFQUFFLE9BQVk7SUFDcEQsMERBQTBEO0lBQzFELE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDL0MsTUFBTSxHQUFHLEdBQUcsa0JBQWtCLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDbkYsTUFBTSxNQUFNLEdBQUc7UUFDWCxNQUFNLEVBQUUsTUFBTTtRQUNkLEdBQUcsRUFBRSxHQUFHO0tBQ1gsQ0FBQztJQUNGLFFBQVEsU0FBUyxFQUFFO1FBQ2YsS0FBSyxZQUFZLENBQUMsQ0FBQztZQUNmLE1BQU0sY0FBYyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztZQUN0QyxNQUFNO1NBQ1Q7UUFDRCxLQUFLLFVBQVUsQ0FBQyxDQUFDO1lBQ2IsTUFBTSxZQUFZLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3BDLE1BQU07U0FDVDtRQUNEO1lBQ0ksTUFBTSxJQUFJLEtBQUssQ0FBQyx1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QUMsQ0FBQyxDQUFDO1NBQ3JDO1FBQ0QsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztLQUU5QjtTQUFNO1FBQ0gsT0FBTyxDQUFDLEdBQUcsQ0FBQyw2RUFBNkUsRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDdkcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztLQUM5QjtBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJcblxuLy8gdjEuMS4zXG5pbXBvcnQgemxpYiA9IHJlcXVpcmUoJ3psaWInKTtcblxuaW1wb3J0IEFXUyA9IHJlcXVpcmUoJ2F3cy1zZGsnKTtcbmltcG9ydCAqIGFzIENsb3VkVHJhaWxXb3JrZXIgZnJvbSAnLi9DbG91ZFRyYWlsV29ya2VyJztcbmltcG9ydCAqIGFzIFMzQWNjZXNzV29ya2VyIGZyb20gJy4vUzNBY2Nlc3NXb3JrZXInO1xuaW1wb3J0IHsgaHR0cHNSZXF1ZXN0LCBidWlsZFJlcXVlc3QgfSBmcm9tICcuL2NvbW1vbidcblxuY29uc3QgX3JlZ2lvbiA9IHByb2Nlc3MuZW52LkFXU19SRUdJT047XG5jb25zdCBfd29ya1R5cGUgPSBwcm9jZXNzLmVudi5MT0dfVFlQRTtcbmNvbnN0IGVuZHBvaW50ID0gcHJvY2Vzcy5lbnYuRVNfRU5EUE9JTlQ7XG5cbmNvbnN0IGhhbmRsZXIgPSBhc3luYyBmdW5jdGlvbiAoZXZlbnQ6IGFueSwgY29udGV4dDogYW55KSB7XG4gICAgLy8gR2V0IHRoZSBvYmplY3QgZnJvbSB0aGUgZXZlbnQgYW5kIHNob3cgaXRzIGNvbnRlbnQgdHlwZVxuICAgIGNvbnN0IGJ1Y2tldCA9IGV2ZW50LlJlY29yZHNbMF0uczMuYnVja2V0Lm5hbWU7XG4gICAgY29uc3Qga2V5ID0gZGVjb2RlVVJJQ29tcG9uZW50KGV2ZW50LlJlY29yZHNbMF0uczMub2JqZWN0LmtleS5yZXBsYWNlKC9cXCsvZywgJyAnKSk7XG4gICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICBCdWNrZXQ6IGJ1Y2tldCxcbiAgICAgICAgS2V5OiBrZXksXG4gICAgfTtcbiAgICBzd2l0Y2ggKF93b3JrVHlwZSkge1xuICAgICAgICBjYXNlICdDTE9VRFRSQUlMJzoge1xuICAgICAgICAgICAgYXdhaXQgc2VuZENsb3VkdHJhaWwocGFyYW1zLCBjb250ZXh0KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgJ1MzQUNDRVNTJzoge1xuICAgICAgICAgICAgYXdhaXQgc2VuZFMzQWNjZXNzKHBhcmFtcywgY29udGV4dCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIHdvcmsgdHlwZSwgdW5hYmxlIHRvIHJlc29sdmUgJyArIF93b3JrVHlwZSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBXb3JrZXIgZm9yIHNlbmRpbmcgQW1hem9uIFMzIEFjY2VzcyBsb2dzIHRvIEFtYXpvbiBFU1xuICogQHBhcmFtIHBhcmFtcyBcbiAqIEBwYXJhbSBjb250ZXh0IFxuICovXG5hc3luYyBmdW5jdGlvbiBzZW5kUzNBY2Nlc3MocGFyYW1zOiBhbnksIGNvbnRleHQ6IGFueSkge1xuICAgIGNvbnN0IFMzID0gbmV3IEFXUy5TMyh7IHJlZ2lvbjogX3JlZ2lvbiwgYXBpVmVyc2lvbjogJzIwMDYtMDMtMDEnIH0pO1xuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IFMzLmdldE9iamVjdChwYXJhbXMpLnByb21pc2UoKTtcbiAgICBjb25zdCBzM0FjY2Vzc0RhdGEgPSBkYXRhLkJvZHkhLnRvU3RyaW5nKCdhc2NpaScpO1xuXG4gICAgdmFyIGVsYXN0aWNzZWFyY2hCdWxrRGF0YSA9IGF3YWl0IFMzQWNjZXNzV29ya2VyLnRyYW5zZm9ybShzM0FjY2Vzc0RhdGEpO1xuXG4gICAgdmFyIHJlcXVlc3RQYXJhbXMgPSBhd2FpdCBidWlsZFJlcXVlc3QoZW5kcG9pbnQsIGVsYXN0aWNzZWFyY2hCdWxrRGF0YSwgX3JlZ2lvbiEpO1xuXG4gICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgaHR0cHNSZXF1ZXN0KHJlcXVlc3RQYXJhbXMsIHMzQWNjZXNzRGF0YSwgcGFyYW1zLktleSApO1xuICAgICAgICBjb250ZXh0LnN1Y2NlZWQoJ1N1Y2Nlc3MnKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignUE9TVCByZXF1ZXN0IGZhaWxlZCwgZXJyb3I6JywgZXJyKTtcbiAgICAgICAgY29uc29sZS5sb2coJ0ZhaWxlZCB0cmFuc2ZlciB0aGUgbG9nIGZpbGU6ICcsIHBhcmFtcyk7XG4gICAgICAgIGNvbnRleHQuZmFpbChKU09OLnN0cmluZ2lmeShlcnIpKTtcbiAgICB9XG4gICAgY29udGV4dC5zdWNjZWVkKCdTdWNjZXNzJyk7XG59XG5cbi8qKlxuICogV29ya2VyIGZvciBzZW5kaW5nIEFtYXpvbiBDbG91ZFRyYWlsIGxvZ3Mgd2hpY2ggc3RvcmVkIGluIFMzIHRvIEFtYXpvbiBFU1xuICogQHBhcmFtIHBhcmFtcyBcbiAqIEBwYXJhbSBjb250ZXh0IFxuICovXG5hc3luYyBmdW5jdGlvbiBzZW5kQ2xvdWR0cmFpbChwYXJhbXM6IGFueSwgY29udGV4dDogYW55KSB7XG4gICAgaWYgKHBhcmFtcy5LZXkuaW5kZXhPZihcIkNsb3VkVHJhaWwvXCIpICE9IC0xKSB7XG4gICAgICAgIGNvbnN0IFMzID0gbmV3IEFXUy5TMyh7IHJlZ2lvbjogX3JlZ2lvbiwgYXBpVmVyc2lvbjogJzIwMDYtMDMtMDEnIH0pO1xuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgUzMuZ2V0T2JqZWN0KHBhcmFtcykucHJvbWlzZSgpO1xuXG4gICAgICAgIHZhciB6aXBwZWRJbnB1dCA9IGF3YWl0IEJ1ZmZlci5mcm9tKGRhdGEuQm9keSBhcyBzdHJpbmcsICdiYXNlNjQnKTtcblxuICAgICAgICBjb25zdCBhd3Nsb2dzRGF0YSA9IEpTT04ucGFyc2UoYXdhaXQgemxpYi5ndW56aXBTeW5jKHppcHBlZElucHV0KS50b1N0cmluZygndXRmOCcpKTtcblxuICAgICAgICB2YXIgZWxhc3RpY3NlYXJjaEJ1bGtEYXRhID0gYXdhaXQgQ2xvdWRUcmFpbFdvcmtlci50cmFuc2Zvcm0oYXdzbG9nc0RhdGEpO1xuXG4gICAgICAgIHZhciByZXF1ZXN0UGFyYW1zID0gYXdhaXQgYnVpbGRSZXF1ZXN0KGVuZHBvaW50LCBlbGFzdGljc2VhcmNoQnVsa0RhdGEsIF9yZWdpb24hKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgaHR0cHNSZXF1ZXN0KHJlcXVlc3RQYXJhbXMsIGF3c2xvZ3NEYXRhLCBwYXJhbXMuS2V5KTtcbiAgICAgICAgICAgIGNvbnRleHQuc3VjY2VlZCgnU3VjY2VzcycpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1BPU1QgcmVxdWVzdCBmYWlsZWQsIGVycm9yOicsIGVycik7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnRmFpbGVkIHRyYW5zZmVyIHRoZSBsb2cgZmlsZTogJywgcGFyYW1zKTtcbiAgICAgICAgICAgIGNvbnRleHQuZmFpbChKU09OLnN0cmluZ2lmeShlcnIpKTtcbiAgICAgICAgfVxuICAgICAgICBjb250ZXh0LnN1Y2NlZWQoJ1N1Y2Nlc3MnKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdTa2lwOiBUaGUgUzMgb2JqZWN0XFwncyBrZXkgZG9lcyBub3QgbWF0Y2ggQ2xvdWRUcmFpbC8gZm9ybWF0ZSwgdGhlIGtleSBpczogJywgcGFyYW1zLktleSk7XG4gICAgICAgIGNvbnRleHQuc3VjY2VlZCgnU3VjY2VzcycpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgaGFuZGxlciB9Il19