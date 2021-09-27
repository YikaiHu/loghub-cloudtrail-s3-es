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

import json
import logging
import os
import re

import boto3
import requests
from crhelper import CfnResource
from requests_aws4auth import AWS4Auth

logger = logging.getLogger(__name__)
helper_config = CfnResource(json_logging=False,
                            log_level='DEBUG',
                            boto_level='CRITICAL',
                            sleep_on_delete=120)

region = os.environ['AWS_REGION']
KIBANA_HEADERS = {'Content-Type': 'application/json', 'kbn-xsrf': 'true'}
OPENSEARCH_DASHBOARD_HEADERS = {'Content-Type': 'application/json', 'osd-xsrf': 'true'}


def auth_opensearch(opensearch_endpoint):
    service = 'es'
    credentials = boto3.Session().get_credentials()
    awsauth = AWS4Auth(credentials.access_key,
                       credentials.secret_key,
                       region,
                       service,
                       session_token=credentials.token)
    return awsauth


def output_message(key, res):
    return (f'{key}: status={res.status_code}, message={res.text}')


def query_opensearch(opensearch_endpoint,
                     awsauth,
                     method=None,
                     path=None,
                     payload=None,
                     headers=None):
    if not headers:
        headers = {'Content-Type': 'application/json'}
    url = 'https://' + opensearch_endpoint + '/' + path
    if method.lower() == 'get':
        res = requests.get(url, auth=awsauth, stream=True)
    elif method.lower() == 'post':
        res = requests.post(url, auth=awsauth, json=payload, headers=headers)
    elif method.lower() == 'put':
        res = requests.put(url, auth=awsauth, json=payload, headers=headers)
    elif method.lower() == 'patch':
        res = requests.put(url, auth=awsauth, json=payload, headers=headers)
    elif method.lower() == 'head':
        res = requests.head(url, auth=awsauth, json=payload, headers=headers)
    return (res)


def set_tenant_get_cookies(engineType, opensearch_endpoint, tenant, auth):
    if engineType == 'OpenSearch':
        base_url = f'https://{opensearch_endpoint}/_dashboards'
        headers = OPENSEARCH_DASHBOARD_HEADERS
    else:
        base_url = f'https://{opensearch_endpoint}/_plugin/kibana'
        headers = KIBANA_HEADERS
    if isinstance(auth, dict):
        url = f'{base_url}/auth/login?security_tenant={tenant}'
        response = requests.post(url,
                                 headers=headers,
                                 json=json.dumps(auth))
    elif isinstance(auth, AWS4Auth):
        url = f'{base_url}/app/dashboards?security_tenant={tenant}'
        response = requests.get(url, headers=headers, auth=auth)
    else:
        logger.error('There is no valid authentication')
        return False
    if response.status_code in (200, ):
        logger.info('Authentication success to access kibana')
        return response.cookies
    else:
        print(response.cookies)
        logger.error("Authentication failed to access kibana")
        logger.error(response.reason)
        return False


def configure_aes_total_fields_limit(opensearch_endpoint, indexName, limit_number,
                                     awsauth):
    payload = {"index.mapping.total_fields.limit": limit_number}
    path = str(indexName) + '/_settings'
    res = query_opensearch(opensearch_endpoint, awsauth, 'PUT', path, payload)
    if res.status_code == 200:
        logger.info("Change total_fields limit for index: %s to %d." %
                    (indexName, limit_number))
        return 'success'
    else:
        logger.error(output_message(path, res))
        return 'fail'


@helper_config.create
@helper_config.update
def update_total_fields_limit(opensearch_endpoint, indexName, limit_number):
    awsauth = auth_opensearch(opensearch_endpoint)
    state = configure_aes_total_fields_limit(opensearch_endpoint, indexName,
                                             limit_number, awsauth)
    return state


@helper_config.create
@helper_config.update
def index_exists(opensearch_endpoint, indexName):
    awsauth = auth_opensearch(opensearch_endpoint)
    path = str(indexName)
    res = query_opensearch(opensearch_endpoint, awsauth, 'HEAD', path)
    if res.status_code == 200:
        logger.info("Index name: %s exists." % (indexName))
        return 'success'
    else:
        logger.info("Index name: %s doesn't exist." % (indexName))
        return 'fail'


@helper_config.create
@helper_config.update
def create_index(opensearch_endpoint, indexName):
    awsauth = auth_opensearch(opensearch_endpoint)
    payload = {
        "settings": {
            "index.mapping.ignore_malformed": "true"
        }
    }
    path = str(indexName)
    res = query_opensearch(opensearch_endpoint, awsauth, 'PUT', path, payload)
    if res.status_code == 200:
        logger.info("Create Index %s." % (indexName))
        return 'success'
