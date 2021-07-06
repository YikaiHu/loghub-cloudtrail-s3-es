const LOG_REGEX = /([^ ]+) ([^ ]+) \[([^\]]+)\] ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) "([^ ]+) ([^ ]+) ([^"]+)" ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) "([^ ]+)" "([^"]+)" ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+)/;

function transform(s3AccessData: string) {
    const dataArray = s3AccessData.split("\n");

    var bulkRequestBody = '';

    dataArray.forEach(function (Record: any) {
        var source = parseS3AccessLogLine(Record);
        if (source == null) return;
        console.log("data in arrays: ", Record);
        source['@timestamp'] = source.timestamp;
        source['@message'] = JSON.stringify(Record);

        // index name format: cloudtrail-YYYY.MM.DD
        var indexName = [
            's3access-' + source.timestamp.substring(0, 4),      // year
            source.timestamp.substring(5, 7),                    // month
            source.timestamp.substring(8, 10)                    // day
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

function parseS3AccessLogLine(line: string): any {
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
        owner_id: cleaned_data![1],
        bucket: cleaned_data![2],
        timestamp: s3TimeFormateChange(cleaned_data![3]!),
        ip_address: cleaned_data![4],
        requester: cleaned_data![5],
        request_id: cleaned_data![6],
        request_type: cleaned_data![7],
        bucket_key: cleaned_data![8],
        http_method: cleaned_data![9],
        http_path: cleaned_data![10],
        http_version: cleaned_data![11],
        http_status_code: cleaned_data![12],
        error_code: cleaned_data![13],
        bytes_sent: cleaned_data![14],
        object_size: cleaned_data![15],
        total_request_time: cleaned_data![16],
        turn_around_time: cleaned_data![17],
        referrer: cleaned_data![18],
        user_agent: cleaned_data![19],
        version_id: cleaned_data![20],
        host_id: cleaned_data![21],
        signature_version: cleaned_data![22],
        cipher_suite: cleaned_data![23],
        authentiation_type: cleaned_data![24],
        host_header: cleaned_data![25],
        tls_version: cleaned_data![26],
    };

    return parseResult;
}

/**
 * 	"05/Jul/2021:05:28:18 +0000" to "2021-06-30T01:33:25Z"
 * @param inputTime 
 */

function s3TimeFormateChange(inputTime: string) {
    if (inputTime == null) return null;

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

export { transform, s3TimeFormateChange}