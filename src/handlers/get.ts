import * as AWS from 'aws-sdk';
import { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayProxyEventPathParameters } from "aws-lambda";
import { string } from '@hapi/joi';
const client = new AWS.DynamoDB.DocumentClient();

const nestItem = (record:{[key:string]:any}, key:string, value:any, position:number) => {
    const idx = key.indexOf('_', position);

    if (idx === -1) {
        //console.log(`Setting ${key.substr(position)}`);
        record[key.substr(position)] = value;
        return;
    }
    const realKey = key.substr(position, idx - position);
    //console.log(`Dealing with ${realKey}`);
    const isArray = !isNaN(parseInt(key[idx + 1]));
    //console.log(`key: ${realKey}, isArray: ${isArray}`);

    if(!record[realKey])
        {
        if (isArray) {
            record[realKey] = [];
        }
        else {
            record[realKey] = {};
        }
    }

    nestItem(record[realKey], key, value, idx+1);
    return record;
};
exports.handler = async (event: APIGatewayProxyEvent):Promise<APIGatewayProxyResult> => {
    //Get & Set Parameters
    const pathParams = event.pathParameters!
    const queryParams = event.queryStringParameters!
    const status = queryParams['status'] as TECH_STATUS_CODE ?? TECH_STATUS_CODE.PROVISIONAL_OVER_CURRENT;
    const vehicleId = pathParams['vehicleId'];

    const result = await client.query({
        TableName: process.env.target_table!,
        KeyConditionExpression: 'systemNumber = :vehicleId',
        FilterExpression: 'CONTAINS(status, :status)',
        ScanIndexForward: false,
        ExpressionAttributeValues: {
            ':vehicleId': vehicleId,
            ':statusList': status
        }
    }).promise();
    //console.log('Retrieved from Dynamo');

    if (result.Items == undefined || result.Items.length === 0) {
        return {
            statusCode: 404,
            body: '',
        };
    }

    //console.log(JSON.stringify());
    const vehicle = {'techRecord':[]};
    for(const item of result.Items)
    {
        const record:{[key:string]:any} = {};
        for (const [key, value] of Object.entries(item)) {
            if(key.indexOf('_') === -1 && !vehicle[key])
            {
                vehicle[key] = value;
                continue;
            }
            nestItem(record, key, value, 0);
        }
        vehicle.techRecord.push(record.techRecord);
    }

    const response = {
        statusCode: 200,
        body: JSON.stringify(vehicle),
    };
    return response;
};
