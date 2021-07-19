import { buildSource } from './common'
/**
 * 
 * @param payload 
 * @returns bulkRequestBody
 */
function transform(payload: any) {
    if (payload === null) {
        return null;
    }

    var bulkRequestBody = '';

    payload.Records.forEach(function (Record: any) {
        // index name format: cloudtrail-YYYY.MM.DD
        var indexName = [
            'cloudtrail-' + Record.eventTime.substring(0, 4),    // year
            Record.eventTime.substring(5, 7),                    // month
            Record.eventTime.substring(8, 10)                    // day
        ].join('.');

        var source = buildSource(Record);

        source['@timestamp'] = Record.eventTime;
        source['@message'] = JSON.stringify(Record);
        source['@owner'] = payload.owner;

        //issue 1, source["requestParameters"]["filter"] will cause ES reject
        try {
            source["requestParameters"]["filter"] = convertArrayIntoObject(source["requestParameters"]["filter"]);
        } catch (ex) {
            console.log("Transform error! ", ex);
        }

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

function isArray(o: any) {
    return Object.prototype.toString.call(o) == '[object Array]';
}

function convertArrayIntoObject(temp_value: any) {
    if (isArray(temp_value)) {
        return { 'value': temp_value }
    } else {
        return temp_value;
    }
}

export { transform }