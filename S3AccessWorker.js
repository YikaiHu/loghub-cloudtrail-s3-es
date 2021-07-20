"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3TimeFormateChange = exports.transform = void 0;
const LOG_REGEX = /([^ ]+) ([^ ]+) \[([^\]]+)\] ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) "([^ ]+) ([^ ]+) ([^"]+)" ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) "([^ ]+)" "([^"]+)" ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+)/;
function transform(s3AccessData) {
    const dataArray = s3AccessData.split("\n");
    var bulkRequestBody = '';
    dataArray.forEach(function (Record) {
        var source = parseS3AccessLogLine(Record);
        if (source == null)
            return;
        console.log("Data in S3 Access arrays: ", Record);
        source['@timestamp'] = source.timestamp;
        source['@message'] = JSON.stringify(Record);
        // index name format: cloudtrail-YYYY.MM.DD
        var indexName = [
            's3access-' + source.timestamp.substring(0, 4),
            source.timestamp.substring(5, 7),
            source.timestamp.substring(8, 10) // day
        ].join('.');
        //Using ElasticSearch created _id.
        var action = {
            "index": {
                "_index": "",
                "_type": "",
            }
        };
        action.index._index = indexName;
        action.index._type = "s3access-s3";
        bulkRequestBody += [
            JSON.stringify(action),
            JSON.stringify(source),
        ].join('\n') + '\n';
    });
    return bulkRequestBody;
}
exports.transform = transform;
function parseS3AccessLogLine(line) {
    let data = LOG_REGEX.exec(line);
    if (!data || data.length < 26) {
        return null;
    }
    let cleaned_data = data.map(v => {
        if (v == '\'-\'' || v == '"-"' || v == '-') {
            return null;
        }
        return v;
    });
    var parseResult = {
        owner_id: cleaned_data[1],
        bucket: cleaned_data[2],
        timestamp: s3TimeFormateChange(cleaned_data[3]),
        ip_address: cleaned_data[4],
        requester: cleaned_data[5],
        request_id: cleaned_data[6],
        request_type: cleaned_data[7],
        bucket_key: cleaned_data[8],
        http_method: cleaned_data[9],
        http_path: cleaned_data[10],
        http_version: cleaned_data[11],
        http_status_code: cleaned_data[12],
        error_code: cleaned_data[13],
        bytes_sent: cleaned_data[14],
        object_size: cleaned_data[15],
        total_request_time: cleaned_data[16],
        turn_around_time: cleaned_data[17],
        referrer: cleaned_data[18],
        user_agent: cleaned_data[19],
        version_id: cleaned_data[20],
        host_id: cleaned_data[21],
        signature_version: cleaned_data[22],
        cipher_suite: cleaned_data[23],
        authentiation_type: cleaned_data[24],
        host_header: cleaned_data[25],
        tls_version: cleaned_data[26],
    };
    return parseResult;
}
/**
 * 	"05/Jul/2021:05:28:18 +0000" to "2021-06-30T01:33:25Z"
 * @param inputTime
 */
function s3TimeFormateChange(inputTime) {
    if (inputTime == null)
        return null;
    var date = inputTime.substring(0, 11).split("/");
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (var j = 0; j < months.length; j++) {
        if (date[1] == months[j]) {
            date[1] = String(months.indexOf(months[j]) + 1);
        }
    }
    if (Number(date[1]) < 10) {
        date[1] = '0' + date[1];
    }
    var formattedDate = date[2] + '-' + date[1] + '-' + date[0] + 'T' + inputTime.substring(12, 20) + 'Z';
    return formattedDate;
}
exports.s3TimeFormateChange = s3TimeFormateChange;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUzNBY2Nlc3NXb3JrZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJTM0FjY2Vzc1dvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxNQUFNLFNBQVMsR0FBRyw0TkFBNE4sQ0FBQztBQUUvTyxTQUFTLFNBQVMsQ0FBQyxZQUFvQjtJQUVuQyxNQUFNLFNBQVMsR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRTNDLElBQUksZUFBZSxHQUFHLEVBQUUsQ0FBQztJQUV6QixTQUFTLENBQUMsT0FBTyxDQUFDLFVBQVUsTUFBVztRQUNuQyxJQUFJLE1BQU0sR0FBRyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMxQyxJQUFJLE1BQU0sSUFBSSxJQUFJO1lBQUUsT0FBTztRQUMzQixPQUFPLENBQUMsR0FBRyxDQUFDLDRCQUE0QixFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ2xELE1BQU0sQ0FBQyxZQUFZLENBQUMsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDO1FBQ3hDLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRTVDLDJDQUEyQztRQUMzQyxJQUFJLFNBQVMsR0FBRztZQUNaLFdBQVcsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzlDLE1BQU0sQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDaEMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFvQixNQUFNO1NBQzlELENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRVosa0NBQWtDO1FBQ2xDLElBQUksTUFBTSxHQUFHO1lBQ1QsT0FBTyxFQUFFO2dCQUNMLFFBQVEsRUFBRSxFQUFFO2dCQUNaLE9BQU8sRUFBRSxFQUFFO2FB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LFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2pELElBQUksTUFBTSxHQUFHLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNsRyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNwQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDdEIsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1NBQ25EO0tBQ0o7SUFDRCxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUU7UUFDdEIsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDM0I7SUFDRCxJQUFJLGFBQWEsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUM7SUFDdEcsT0FBTyxhQUFhLENBQUM7QUFDekIsQ0FBQztBQUVtQixrREFBbUIiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBMT0dfUkVHRVggPSAvKFteIF0rKSAoW14gXSspIFxcWyhbXlxcXV0rKVxcXSAoW14gXSspIChbXiBdKykgKFteIF0rKSAoW14gXSspIChbXiBdKykgXCIoW14gXSspIChbXiBdKykgKFteXCJdKylcIiAoW14gXSspIChbXiBdKykgKFteIF0rKSAoW14gXSspIChbXiBdKykgKFteIF0rKSBcIihbXiBdKylcIiBcIihbXlwiXSspXCIgKFteIF0rKSAoW14gXSspIChbXiBdKykgKFteIF0rKSAoW14gXSspIChbXiBdKykgKFteIF0rKS87XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybShzM0FjY2Vzc0RhdGE6IHN0cmluZykge1xuXG4gICAgY29uc3QgZGF0YUFycmF5ID0gczNBY2Nlc3NEYXRhLnNwbGl0KFwiXFxuXCIpO1xuXG4gICAgdmFyIGJ1bGtSZXF1ZXN0Qm9keSA9ICcnO1xuXG4gICAgZGF0YUFycmF5LmZvckVhY2goZnVuY3Rpb24gKFJlY29yZDogYW55KSB7XG4gICAgICAgIHZhciBzb3VyY2UgPSBwYXJzZVMzQWNjZXNzTG9nTGluZShSZWNvcmQpO1xuICAgICAgICBpZiAoc291cmNlID09IG51bGwpIHJldHVybjtcbiAgICAgICAgY29uc29sZS5sb2coXCJEYXRhIGluIFMzIEFjY2VzcyBhcnJheXM6IFwiLCBSZWNvcmQpO1xuICAgICAgICBzb3VyY2VbJ0B0aW1lc3RhbXAnXSA9IHNvdXJjZS50aW1lc3RhbXA7XG4gICAgICAgIHNvdXJjZVsnQG1lc3NhZ2UnXSA9IEpTT04uc3RyaW5naWZ5KFJlY29yZCk7XG5cbiAgICAgICAgLy8gaW5kZXggbmFtZSBmb3JtYXQ6IGNsb3VkdHJhaWwtWVlZWS5NTS5ERFxuICAgICAgICB2YXIgaW5kZXhOYW1lID0gW1xuICAgICAgICAgICAgJ3MzYWNjZXNzLScgKyBzb3VyY2UudGltZXN0YW1wLnN1YnN0cmluZygwLCA0KSwgICAgICAvLyB5ZWFyXG4gICAgICAgICAgICBzb3VyY2UudGltZXN0YW1wLnN1YnN0cmluZyg1LCA3KSwgICAgICAgICAgICAgICAgICAgIC8vIG1vbnRoXG4gICAgICAgICAgICBzb3VyY2UudGltZXN0YW1wLnN1YnN0cmluZyg4LCAxMCkgICAgICAgICAgICAgICAgICAgIC8vIGRheVxuICAgICAgICBdLmpvaW4oJy4nKTtcblxuICAgICAgICAvL1VzaW5nIEVsYXN0aWNTZWFyY2ggY3JlYXRlZCBfaWQuXG4gICAgICAgIHZhciBhY3Rpb24gPSB7XG4gICAgICAgICAgICBcImluZGV4XCI6IHtcbiAgICAgICAgICAgICAgICBcIl9pbmRleFwiOiBcIlwiLFxuICAgICAgICAgICAgICAgIFwiX3R5cGVcIjogXCJcIixcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgYWN0aW9uLmluZGV4Ll9pbmRleCA9IGluZGV4TmFtZTtcbiAgICAgICAgYWN0aW9uLmluZGV4Ll90eXBlID0gXCJzM2FjY2Vzcy1zM1wiO1xuXG4gICAgICAgIGJ1bGtSZXF1ZXN0Qm9keSArPSBbXG4gICAgICAgICAgICBKU09OLnN0cmluZ2lmeShhY3Rpb24pLFxuICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoc291cmNlKSxcbiAgICAgICAgXS5qb2luKCdcXG4nKSArICdcXG4nO1xuXG4gICAgfSk7XG5cbiAgICByZXR1cm4gYnVsa1JlcXVlc3RCb2R5O1xuXG59XG5cbmZ1bmN0aW9uIHBhcnNlUzNBY2Nlc3NMb2dMaW5lKGxpbmU6IHN0cmluZyk6IGFueSB7XG4gICAgbGV0IGRhdGEgPSBMT0dfUkVHRVguZXhlYyhsaW5lKTtcbiAgICBpZiAoIWRhdGEgfHwgZGF0YS5sZW5ndGggPCAyNikge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBsZXQgY2xlYW5lZF9kYXRhID0gZGF0YS5tYXAodiA9PiB7XG4gICAgICAgIGlmICh2ID09ICdcXCctXFwnJyB8fCB2ID09ICdcIi1cIicgfHwgdiA9PSAnLScpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2O1xuICAgIH0pO1xuXG4gICAgdmFyIHBhcnNlUmVzdWx0ID0ge1xuICAgICAgICBvd25lcl9pZDogY2xlYW5lZF9kYXRhIVsxXSxcbiAgICAgICAgYnVja2V0OiBjbGVhbmVkX2RhdGEhWzJdLFxuICAgICAgICB0aW1lc3RhbXA6IHMzVGltZUZvcm1hdGVDaGFuZ2UoY2xlYW5lZF9kYXRhIVszXSEpLFxuICAgICAgICBpcF9hZGRyZXNzOiBjbGVhbmVkX2RhdGEhWzRdLFxuICAgICAgICByZXF1ZXN0ZXI6IGNsZWFuZWRfZGF0YSFbNV0sXG4gICAgICAgIHJlcXVlc3RfaWQ6IGNsZWFuZWRfZGF0YSFbNl0sXG4gICAgICAgIHJlcXVlc3RfdHlwZTogY2xlYW5lZF9kYXRhIVs3XSxcbiAgICAgICAgYnVja2V0X2tleTogY2xlYW5lZF9kYXRhIVs4XSxcbiAgICAgICAgaHR0cF9tZXRob2Q6IGNsZWFuZWRfZGF0YSFbOV0sXG4gICAgICAgIGh0dHBfcGF0aDogY2xlYW5lZF9kYXRhIVsxMF0sXG4gICAgICAgIGh0dHBfdmVyc2lvbjogY2xlYW5lZF9kYXRhIVsxMV0sXG4gICAgICAgIGh0dHBfc3RhdHVzX2NvZGU6IGNsZWFuZWRfZGF0YSFbMTJdLFxuICAgICAgICBlcnJvcl9jb2RlOiBjbGVhbmVkX2RhdGEhWzEzXSxcbiAgICAgICAgYnl0ZXNfc2VudDogY2xlYW5lZF9kYXRhIVsxNF0sXG4gICAgICAgIG9iamVjdF9zaXplOiBjbGVhbmVkX2RhdGEhWzE1XSxcbiAgICAgICAgdG90YWxfcmVxdWVzdF90aW1lOiBjbGVhbmVkX2RhdGEhWzE2XSxcbiAgICAgICAgdHVybl9hcm91bmRfdGltZTogY2xlYW5lZF9kYXRhIVsxN10sXG4gICAgICAgIHJlZmVycmVyOiBjbGVhbmVkX2RhdGEhWzE4XSxcbiAgICAgICAgdXNlcl9hZ2VudDogY2xlYW5lZF9kYXRhIVsxOV0sXG4gICAgICAgIHZlcnNpb25faWQ6IGNsZWFuZWRfZGF0YSFbMjBdLFxuICAgICAgICBob3N0X2lkOiBjbGVhbmVkX2RhdGEhWzIxXSxcbiAgICAgICAgc2lnbmF0dXJlX3ZlcnNpb246IGNsZWFuZWRfZGF0YSFbMjJdLFxuICAgICAgICBjaXBoZXJfc3VpdGU6IGNsZWFuZWRfZGF0YSFbMjNdLFxuICAgICAgICBhdXRoZW50aWF0aW9uX3R5cGU6IGNsZWFuZWRfZGF0YSFbMjRdLFxuICAgICAgICBob3N0X2hlYWRlcjogY2xlYW5lZF9kYXRhIVsyNV0sXG4gICAgICAgIHRsc192ZXJzaW9uOiBjbGVhbmVkX2RhdGEhWzI2XSxcbiAgICB9O1xuXG4gICAgcmV0dXJuIHBhcnNlUmVzdWx0O1xufVxuXG4vKipcbiAqIFx0XCIwNS9KdWwvMjAyMTowNToyODoxOCArMDAwMFwiIHRvIFwiMjAyMS0wNi0zMFQwMTozMzoyNVpcIlxuICogQHBhcmFtIGlucHV0VGltZSBcbiAqL1xuXG5mdW5jdGlvbiBzM1RpbWVGb3JtYXRlQ2hhbmdlKGlucHV0VGltZTogc3RyaW5nKSB7XG4gICAgaWYgKGlucHV0VGltZSA9PSBudWxsKSByZXR1cm4gbnVsbDtcblxuICAgIHZhciBkYXRlID0gaW5wdXRUaW1lLnN1YnN0cmluZygwLCAxMSkuc3BsaXQoXCIvXCIpO1xuICAgIHZhciBtb250aHMgPSBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJywgJ09jdCcsICdOb3YnLCAnRGVjJ107XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBtb250aHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYgKGRhdGVbMV0gPT0gbW9udGhzW2pdKSB7XG4gICAgICAgICAgICBkYXRlWzFdID0gU3RyaW5nKG1vbnRocy5pbmRleE9mKG1vbnRoc1tqXSkgKyAxKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoTnVtYmVyKGRhdGVbMV0pIDwgMTApIHtcbiAgICAgICAgZGF0ZVsxXSA9ICcwJyArIGRhdGVbMV07XG4gICAgfVxuICAgIHZhciBmb3JtYXR0ZWREYXRlID0gZGF0ZVsyXSArICctJyArIGRhdGVbMV0gKyAnLScgKyBkYXRlWzBdICsgJ1QnICsgaW5wdXRUaW1lLnN1YnN0cmluZygxMiwgMjApICsgJ1onO1xuICAgIHJldHVybiBmb3JtYXR0ZWREYXRlO1xufVxuXG5leHBvcnQgeyB0cmFuc2Zvcm0sIHMzVGltZUZvcm1hdGVDaGFuZ2V9Il19