# Log Hub Repo
This is the repo for write logs into Amazon Elastic Search.

Meanwhile this project still in POC progress. It will be moved to Amazon Web Services' offical repo soon.

### Supported service:

* CloudTrail
* S3 Access Log

## User Guide

1. Clone this repo.
1. Create a Lambda function.
1. Change the _workType in **index.js** to `CLOUDTRAIL` or `S3ACCESS` as your need.
1. Change the endpoint in **index.js** to your ES endpoint.
1. Copy these function into the Lambda:
    * index.js
    * common.js
    * S3AccessWorker.js
    * CloudTrailWorker.js

> Note: If your ElasticSearch is in VPC, then you should create a Lambda in the same VPC.

## How to Build the Source Code

1. You need install npm, suggest version 6.14.5
1. `cd loghub-cloudtrail-s3-es`
1. run `npm -i`
1. After that, you can modify the code in *.ts file, they will be build into *.js file. **Remember to modify the `_workType` and `endpoint` in index.js**
1. run `npm run build`
