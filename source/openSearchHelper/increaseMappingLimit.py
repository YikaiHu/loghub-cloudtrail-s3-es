'''
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
'''

import boto3
import os
import opensearchTools
import time
import datetime
import logging

logger = logging.getLogger(__name__)

'''
There are more than 3500 fields in AWS CloudTrail Logs.
However, the OpenSearch default total fields upper limit is 1000.
This lambda function will increase the total fields maximum limit to 4000 every day.
An event bridge rule will trigger this lambda.
'''
def lambda_handler(event, context):
    es_endpoint = os.environ['ES_ENDPOINT']
    logType = os.environ['LOG_TYPE']
    indexName = os.environ['INDEX_NAME']

    index_window = [
        indexName + '-cloudtrail-' + datetime.datetime.now().strftime('%Y.%m.%d'),
        indexName + '-cloudtrail-' + (datetime.datetime.now() + datetime.timedelta(days=1)).strftime('%Y.%m.%d')
    ]
    for index in index_window:
        if logType == 'CloudTrail':
            state = opensearchTools.index_exists(es_endpoint, index)
            if state == 'fail':
                # Here assume that CloudTrail's log is latest, and 
                opensearchTools.create_index(es_endpoint, index)
                # Increase total_fields limit to 4000 for CloudTrail Log
                opensearchTools.update_total_fields_limit(es_endpoint, index, 4000)
            else:
                # Increase total_fields limit to 4000 for CloudTrail Log
                opensearchTools.update_total_fields_limit(es_endpoint, index, 4000)
            
    return {'statusCode': 200, 'body': 'Jobs completed'}
